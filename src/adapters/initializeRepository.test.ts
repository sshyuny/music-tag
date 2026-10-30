import { Dexie } from 'dexie'
import { initializeRepository } from './initializeRepository'

it('deletes legacy data, starts empty, and preserves new data on subsequent startup', async () => {
  const legacyDbName = `legacy-${crypto.randomUUID()}`
  const dbName = `new-${crypto.randomUUID()}`
  const legacy = new Dexie(legacyDbName)
  legacy.version(1).stores({ songs: '&trackId', tags: '&id', groups: '&id' })
  await legacy.table('songs').add({ trackId: 1, tagIds: ['old-tag'] })
  await legacy.table('tags').add({ id: 'old-tag', name: '가을' })
  await legacy.table('groups').add({ id: 'old-group', name: '계절' })
  legacy.close()

  const repo = await initializeRepository({ legacyDbName, dbName })
  expect(await Dexie.exists(legacyDbName)).toBe(false)
  expect(await repo.listSongs()).toEqual([])
  expect(await repo.listTags()).toEqual([])
  expect(await repo.listGroups()).toEqual([])

  const db = new Dexie(dbName)
  await db.open()
  try {
    expect(await db.table('users').toArray()).toEqual([{ id: 'default', name: '기본 사용자' }])
  } finally {
    db.close()
  }
  await repo.saveSong({ trackId: 2, originalTitle: 'New', artistName: 'IU', albumName: null, artworkUrl: null, releaseDate: null })
  const tag = await repo.createTag('새벽')
  await repo.addTagToSong(2, tag.id)
  const reopened = await initializeRepository({ legacyDbName, dbName })
  expect(await reopened.listSongs()).toEqual([expect.objectContaining({ trackId: 2, tagIds: [tag.id] })])
  expect(await Dexie.exists(legacyDbName)).toBe(false)
})
