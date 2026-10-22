import { Dexie, type EntityTable } from 'dexie'
import { normalizeTagName, tagKey } from '../domain/tagName'
import type { SearchResult, Song, Tag, TagGroup } from '../domain/types'
import { DuplicateTagNameError, InvalidNameError, type SongRepository } from '../ports/SongRepository'

type MusicTagDb = Dexie & {
  songs: EntityTable<Song, 'trackId'>
  tags: EntityTable<Tag, 'id'>
  groups: EntityTable<TagGroup, 'id'>
}

const normalizeGroupName = (name: string) => name.trim().replace(/\s+/g, ' ')

export class DexieSongRepository implements SongRepository {
  private readonly db: MusicTagDb
  private readonly now: () => number
  private readonly newId: () => string

  constructor(dbName = 'music-tag', now: () => number = Date.now, newId: () => string = () => crypto.randomUUID()) {
    this.db = new Dexie(dbName) as MusicTagDb
    this.db.version(1).stores({
      songs: '&trackId, *tagIds, addedAt',
      tags: '&id, groupId',
      groups: '&id',
    })
    this.now = now
    this.newId = newId
  }

  listSongs(): Promise<Song[]> {
    return this.db.songs.toArray()
  }

  async saveSong(result: SearchResult): Promise<Song> {
    return this.db.transaction('rw', this.db.songs, async () => {
      const existing = await this.db.songs.get(result.trackId)
      if (existing) return existing
      const song: Song = { ...result, title: result.originalTitle, tagIds: [], addedAt: this.now() }
      await this.db.songs.add(song)
      return song
    })
  }

  async updateSongTitle(trackId: number, title: string): Promise<void> {
    await this.db.songs.where('trackId').equals(trackId).modify((song) => {
      song.title = title.trim() || song.originalTitle
    })
  }

  async deleteSong(trackId: number): Promise<void> {
    await this.db.songs.delete(trackId)
  }

  async addTagToSong(trackId: number, tagId: string): Promise<void> {
    await this.db.transaction('rw', this.db.songs, this.db.tags, async () => {
      await this.db.songs.where('trackId').equals(trackId).modify((song) => {
        if (!song.tagIds.includes(tagId)) song.tagIds.push(tagId)
      })
      await this.db.tags.update(tagId, { lastUsedAt: this.now() })
    })
  }

  async removeTagFromSong(trackId: number, tagId: string): Promise<void> {
    await this.db.songs.where('trackId').equals(trackId).modify((song) => {
      song.tagIds = song.tagIds.filter((id) => id !== tagId)
    })
  }

  listTags(): Promise<Tag[]> {
    return this.db.tags.toArray()
  }

  async createTag(rawName: string): Promise<Tag> {
    const name = normalizeTagName(rawName)
    if (!name) throw new InvalidNameError()
    return this.db.transaction('rw', this.db.tags, async () => {
      const key = tagKey(name)
      const existing = (await this.db.tags.toArray()).find((t) => tagKey(t.name) === key)
      if (existing) return existing
      const tag: Tag = { id: this.newId(), name, groupId: null, lastUsedAt: null }
      await this.db.tags.add(tag)
      return tag
    })
  }

  async renameTag(tagId: string, rawName: string): Promise<void> {
    const name = normalizeTagName(rawName)
    if (!name) throw new InvalidNameError()
    await this.db.transaction('rw', this.db.tags, async () => {
      const key = tagKey(name)
      const clash = (await this.db.tags.toArray()).find((t) => t.id !== tagId && tagKey(t.name) === key)
      if (clash) throw new DuplicateTagNameError(name)
      await this.db.tags.update(tagId, { name })
    })
  }

  async deleteTag(tagId: string): Promise<void> {
    await this.db.transaction('rw', this.db.songs, this.db.tags, async () => {
      await this.db.songs.where('tagIds').equals(tagId).modify((song) => {
        song.tagIds = song.tagIds.filter((id) => id !== tagId)
      })
      await this.db.tags.delete(tagId)
    })
  }

  async setTagGroup(tagId: string, groupId: string | null): Promise<void> {
    await this.db.tags.update(tagId, { groupId })
  }

  listGroups(): Promise<TagGroup[]> {
    return this.db.groups.toArray()
  }

  async createGroup(name: string): Promise<TagGroup> {
    const normalized = normalizeGroupName(name)
    if (!normalized) throw new InvalidNameError()
    const group: TagGroup = { id: this.newId(), name: normalized }
    await this.db.groups.add(group)
    return group
  }

  async renameGroup(groupId: string, name: string): Promise<void> {
    const normalized = normalizeGroupName(name)
    if (!normalized) throw new InvalidNameError()
    await this.db.groups.update(groupId, { name: normalized })
  }

  async deleteGroup(groupId: string): Promise<void> {
    await this.db.transaction('rw', this.db.tags, this.db.groups, async () => {
      await this.db.tags.where('groupId').equals(groupId).modify({ groupId: null })
      await this.db.groups.delete(groupId)
    })
  }
}
