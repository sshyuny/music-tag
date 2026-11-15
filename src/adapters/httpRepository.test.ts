// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { buildApp } from '../../server/app'
import { searchResult } from '../../server/testFixtures'
import { DuplicateTagNameError, InvalidNameError, InvalidReferenceError } from '../ports/SongRepository'
import { HttpSongRepository } from './httpRepository'

it('implements the repository contract over HTTP, including domain errors', async () => {
  const db = new DatabaseSync(':memory:')
  const app = buildApp(db)
  const fetchApi: typeof fetch = async (input, init) => {
    const response = await app.inject({ method: init?.method as 'GET', url: String(input), headers: init?.headers as Record<string, string>, ...(init?.body ? { payload: String(init.body) } : {}) })
    return new Response(response.statusCode === 204 ? null : response.body, { status: response.statusCode })
  }
  const repo = new HttpSongRepository('/api', fetchApi)
  try {
    await repo.saveSong(searchResult)
    await repo.updateSongTitle(1, '밤')
    const tag = await repo.createTag('가을')
    const group = await repo.createGroup('계절')
    await repo.setTagGroup(tag.id, group.id)
    await repo.addTagToSong(1, tag.id)
    expect((await repo.listSongs())[0]).toMatchObject({ title: '밤', tagIds: [tag.id] })
    expect((await repo.listTags())[0].groupId).toBe(group.id)
    await repo.renameTag(tag.id, '새벽')
    await repo.renameGroup(group.id, '시간')
    expect((await repo.listGroups())[0].name).toBe('시간')
    await repo.removeTagFromSong(1, tag.id)
    expect((await repo.listSongs())[0].tagIds).toEqual([])
    await repo.deleteGroup(group.id)
    expect((await repo.listTags())[0].groupId).toBeNull()
    await repo.createTag('가을')
    await expect(repo.renameTag(tag.id, '가을')).rejects.toBeInstanceOf(DuplicateTagNameError)
    await expect(repo.createTag('#')).rejects.toBeInstanceOf(InvalidNameError)
    await expect(repo.updateSongTitle(999, 'x')).rejects.toBeInstanceOf(InvalidReferenceError)
    await repo.deleteTag(tag.id)
    expect(await repo.listTags()).toHaveLength(1)
  } finally { await app.close(); db.close() }
})
it('rejects network, non-JSON and server failures without treating them as success', async () => {
  for (const fetchApi of [
    async () => { throw new TypeError('offline') },
    async () => new Response('Bad Gateway', { status: 502 }),
    async () => new Response(JSON.stringify({ code: 'INTERNAL_ERROR', message: 'failed' }), { status: 500 }),
  ]) {
    await expect(new HttpSongRepository('/api', fetchApi).listSongs()).rejects.toThrow()
  }
})
it('encodes IDs in paths', async () => {
  const fetchApi = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }))
  await new HttpSongRepository('/api', fetchApi).deleteTag('a/b?#')
  expect(fetchApi.mock.calls[0][0]).toBe('/api/tags/a%2Fb%3F%23')
})

it('calls the browser fetch with its global receiver for reads and writes', async () => {
  const fetchApi: typeof fetch = async function (this: unknown, _input, init) {
    if (this !== globalThis) throw new TypeError('Illegal invocation')
    return new Response(JSON.stringify(init?.method === 'POST' ? { ...searchResult, title: searchResult.originalTitle, tagIds: [] } : []))
  }
  vi.stubGlobal('fetch', fetchApi)
  try {
    const repo = new HttpSongRepository()
    await expect(repo.listSongs()).resolves.toEqual([])
    await expect(repo.saveSong(searchResult)).resolves.toMatchObject({ trackId: searchResult.trackId })
  } finally {
    vi.unstubAllGlobals()
  }
})
