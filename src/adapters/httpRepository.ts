import type { SearchResult, Song, Tag, TagGroup } from '../domain/types'
import { DuplicateTagNameError, InvalidNameError, InvalidReferenceError, type SongRepository } from '../ports/SongRepository'

export class HttpSongRepository implements SongRepository {
  private readonly baseUrl: string
  private readonly fetchApi: typeof fetch
  constructor(baseUrl = '/api', fetchApi: typeof fetch = fetch.bind(globalThis)) {
    this.baseUrl = baseUrl
    this.fetchApi = fetchApi
  }
  private async request<T = void>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await this.fetchApi(`${this.baseUrl}${path}`, {
      method,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => null) as { code?: string; message?: string } | null
      if (error?.code === 'INVALID_NAME') throw new InvalidNameError()
      if (error?.code === 'INVALID_REFERENCE') throw new InvalidReferenceError()
      if (error?.code === 'DUPLICATE_TAG_NAME') throw new DuplicateTagNameError(typeof body === 'object' && body !== null && 'name' in body ? String(body.name) : '')
      throw new Error(error?.message ?? `서버 요청에 실패했어요. (${response.status})`)
    }
    return response.status === 204 ? undefined as T : response.json() as Promise<T>
  }
  listSongs() { return this.request<Song[]>('/songs') }
  saveSong(result: SearchResult) { return this.request<Song>('/songs', 'POST', result) }
  updateSongTitle(trackId: number, title: string) { return this.request(`/songs/${trackId}`, 'PATCH', { title }) }
  addTagToSong(trackId: number, tagId: string) { return this.request(`/songs/${trackId}/tags/${encodeURIComponent(tagId)}`, 'PUT') }
  removeTagFromSong(trackId: number, tagId: string) { return this.request(`/songs/${trackId}/tags/${encodeURIComponent(tagId)}`, 'DELETE') }
  listTags() { return this.request<Tag[]>('/tags') }
  createTag(name: string) { return this.request<Tag>('/tags', 'POST', { name }) }
  renameTag(id: string, name: string) { return this.request(`/tags/${encodeURIComponent(id)}`, 'PATCH', { name }) }
  deleteTag(id: string) { return this.request(`/tags/${encodeURIComponent(id)}`, 'DELETE') }
  setTagGroup(id: string, groupId: string | null) { return this.request(`/tags/${encodeURIComponent(id)}/group`, 'PUT', { groupId }) }
  listGroups() { return this.request<TagGroup[]>('/groups') }
  createGroup(name: string) { return this.request<TagGroup>('/groups', 'POST', { name }) }
  renameGroup(id: string, name: string) { return this.request(`/groups/${encodeURIComponent(id)}`, 'PATCH', { name }) }
  deleteGroup(id: string) { return this.request(`/groups/${encodeURIComponent(id)}`, 'DELETE') }
}
