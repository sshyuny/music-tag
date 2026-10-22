import type { Mock } from 'vitest'
import { DexieSongRepository } from '../adapters/dexieRepository'
import type { SearchResult } from '../domain/types'
import type { Player } from '../ports/Player'
import type { SongSearch } from '../ports/SongSearch'
import type { AppDeps } from '../ui/AppContext'

export const freshRepo = () => new DexieSongRepository(`test-${crypto.randomUUID()}`)

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
