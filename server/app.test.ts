// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app'
import { searchResult } from './testFixtures'
let app: FastifyInstance
let db: DatabaseSync
beforeEach(() => { db = new DatabaseSync(':memory:'); app = buildApp(db) })
afterEach(async () => { await app.close(); db.close() })
const request = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT', url: string, payload?: object) => app.inject({ method, url: `/api${url}`, ...(payload === undefined ? {} : { payload }) })
it('supports song, tag, group and mapping workflows through HTTP', async () => {
  expect((await request('POST', '/songs', searchResult)).json()).toMatchObject({ title: '밤편지', tagIds: [] })
  const tag = (await request('POST', '/tags', { name: '가을' })).json()
  const group = (await request('POST', '/groups', { name: '계절' })).json()
  expect((await request('PUT', `/tags/${tag.id}/group`, { groupId: group.id })).statusCode).toBe(204)
  await request('PUT', `/songs/1/tags/${tag.id}`)
  await request('PATCH', '/songs/1', { title: '밤' })
  expect((await request('GET', '/songs')).json()[0]).toMatchObject({ title: '밤', tagIds: [tag.id] })
  expect((await request('GET', '/tags')).json()[0]).toMatchObject({ groupId: group.id, lastUsedAt: expect.any(Number) })
  await request('PATCH', `/tags/${tag.id}`, { name: '새벽' })
  await request('PATCH', `/groups/${group.id}`, { name: '시간' })
  expect((await request('GET', '/groups')).json()[0].name).toBe('시간')
  await request('DELETE', `/songs/1/tags/${tag.id}`)
  expect((await request('GET', '/songs')).json()[0].tagIds).toEqual([])
  await request('PUT', `/songs/1/tags/${tag.id}`)
  await request('DELETE', `/groups/${group.id}`)
  expect((await request('GET', '/tags')).json()[0].groupId).toBeNull()
  await request('DELETE', `/tags/${tag.id}`)
  expect((await request('GET', '/tags')).json()).toEqual([])
  expect((await request('GET', '/songs')).json()[0].tagIds).toEqual([])
})
it('returns stable domain error codes', async () => {
  expect((await request('POST', '/tags', { name: '#' })).json()).toMatchObject({ code: 'INVALID_NAME' })
  expect((await request('PATCH', '/songs/999', { title: 'x' })).statusCode).toBe(404)
  await request('POST', '/tags', { name: '가을' })
  const tag = (await request('POST', '/tags', { name: '봄' })).json()
  const response = await request('PATCH', `/tags/${tag.id}`, { name: '가을' })
  expect(response.statusCode).toBe(409)
  expect(response.json()).toMatchObject({ code: 'DUPLICATE_TAG_NAME' })
})
it.each([
  ['POST', '/songs', { ...searchResult, trackId: -1 }],
  ['POST', '/songs', { trackId: 1 }],
  ['POST', '/tags', {}],
  ['POST', '/tags', { name: 123 }],
  ['POST', '/tags', { name: 'a', userId: 'other' }],
  ['PATCH', '/songs/nope', { title: 'x' }],
  ['PATCH', '/songs/1.5', { title: 'x' }],
  ['PUT', '/tags/a/group', {}],
] as const)('rejects malformed %s %s without writing', async (method, url, payload) => {
  expect((await request(method, url, payload)).statusCode).toBe(400)
  expect((await request('GET', '/songs')).json()).toEqual([])
  expect((await request('GET', '/tags')).json()).toEqual([])
})
it('does not let clients choose the current user', async () => {
  db.prepare('INSERT INTO users VALUES (?, ?)').run('other', '다른 사용자')
  const response = await app.inject({ method: 'POST', url: '/api/tags?userId=other', headers: { 'x-user-id': 'other' }, payload: { name: '가을' } })
  expect(response.json().userId).toBe('default')
})
it('hides internal database errors', async () => {
  db.exec('DROP TABLE songTags')
  const response = await request('GET', '/songs')
  expect(response.statusCode).toBe(500)
  expect(response.json()).toEqual({ code: 'INTERNAL_ERROR', message: '서버에서 데이터를 처리하지 못했어요.' })
})
