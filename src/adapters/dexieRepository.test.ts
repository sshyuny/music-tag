import type { SearchResult } from '../domain/types'
import { DuplicateTagNameError, InvalidNameError } from '../ports/SongRepository'
import { DexieSongRepository } from './dexieRepository'

const result: SearchResult = {
  trackId: 1,
  originalTitle: 'Through the Night',
  artistName: 'IU',
  albumName: 'Palette',
  artworkUrl: null,
  releaseDate: '2017-03-24T12:00:00Z',
}

let dbName: string
let repo: DexieSongRepository
let seq: number

beforeEach(() => {
  dbName = `test-${crypto.randomUUID()}`
  seq = 0
  repo = new DexieSongRepository(dbName, () => 1000, () => `id-${++seq}`)
})

describe('songs', () => {
  it('saveSong stores with title = originalTitle and returns existing on resave', async () => {
    const saved = await repo.saveSong(result)
    expect(saved).toMatchObject({ trackId: 1, title: 'Through the Night', tagIds: [], addedAt: 1000 })

    await repo.updateSongTitle(1, '밤편지')
    const again = await repo.saveSong(result)
    expect(again.title).toBe('밤편지')
    expect(await repo.listSongs()).toHaveLength(1)
  })

  it('updateSongTitle sets display title, blank reverts to original', async () => {
    await repo.saveSong(result)
    await repo.updateSongTitle(1, ' 밤편지 ')
    expect((await repo.listSongs())[0].title).toBe('밤편지')

    await repo.updateSongTitle(1, '  ')
    expect((await repo.listSongs())[0].title).toBe('Through the Night')
  })

  it('deleteSong removes song', async () => {
    await repo.saveSong(result)
    await repo.deleteSong(1)
    expect(await repo.listSongs()).toEqual([])
  })
})

describe('tags', () => {
  it('createTag returns existing tag for same key', async () => {
    const a = await repo.createTag('#Jazz')
    const b = await repo.createTag(' jazz ')
    expect(a.name).toBe('Jazz')
    expect(b.id).toBe(a.id)
    expect(await repo.listTags()).toHaveLength(1)
  })

  it('createTag rejects blank name', async () => {
    await expect(repo.createTag('#')).rejects.toBeInstanceOf(InvalidNameError)
  })

  it('addTagToSong is idempotent and touches lastUsedAt', async () => {
    await repo.saveSong(result)
    const tag = await repo.createTag('가을')
    expect(tag.lastUsedAt).toBeNull()

    await repo.addTagToSong(1, tag.id)
    await repo.addTagToSong(1, tag.id)

    expect((await repo.listSongs())[0].tagIds).toEqual([tag.id])
    expect((await repo.listTags())[0].lastUsedAt).toBe(1000)
  })

  it('removeTagFromSong detaches only that tag', async () => {
    await repo.saveSong(result)
    const a = await repo.createTag('가을')
    const b = await repo.createTag('새벽')
    await repo.addTagToSong(1, a.id)
    await repo.addTagToSong(1, b.id)

    await repo.removeTagFromSong(1, a.id)
    expect((await repo.listSongs())[0].tagIds).toEqual([b.id])
  })

  it('renameTag rejects duplicate key', async () => {
    await repo.createTag('가을')
    const summer = await repo.createTag('여름')
    await expect(repo.renameTag(summer.id, '#가을')).rejects.toBeInstanceOf(DuplicateTagNameError)
  })

  it('renameTag allows case change of itself', async () => {
    const jazz = await repo.createTag('jazz')
    await repo.renameTag(jazz.id, 'JAZZ')
    expect((await repo.listTags())[0].name).toBe('JAZZ')
  })

  it('renameTag rejects blank name', async () => {
    const jazz = await repo.createTag('jazz')
    await expect(repo.renameTag(jazz.id, ' # ')).rejects.toBeInstanceOf(InvalidNameError)
  })

  it('deleteTag removes it from songs', async () => {
    await repo.saveSong(result)
    const tag = await repo.createTag('가을')
    await repo.addTagToSong(1, tag.id)

    await repo.deleteTag(tag.id)

    expect(await repo.listTags()).toEqual([])
    expect((await repo.listSongs())[0].tagIds).toEqual([])
  })
})

describe('groups', () => {
  it('creates, renames and assigns groups', async () => {
    const group = await repo.createGroup(' 계절 ')
    await repo.renameGroup(group.id, '계절·시간대')
    const tag = await repo.createTag('가을')
    await repo.setTagGroup(tag.id, group.id)

    expect(await repo.listGroups()).toEqual([{ id: group.id, name: '계절·시간대' }])
    expect((await repo.listTags())[0].groupId).toBe(group.id)
  })

  it('createGroup rejects blank name', async () => {
    await expect(repo.createGroup('  ')).rejects.toBeInstanceOf(InvalidNameError)
  })

  it('deleteGroup ungroups its tags', async () => {
    const group = await repo.createGroup('계절')
    const tag = await repo.createTag('가을')
    await repo.setTagGroup(tag.id, group.id)

    await repo.deleteGroup(group.id)

    expect(await repo.listGroups()).toEqual([])
    expect((await repo.listTags())[0].groupId).toBeNull()
  })
})

it('persists across instances with same dbName', async () => {
  await repo.saveSong(result)
  const other = new DexieSongRepository(dbName)
  expect(await other.listSongs()).toHaveLength(1)
})
