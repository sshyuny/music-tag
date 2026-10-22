import type { SearchResult } from '../domain/types'

export interface SongSearch {
  search(term: string, signal?: AbortSignal): Promise<SearchResult[]>
}

export class SearchError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SearchError'
  }
}
