import { cleanText } from '../domain/searchText'
import type { SearchResult } from '../domain/types'
import { SearchError, type SongSearch } from '../ports/SongSearch'

interface ItunesItem {
  kind?: string
  trackId: number
  trackName: string
  artistName: string
  collectionName?: string
  artworkUrl100?: string
  releaseDate?: string
}

// KR 스토어는 곡 검색 결과가 0건이라 US로 고정한다
const BASE_URL = 'https://itunes.apple.com/search'
const LIMIT = 25

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

export class ItunesSongSearch implements SongSearch {
  private readonly fetchFn: typeof fetch

  constructor(fetchFn: typeof fetch = fetch.bind(globalThis)) {
    this.fetchFn = fetchFn
  }

  async search(term: string, signal?: AbortSignal): Promise<SearchResult[]> {
    const trimmed = term.trim()
    if (!trimmed) return []

    const url = `${BASE_URL}?term=${encodeURIComponent(trimmed)}&country=US&media=music&entity=song&limit=${LIMIT}`
    let res: Response
    try {
      res = await this.fetchFn(url, { signal })
    } catch (e) {
      if (isAbort(e)) throw e
      throw new SearchError('iTunes 요청 실패', { cause: e })
    }
    if (!res.ok) throw new SearchError(`iTunes 응답 오류 ${res.status}`)

    const body = (await res.json()) as { results: ItunesItem[] }
    return body.results.filter((item) => item.kind === 'song').map(toSearchResult)
  }
}

function toSearchResult(item: ItunesItem): SearchResult {
  return {
    trackId: item.trackId,
    originalTitle: cleanText(item.trackName),
    artistName: cleanText(item.artistName),
    albumName: item.collectionName ? cleanText(item.collectionName) : null,
    artworkUrl: item.artworkUrl100 ?? null,
    releaseDate: item.releaseDate ?? null,
  }
}
