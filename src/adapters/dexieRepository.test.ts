import { Dexie } from 'dexie'
import type { SearchResult } from '../domain/types'
import { DuplicateTagNameError, InvalidNameError, InvalidReferenceError } from '../ports/SongRepository'
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

  it('does not expose shared song deletion', () => {
    expect(repo).not.toHaveProperty('deleteSong')
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

    expect(await repo.listGroups()).toEqual([{ id: group.id, userId: 'default', name: '계절·시간대' }])
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

// Inspect persisted records separately from the user-specific query results.
const inspectDb = async () => {
  await repo.listSongs()
  const db = new Dexie(dbName)
  await db.open()
  return db
}

const secondUser = async () => {
  const db = await inspectDb()
  try {
    await db.table('users').put({ id: 'other', name: '다른 사용자' })
  } finally {
    db.close()
  }
  return new DexieSongRepository(dbName, () => 2000, () => crypto.randomUUID(), 'other')
}

describe('normalized storage and users', () => {
  it('stores song-tag links in a table, never on the song record', async () => {
    await repo.saveSong(result)
    const tag = await repo.createTag('가을')
    await repo.addTagToSong(1, tag.id)
    await repo.addTagToSong(1, tag.id)
    const db = await inspectDb()
    try {
      expect(await db.table('songs').get(1)).not.toHaveProperty('tagIds')
      expect(await db.table('songTags').toArray()).toEqual([
        { userId: 'default', trackId: 1, tagId: tag.id },
      ])
      expect(await db.table('tags').get(tag.id)).toMatchObject({ userId: 'default', nameKey: '가을' })
    } finally {
      db.close()
    }
  })

  it('creates the default user once and persists across instances', async () => {
    const db = await inspectDb()
    try {
      expect(await db.table('users').toArray()).toEqual([{ id: 'default', name: '기본 사용자' }])
      await new DexieSongRepository(dbName).listSongs()
      expect(await db.table('users').count()).toBe(1)
    } finally {
      db.close()
    }
  })

  it('shares songs and titles but isolates tags, groups, counts and mappings', async () => {
    const other = await secondUser()
    await repo.saveSong(result)
    await repo.saveSong({ ...result, trackId: 2 })
    const a = await repo.createTag('Jazz')
    const b = await other.createTag('jazz')
    const ga = await repo.createGroup('계절')
    const gb = await other.createGroup('계절')
    await repo.setTagGroup(a.id, ga.id)
    await other.setTagGroup(b.id, gb.id)
    await repo.addTagToSong(1, a.id)
    await other.addTagToSong(2, b.id)
    expect(await repo.listTags()).toEqual([expect.objectContaining({ id: a.id, groupId: ga.id, lastUsedAt: 1000 })])
    expect(await other.listTags()).toEqual([expect.objectContaining({ id: b.id, groupId: gb.id, lastUsedAt: 2000 })])
    expect((await repo.listSongs()).map(s => s.tagIds)).toEqual([[a.id], []])
    expect((await other.listSongs()).map(s => s.tagIds)).toEqual([[], [b.id]])
    expect(await repo.listGroups()).toHaveLength(1)
    expect((await other.listGroups())[0].id).toBe(gb.id)
    await other.updateSongTitle(1, '밤편지')
    expect((await repo.listSongs())[0].title).toBe('밤편지')
    expect((await other.saveSong(result)).tagIds).toEqual([])
    await repo.deleteGroup(ga.id)
    await repo.deleteTag(a.id)
    expect((await other.listTags())[0]).toMatchObject({ id: b.id, groupId: gb.id, lastUsedAt: 2000 })
    expect((await other.listSongs())[1].tagIds).toEqual([b.id])
  })

  it('does not allow duplicate normalized tag keys even in concurrent writes', async () => {
    const [a, b] = await Promise.all([repo.createTag('Jazz'), repo.createTag('#jazz')])
    expect(a.id).toBe(b.id)
    const tag = await repo.createTag('가을')
    const db = await inspectDb()
    try {
      await expect(db.table('tags').add({ ...tag, id: 'duplicate' })).rejects.toMatchObject({ name: 'ConstraintError' })
    } finally {
      db.close()
    }
  })

  it.each(['renameTag', 'deleteTag', 'setTagGroup', 'addTagToSong', 'removeTagFromSong'] as const)(
    'rejects %s using another user’s tag without changing anything', async (method) => {
      const other = await secondUser()
      await repo.saveSong(result)
      const tag = await other.createTag('가을')
      await other.addTagToSong(1, tag.id)
      const operation = method === 'renameTag' ? repo.renameTag(tag.id, '변경')
        : method === 'deleteTag' ? repo.deleteTag(tag.id)
        : method === 'setTagGroup' ? repo.setTagGroup(tag.id, null)
        : repo[method](1, tag.id)
      await expect(operation).rejects.toBeInstanceOf(InvalidReferenceError)
      expect((await other.listTags())[0]).toMatchObject({ name: '가을', lastUsedAt: 2000 })
      expect((await other.listSongs())[0].tagIds).toEqual([tag.id])
    },
  )

  it('rejects foreign or missing groups and preserves the previous assignment', async () => {
    const other = await secondUser()
    const tag = await repo.createTag('가을')
    const own = await repo.createGroup('계절')
    const foreign = await other.createGroup('분위기')
    await repo.setTagGroup(tag.id, own.id)
    await expect(repo.setTagGroup(tag.id, foreign.id)).rejects.toBeInstanceOf(InvalidReferenceError)
    await expect(repo.setTagGroup(tag.id, 'missing')).rejects.toBeInstanceOf(InvalidReferenceError)
    await expect(repo.renameGroup(foreign.id, '변경')).rejects.toBeInstanceOf(InvalidReferenceError)
    await expect(repo.deleteGroup(foreign.id)).rejects.toBeInstanceOf(InvalidReferenceError)
    expect((await repo.listTags())[0].groupId).toBe(own.id)
    expect((await other.listGroups())[0].name).toBe('분위기')
    const next = await repo.createGroup('시간대')
    await repo.setTagGroup(tag.id, next.id)
    expect((await repo.listTags())[0].groupId).toBe(next.id)
    await repo.setTagGroup(tag.id, null)
    expect((await repo.listTags())[0].groupId).toBeNull()
  })

  it('rejects missing references without touching lastUsedAt', async () => {
    const tag = await repo.createTag('가을')
    await expect(repo.addTagToSong(999, tag.id)).rejects.toBeInstanceOf(InvalidReferenceError)
    expect((await repo.listTags())[0].lastUsedAt).toBeNull()
    await repo.saveSong(result)
    await expect(repo.addTagToSong(1, 'missing')).rejects.toBeInstanceOf(InvalidReferenceError)
    await expect(repo.removeTagFromSong(1, 'missing')).rejects.toBeInstanceOf(InvalidReferenceError)
    await expect(repo.renameTag('missing', '가을')).rejects.toBeInstanceOf(InvalidReferenceError)
    await expect(repo.deleteGroup('missing')).rejects.toBeInstanceOf(InvalidReferenceError)
    await expect(repo.updateSongTitle(999, '제목')).rejects.toBeInstanceOf(InvalidReferenceError)
    expect((await repo.listSongs())[0].tagIds).toEqual([])
  })

  it('rejects reads and writes for an unknown user', async () => {
    const unknown = new DexieSongRepository(dbName, Date.now, crypto.randomUUID, 'missing')
    await expect(unknown.listSongs()).rejects.toBeInstanceOf(InvalidReferenceError)
    await expect(unknown.listTags()).rejects.toBeInstanceOf(InvalidReferenceError)
    await expect(unknown.listGroups()).rejects.toBeInstanceOf(InvalidReferenceError)
    await expect(unknown.createTag('가을')).rejects.toBeInstanceOf(InvalidReferenceError)
    await expect(unknown.createGroup('계절')).rejects.toBeInstanceOf(InvalidReferenceError)
    await expect(unknown.saveSong(result)).rejects.toBeInstanceOf(InvalidReferenceError)
  })
})
