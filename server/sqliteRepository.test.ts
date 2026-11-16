// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { searchResult } from './testFixtures'
import { DuplicateTagNameError, InvalidNameError, InvalidReferenceError } from '../src/ports/SongRepository'
import { SqliteSongRepository } from './sqliteRepository'

let directory: string
let path: string
let db: DatabaseSync
let repo: SqliteSongRepository
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'music-tag-'))
  path = join(directory, 'music.sqlite')
  db = new DatabaseSync(path)
  repo = new SqliteSongRepository(db, 'default', () => 1000)
})
afterEach(() => { db.close(); rmSync(directory, { recursive: true, force: true }) })

it('stores shared songs once and preserves edited titles on resave', async () => {
  expect(await repo.saveSong(searchResult)).toMatchObject({ title: '밤편지', tagIds: [], addedAt: 1000 })
  await repo.updateSongTitle(1, ' 밤 ')
  expect((await repo.saveSong(searchResult)).title).toBe('밤')
  expect(await repo.listSongs()).toHaveLength(1)
  await repo.updateSongTitle(1, '  ')
  expect((await repo.listSongs())[0].title).toBe('밤편지')
  expect(db.prepare('SELECT * FROM songs').get()).not.toHaveProperty('tagIds')
})
it('normalizes tag names, returns existing tags and rejects conflicting renames', async () => {
  const jazz = await repo.createTag(' #Jazz  ')
  expect((await repo.createTag('jazz')).id).toBe(jazz.id)
  await repo.renameTag(jazz.id, 'JAZZ')
  const other = await repo.createTag('가을')
  await expect(repo.renameTag(other.id, 'jazz')).rejects.toBeInstanceOf(DuplicateTagNameError)
  for (const action of [repo.createTag('#'), repo.renameTag(jazz.id, ' # '), repo.createGroup(' '), repo.renameGroup((await repo.createGroup('계절')).id, ' ')]) {
    await expect(action).rejects.toBeInstanceOf(InvalidNameError)
  }
})
it('attaches idempotently, updates recent usage and detaches', async () => {
  await repo.saveSong(searchResult)
  const tag = await repo.createTag('가을')
  await repo.addTagToSong(1, tag.id)
  await repo.addTagToSong(1, tag.id)
  expect((await repo.listSongs())[0].tagIds).toEqual([tag.id])
  expect((await repo.listTags())[0].lastUsedAt).toBe(1000)
  await repo.removeTagFromSong(1, tag.id)
  expect((await repo.listSongs())[0].tagIds).toEqual([])
})
it('renames groups and cleans up group and tag references on deletion', async () => {
  await repo.saveSong(searchResult)
  const tag = await repo.createTag('가을')
  const group = await repo.createGroup(' 계절  그룹 ')
  await repo.renameGroup(group.id, '계절')
  await repo.setTagGroup(tag.id, group.id)
  await repo.addTagToSong(1, tag.id)
  expect(await repo.listGroups()).toEqual([{ ...group, name: '계절' }])
  await repo.deleteGroup(group.id)
  expect((await repo.listTags())[0].groupId).toBeNull()
  await repo.deleteTag(tag.id)
  expect(await repo.listTags()).toEqual([])
  expect((await repo.listSongs())[0].tagIds).toEqual([])
})
it('isolates user data while sharing songs and titles', async () => {
  db.prepare('INSERT INTO users VALUES (?, ?)').run('other', '다른 사용자')
  const other = new SqliteSongRepository(db, 'other')
  await repo.saveSong(searchResult)
  const a = await repo.createTag('가을')
  const b = await other.createTag('가을')
  const group = await other.createGroup('계절')
  await other.setTagGroup(b.id, group.id)
  await other.addTagToSong(1, b.id)
  for (const action of [repo.renameTag(b.id, '변경'), repo.deleteTag(b.id), repo.setTagGroup(b.id, null), repo.setTagGroup(a.id, group.id), repo.addTagToSong(1, b.id), repo.removeTagFromSong(1, b.id), repo.renameGroup(group.id, '변경'), repo.deleteGroup(group.id)]) {
    await expect(action).rejects.toBeInstanceOf(InvalidReferenceError)
  }
  expect((await repo.listSongs())[0].tagIds).toEqual([])
  expect((await other.listSongs())[0].tagIds).toEqual([b.id])
  await other.updateSongTitle(1, '변경')
  expect((await repo.listSongs())[0].title).toBe('변경')
  await repo.deleteTag(a.id)
  expect((await other.listTags())[0]).toMatchObject({ name: '가을', groupId: group.id })
})
it('rejects missing references and unknown users without changing data', async () => {
  const tag = await repo.createTag('가을')
  for (const action of [repo.addTagToSong(9, tag.id), repo.updateSongTitle(9, 'x'), repo.renameTag('missing', 'x'), repo.deleteGroup('missing'), repo.setTagGroup(tag.id, 'missing')]) {
    await expect(action).rejects.toBeInstanceOf(InvalidReferenceError)
  }
  expect((await repo.listTags())[0].lastUsedAt).toBeNull()
  const unknown = new SqliteSongRepository(db, 'unknown')
  for (const action of [unknown.listSongs(), unknown.listTags(), unknown.listGroups(), unknown.saveSong(searchResult), unknown.createTag('x'), unknown.createGroup('x')]) {
    await expect(action).rejects.toBeInstanceOf(InvalidReferenceError)
  }
})
it('rolls back attachment when updating recent usage fails', async () => {
  await repo.saveSong(searchResult)
  const tag = await repo.createTag('가을')
  db.exec("CREATE TRIGGER fail_touch BEFORE UPDATE OF lastUsedAt ON tags BEGIN SELECT RAISE(ABORT, 'test failure'); END")
  await expect(repo.addTagToSong(1, tag.id)).rejects.toThrow('test failure')
  expect((await repo.listSongs())[0].tagIds).toEqual([])
  expect((await repo.listTags())[0].lastUsedAt).toBeNull()
})
it('enforces foreign keys, ownership and unique tag names at DB level', async () => {
  const tag = await repo.createTag('가을')
  expect(() => db.prepare('INSERT INTO tags SELECT ?, userId, name, nameKey, groupId, lastUsedAt FROM tags WHERE id = ?').run('duplicate', tag.id)).toThrow()
  expect(() => db.prepare('INSERT INTO songTags VALUES (?, ?, ?)').run('default', 9, tag.id)).toThrow()
  db.prepare('INSERT INTO users VALUES (?, ?)').run('other', '다른 사용자')
  await repo.saveSong(searchResult)
  expect(() => db.prepare('INSERT INTO songTags VALUES (?, ?, ?)').run('other', 1, tag.id)).toThrow()
})
it('reopens a migrated DB without losing data or duplicating the default user', async () => {
  await repo.saveSong(searchResult)
  const tag = await repo.createTag('가을')
  const group = await repo.createGroup('계절')
  await repo.setTagGroup(tag.id, group.id)
  await repo.addTagToSong(1, tag.id)
  db.close()
  db = new DatabaseSync(path)
  repo = new SqliteSongRepository(db)
  expect((await repo.listSongs())[0].tagIds).toEqual([tag.id])
  expect((await repo.listTags())[0].groupId).toBe(group.id)
  expect(db.prepare('SELECT * FROM users').all()).toHaveLength(1)
  expect(db.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: 1 })
})
it('refuses a newer schema without overwriting it', () => {
  db.exec('PRAGMA user_version = 99')
  expect(() => new SqliteSongRepository(db)).toThrow(/schema|스키마/i)
  expect(db.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: 99 })
})
