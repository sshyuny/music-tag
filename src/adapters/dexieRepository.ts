import { Dexie, type EntityTable, type Table } from 'dexie'
import { normalizeTagName, tagKey } from '../domain/tagName'
import type { SearchResult, Song, SongRecord, SongTag, Tag, TagGroup, User } from '../domain/types'
import { DuplicateTagNameError, InvalidNameError, InvalidReferenceError, type SongRepository } from '../ports/SongRepository'

type MusicTagDb = Dexie & {
  users: EntityTable<User, 'id'>
  songs: EntityTable<SongRecord, 'trackId'>
  tags: EntityTable<Tag, 'id'>
  groups: EntityTable<TagGroup, 'id'>
  songTags: Table<SongTag, [string, number, string]>
}

const normalizeGroupName = (name: string) => name.trim().replace(/\s+/g, ' ')

export class DexieSongRepository implements SongRepository {
  private readonly db: MusicTagDb
  private readonly now: () => number
  private readonly newId: () => string
  private readonly userId: string

  constructor(
    dbName = 'music-tag-v2',
    now: () => number = Date.now,
    newId: () => string = () => crypto.randomUUID(),
    userId = 'default',
  ) {
    this.now = now
    this.newId = newId
    this.userId = userId
    this.db = new Dexie(dbName) as MusicTagDb
    this.db.version(2).stores({
      users: '&id',
      songs: '&trackId, addedAt',
      tags: '&id, userId, &[userId+nameKey], [userId+groupId]',
      groups: '&id, userId',
      songTags: '[userId+trackId+tagId], userId, [userId+trackId], [userId+tagId]',
    })
    this.db.on('populate', () => this.db.users.add({ id: 'default', name: '기본 사용자' }))
  }

  /** 소유권 확인과 변경이 같은 트랜잭션 안에서 이루어지도록 한다. */
  private scoped<T>(mode: 'r' | 'rw', operation: () => Promise<T>): Promise<T> {
    return this.db.transaction(mode, this.db.tables, async () => {
      if (!await this.db.users.get(this.userId)) throw new InvalidReferenceError()
      return operation()
    })
  }

  private async ownTag(tagId: string): Promise<Tag> {
    const tag = await this.db.tags.get(tagId)
    if (!tag || tag.userId !== this.userId) throw new InvalidReferenceError()
    return tag
  }

  private async ownGroup(groupId: string): Promise<TagGroup> {
    const group = await this.db.groups.get(groupId)
    if (!group || group.userId !== this.userId) throw new InvalidReferenceError()
    return group
  }

  private async requireSong(trackId: number): Promise<SongRecord> {
    const song = await this.db.songs.get(trackId)
    if (!song) throw new InvalidReferenceError()
    return song
  }

  listSongs(): Promise<Song[]> {
    return this.scoped('r', async () => {
      const songs = await this.db.songs.toArray()
      const links = await this.db.songTags.where('userId').equals(this.userId).toArray()
      const bySong = new Map<number, string[]>()
      for (const link of links) {
        const ids = bySong.get(link.trackId) ?? []
        ids.push(link.tagId)
        bySong.set(link.trackId, ids)
      }
      return songs.map(song => ({ ...song, tagIds: bySong.get(song.trackId) ?? [] }))
    })
  }

  saveSong(result: SearchResult): Promise<Song> {
    return this.scoped('rw', async () => {
      let song = await this.db.songs.get(result.trackId)
      if (!song) {
        // 조회용 tagIds 등이 넘어와도 영속 레코드에는 곡 필드만 저장한다.
        song = {
          trackId: result.trackId,
          title: result.originalTitle,
          originalTitle: result.originalTitle,
          artistName: result.artistName,
          albumName: result.albumName,
          artworkUrl: result.artworkUrl,
          releaseDate: result.releaseDate,
          addedAt: this.now(),
        }
        await this.db.songs.add(song)
      }
      const links = await this.db.songTags.where('[userId+trackId]').equals([this.userId, result.trackId]).toArray()
      return { ...song, tagIds: links.map(link => link.tagId) }
    })
  }

  updateSongTitle(trackId: number, title: string): Promise<void> {
    return this.scoped('rw', async () => {
      const song = await this.requireSong(trackId)
      await this.db.songs.update(trackId, { title: title.trim() || song.originalTitle })
    })
  }

  addTagToSong(trackId: number, tagId: string): Promise<void> {
    return this.scoped('rw', async () => {
      await this.requireSong(trackId)
      await this.ownTag(tagId)
      await this.db.songTags.put({ userId: this.userId, trackId, tagId })
      await this.db.tags.update(tagId, { lastUsedAt: this.now() })
    })
  }

  removeTagFromSong(trackId: number, tagId: string): Promise<void> {
    return this.scoped('rw', async () => {
      await this.requireSong(trackId)
      await this.ownTag(tagId)
      await this.db.songTags.delete([this.userId, trackId, tagId])
    })
  }

  listTags(): Promise<Tag[]> {
    return this.scoped('r', () => this.db.tags.where('userId').equals(this.userId).toArray())
  }

  createTag(rawName: string): Promise<Tag> {
    return this.scoped('rw', async () => {
      const name = normalizeTagName(rawName)
      if (!name) throw new InvalidNameError()
      const nameKey = tagKey(name)
      const existing = await this.db.tags.where('[userId+nameKey]').equals([this.userId, nameKey]).first()
      if (existing) return existing
      const tag: Tag = { id: this.newId(), userId: this.userId, name, nameKey, groupId: null, lastUsedAt: null }
      await this.db.tags.add(tag)
      return tag
    })
  }

  renameTag(tagId: string, rawName: string): Promise<void> {
    return this.scoped('rw', async () => {
      await this.ownTag(tagId)
      const name = normalizeTagName(rawName)
      if (!name) throw new InvalidNameError()
      const nameKey = tagKey(name)
      const clash = await this.db.tags.where('[userId+nameKey]').equals([this.userId, nameKey]).first()
      if (clash && clash.id !== tagId) throw new DuplicateTagNameError(name)
      await this.db.tags.update(tagId, { name, nameKey })
    })
  }

  deleteTag(tagId: string): Promise<void> {
    return this.scoped('rw', async () => {
      await this.ownTag(tagId)
      await this.db.songTags.where('[userId+tagId]').equals([this.userId, tagId]).delete()
      await this.db.tags.delete(tagId)
    })
  }

  setTagGroup(tagId: string, groupId: string | null): Promise<void> {
    return this.scoped('rw', async () => {
      await this.ownTag(tagId)
      if (groupId !== null) await this.ownGroup(groupId)
      await this.db.tags.update(tagId, { groupId })
    })
  }

  listGroups(): Promise<TagGroup[]> {
    return this.scoped('r', () => this.db.groups.where('userId').equals(this.userId).toArray())
  }

  createGroup(rawName: string): Promise<TagGroup> {
    return this.scoped('rw', async () => {
      const name = normalizeGroupName(rawName)
      if (!name) throw new InvalidNameError()
      const group: TagGroup = { id: this.newId(), userId: this.userId, name }
      await this.db.groups.add(group)
      return group
    })
  }

  renameGroup(groupId: string, rawName: string): Promise<void> {
    return this.scoped('rw', async () => {
      await this.ownGroup(groupId)
      const name = normalizeGroupName(rawName)
      if (!name) throw new InvalidNameError()
      await this.db.groups.update(groupId, { name })
    })
  }

  deleteGroup(groupId: string): Promise<void> {
    return this.scoped('rw', async () => {
      await this.ownGroup(groupId)
      await this.db.tags.where('[userId+groupId]').equals([this.userId, groupId]).modify({ groupId: null })
      await this.db.groups.delete(groupId)
    })
  }
}
