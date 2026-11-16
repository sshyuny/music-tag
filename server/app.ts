import Fastify from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import type { SearchResult } from '../src/domain/types'
import { DuplicateTagNameError, InvalidNameError, InvalidReferenceError } from '../src/ports/SongRepository'
import { SqliteSongRepository } from './sqliteRepository'

const string = { type: 'string' }
const id = { type: 'string', minLength: 1, maxLength: 200 }
const trackId = { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER }
const object = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const nameBody = object({ name: string })
const pathTrackId = { type: 'string', pattern: '^[1-9][0-9]{0,14}$' }
const songParams = object({ trackId: pathTrackId })
const idParams = object({ id })
const linkParams = object({ trackId: pathTrackId, tagId: id })

export function buildApp(db: DatabaseSync, logger = false) {
  const repo = new SqliteSongRepository(db)
  const app = Fastify({ logger, ajv: { customOptions: { removeAdditional: false, coerceTypes: false } } })
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DuplicateTagNameError) return reply.code(409).send({ code: 'DUPLICATE_TAG_NAME', message: error.message })
    if (error instanceof InvalidNameError) return reply.code(400).send({ code: 'INVALID_NAME', message: error.message })
    if (error instanceof InvalidReferenceError) return reply.code(404).send({ code: 'INVALID_REFERENCE', message: error.message })
    const statusCode = error instanceof Error && 'statusCode' in error ? Number(error.statusCode) : 500
    if (statusCode >= 400 && statusCode < 500) return reply.code(statusCode).send({ code: 'INVALID_REQUEST', message: '잘못된 요청입니다.' })
    request.log.error(error)
    return reply.code(500).send({ code: 'INTERNAL_ERROR', message: '서버에서 데이터를 처리하지 못했어요.' })
  })
  app.get('/api/songs', () => repo.listSongs())
  app.post<{ Body: SearchResult }>('/api/songs', { schema: { body: object({
    trackId, originalTitle: string, artistName: string,
    albumName: { type: ['string', 'null'] }, artworkUrl: { type: ['string', 'null'] }, releaseDate: { type: ['string', 'null'] },
  }) } }, request => repo.saveSong(request.body))
  app.patch<{ Params: { trackId: string }; Body: { title: string } }>('/api/songs/:trackId', { schema: { params: songParams, body: object({ title: string }) } }, async (request, reply) => {
    await repo.updateSongTitle(Number(request.params.trackId), request.body.title)
    return reply.code(204).send()
  })
  app.put<{ Params: { trackId: string; tagId: string } }>('/api/songs/:trackId/tags/:tagId', { schema: { params: linkParams } }, async (request, reply) => {
    await repo.addTagToSong(Number(request.params.trackId), request.params.tagId)
    return reply.code(204).send()
  })
  app.delete<{ Params: { trackId: string; tagId: string } }>('/api/songs/:trackId/tags/:tagId', { schema: { params: linkParams } }, async (request, reply) => {
    await repo.removeTagFromSong(Number(request.params.trackId), request.params.tagId)
    return reply.code(204).send()
  })
  app.get('/api/tags', () => repo.listTags())
  app.get('/api/groups', () => repo.listGroups())
  for (const resource of ['tags', 'groups'] as const) {
    app.post<{ Body: { name: string } }>(`/api/${resource}`, { schema: { body: nameBody } }, request =>
      resource === 'tags' ? repo.createTag(request.body.name) : repo.createGroup(request.body.name))
    app.patch<{ Params: { id: string }; Body: { name: string } }>(`/api/${resource}/:id`, { schema: { params: idParams, body: nameBody } }, async (request, reply) => {
      if (resource === 'tags') await repo.renameTag(request.params.id, request.body.name)
      else await repo.renameGroup(request.params.id, request.body.name)
      return reply.code(204).send()
    })
    app.delete<{ Params: { id: string } }>(`/api/${resource}/:id`, { schema: { params: idParams } }, async (request, reply) => {
      if (resource === 'tags') await repo.deleteTag(request.params.id)
      else await repo.deleteGroup(request.params.id)
      return reply.code(204).send()
    })
  }
  app.put<{ Params: { id: string }; Body: { groupId: string | null } }>('/api/tags/:id/group', {
    schema: { params: idParams, body: object({ groupId: { anyOf: [id, { type: 'null' }] } }) },
  }, async (request, reply) => {
    await repo.setTagGroup(request.params.id, request.body.groupId)
    return reply.code(204).send()
  })
  return app
}
