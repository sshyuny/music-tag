import type { Mock } from 'vitest'
import { DexieSongRepository } from '../adapters/dexieRepository'
import type { SearchResult } from '../domain/types'
import type { Player } from '../ports/Player'
import type { SongSearch } from '../ports/SongSearch'
import type { AppDeps } from '../ui/AppContext'

/** 시계는 호출할 때마다 1씩 늘어나서 저장 순서가 addedAt 순서와 같다 */
export const freshRepo = () => {
  let t = 0
  return new DexieSongRepository(`test-${crypto.randomUUID()}`, () => ++t)
}

export const searchResult = (trackId: number, originalTitle: string, artistName = 'IU'): SearchResult => ({
  trackId,
  originalTitle,
  artistName,
  albumName: null,
  artworkUrl: null,
  releaseDate: null,
})

export const fakeSearch = (impl: SongSearch['search'] = async () => []): { search: Mock<SongSearch['search']> } => ({
  search: vi.fn(impl),
})

export const fakePlayer = (): { play: Mock<Player['play']> } => ({ play: vi.fn<Player['play']>() })

export const testDeps = (overrides: Partial<AppDeps> = {}): AppDeps => ({
  repo: freshRepo(),
  search: fakeSearch(),
  player: fakePlayer(),
  ...overrides,
})
