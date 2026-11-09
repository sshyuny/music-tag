import { randomUUID } from 'node:crypto'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { normalizeTagName, tagKey } from '../src/domain/tagName'
import type { SearchResult, Song, SongRecord, Tag, TagGroup } from '../src/domain/types'
import { DuplicateTagNameError, InvalidNameError, InvalidReferenceError, type SongRepository } from '../src/ports/SongRepository'

/** A connection is owned by the caller. All transaction callbacks are synchronous. */
export class SqliteSongRepository implements SongRepository {
  private readonly db: DatabaseSync
  private readonly userId: string
  private readonly now: () => number

  constructor(db: DatabaseSync, userId = 'default', now: () => number = Date.now) {
    this.db = db
    this.userId = userId
    this.now = now
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
    const version = this.one<{ user_version: number }>('PRAGMA user_version')!.user_version
    if (version > 1) throw new Error('지원하지 않는 DB 스키마 버전입니다')
    if (version === 0) {
      db.exec('BEGIN IMMEDIATE')
      try {
        db.exec(`
          CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL) STRICT;
          CREATE TABLE songs (
            trackId INTEGER PRIMARY KEY, title TEXT NOT NULL, originalTitle TEXT NOT NULL,
            artistName TEXT NOT NULL, albumName TEXT, artworkUrl TEXT, releaseDate TEXT, addedAt INTEGER NOT NULL
          ) STRICT;
          CREATE TABLE groups (
            id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
            UNIQUE(userId, id)
          ) STRICT;
          CREATE TABLE tags (
            id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
            nameKey TEXT NOT NULL, groupId TEXT, lastUsedAt INTEGER,
            UNIQUE(userId, nameKey), UNIQUE(userId, id),
            FOREIGN KEY(userId, groupId) REFERENCES groups(userId, id)
          ) STRICT;
          CREATE TABLE songTags (
            userId TEXT NOT NULL REFERENCES users(id), trackId INTEGER NOT NULL REFERENCES songs(trackId),
            tagId TEXT NOT NULL, PRIMARY KEY(userId, trackId, tagId),
            FOREIGN KEY(userId, tagId) REFERENCES tags(userId, id) ON DELETE CASCADE
          ) STRICT;
          CREATE INDEX tags_group ON tags(userId, groupId);
          CREATE INDEX songTags_tag ON songTags(userId, tagId);
          INSERT INTO users VALUES ('default', '기본 사용자');
          PRAGMA user_version = 1;
        `)
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    }
  }

  private one<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined
  }
  private all<T>(sql: string, ...params: SQLInputValue[]): T[] {
    return this.db.prepare(sql).all(...params) as T[]
  }
  private run(sql: string, ...params: SQLInputValue[]): void {
    this.db.prepare(sql).run(...params)
  }
  private async scoped<T>(write: boolean, action: () => T): Promise<T> {
    this.db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN')
    try {
      if (!this.one('SELECT id FROM users WHERE id = ?', this.userId)) throw new InvalidReferenceError()
      const result = action()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
  private ownTag(id: string): Tag {
    const tag = this.one<Tag>('SELECT * FROM tags WHERE id = ? AND userId = ?', id, this.userId)
    if (!tag) throw new InvalidReferenceError()
    return tag
  }
  private ownGroup(id: string): TagGroup {
    const group = this.one<TagGroup>('SELECT * FROM groups WHERE id = ? AND userId = ?', id, this.userId)
    if (!group) throw new InvalidReferenceError()
    return group
  }
  private song(id: number): Song {
    const record = this.one<SongRecord>('SELECT * FROM songs WHERE trackId = ?', id)
    if (!record) throw new InvalidReferenceError()
    const links = this.all<{ tagId: string }>('SELECT tagId FROM songTags WHERE userId = ? AND trackId = ? ORDER BY tagId', this.userId, id)
    return { ...record, tagIds: links.map(link => link.tagId) }
  }
  listSongs(): Promise<Song[]> {
    return this.scoped(false, () => {
      const songs = this.all<SongRecord>('SELECT * FROM songs ORDER BY trackId')
      const links = this.all<{ trackId: number; tagId: string }>('SELECT trackId, tagId FROM songTags WHERE userId = ? ORDER BY tagId', this.userId)
      const bySong = new Map<number, string[]>()
      for (const link of links) {
        const tags = bySong.get(link.trackId) ?? []
        tags.push(link.tagId)
        bySong.set(link.trackId, tags)
      }
      return songs.map(song => ({ ...song, tagIds: bySong.get(song.trackId) ?? [] }))
    })
  }
  saveSong(result: SearchResult): Promise<Song> {
    return this.scoped(true, () => {
      this.run(`INSERT INTO songs (trackId, title, originalTitle, artistName, albumName, artworkUrl, releaseDate, addedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(trackId) DO NOTHING`,
      result.trackId, result.originalTitle, result.originalTitle, result.artistName, result.albumName, result.artworkUrl, result.releaseDate, this.now())
      return this.song(result.trackId)
    })
  }
  updateSongTitle(trackId: number, title: string): Promise<void> {
    return this.scoped(true, () => {
      const song = this.song(trackId)
      this.run('UPDATE songs SET title = ? WHERE trackId = ?', title.trim() || song.originalTitle, trackId)
    })
  }
  addTagToSong(trackId: number, tagId: string): Promise<void> {
    return this.scoped(true, () => {
      this.song(trackId)
      this.ownTag(tagId)
      this.run('INSERT INTO songTags VALUES (?, ?, ?) ON CONFLICT DO NOTHING', this.userId, trackId, tagId)
      this.run('UPDATE tags SET lastUsedAt = ? WHERE id = ?', this.now(), tagId)
    })
  }
  removeTagFromSong(trackId: number, tagId: string): Promise<void> {
    return this.scoped(true, () => {
      this.song(trackId)
      this.ownTag(tagId)
      this.run('DELETE FROM songTags WHERE userId = ? AND trackId = ? AND tagId = ?', this.userId, trackId, tagId)
    })
  }
  listTags(): Promise<Tag[]> {
    return this.scoped(false, () => this.all<Tag>('SELECT * FROM tags WHERE userId = ? ORDER BY id', this.userId))
  }
  createTag(rawName: string): Promise<Tag> {
    return this.scoped(true, () => {
      const name = normalizeTagName(rawName)
      if (!name) throw new InvalidNameError()
      const nameKey = tagKey(name)
      const existing = this.one<Tag>('SELECT * FROM tags WHERE userId = ? AND nameKey = ?', this.userId, nameKey)
      if (existing) return existing
      const tag: Tag = { id: randomUUID(), userId: this.userId, name, nameKey, groupId: null, lastUsedAt: null }
      this.run('INSERT INTO tags VALUES (?, ?, ?, ?, NULL, NULL)', tag.id, this.userId, name, nameKey)
      return tag
    })
  }
  renameTag(tagId: string, rawName: string): Promise<void> {
    return this.scoped(true, () => {
      this.ownTag(tagId)
      const name = normalizeTagName(rawName)
      if (!name) throw new InvalidNameError()
      const nameKey = tagKey(name)
      if (this.one('SELECT id FROM tags WHERE userId = ? AND nameKey = ? AND id != ?', this.userId, nameKey, tagId)) throw new DuplicateTagNameError(name)
      this.run('UPDATE tags SET name = ?, nameKey = ? WHERE id = ?', name, nameKey, tagId)
    })
  }
  deleteTag(tagId: string): Promise<void> {
    return this.scoped(true, () => {
      this.ownTag(tagId)
      this.run('DELETE FROM tags WHERE id = ?', tagId)
    })
  }
  setTagGroup(tagId: string, groupId: string | null): Promise<void> {
    return this.scoped(true, () => {
      this.ownTag(tagId)
      if (groupId !== null) this.ownGroup(groupId)
      this.run('UPDATE tags SET groupId = ? WHERE id = ?', groupId, tagId)
    })
  }
  listGroups(): Promise<TagGroup[]> {
    return this.scoped(false, () => this.all<TagGroup>('SELECT * FROM groups WHERE userId = ? ORDER BY id', this.userId))
  }
  createGroup(rawName: string): Promise<TagGroup> {
    return this.scoped(true, () => {
      const name = rawName.trim().replace(/\s+/g, ' ')
      if (!name) throw new InvalidNameError()
      const group = { id: randomUUID(), userId: this.userId, name }
      this.run('INSERT INTO groups VALUES (?, ?, ?)', group.id, this.userId, name)
      return group
    })
  }
  renameGroup(groupId: string, rawName: string): Promise<void> {
    return this.scoped(true, () => {
      this.ownGroup(groupId)
      const name = rawName.trim().replace(/\s+/g, ' ')
      if (!name) throw new InvalidNameError()
      this.run('UPDATE groups SET name = ? WHERE id = ?', name, groupId)
    })
  }
  deleteGroup(groupId: string): Promise<void> {
    return this.scoped(true, () => {
      this.ownGroup(groupId)
      this.run('UPDATE tags SET groupId = NULL WHERE userId = ? AND groupId = ?', this.userId, groupId)
      this.run('DELETE FROM groups WHERE id = ?', groupId)
    })
  }
}
