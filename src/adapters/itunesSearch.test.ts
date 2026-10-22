import { SearchError } from '../ports/SongSearch'
import { ItunesSongSearch } from './itunesSearch'

const okResponse = (results: unknown[]) =>
  new Response(JSON.stringify({ resultCount: results.length, results }), { status: 200 })

const fakeFetch = (response: () => Response | Promise<Response>) => {
  const calls: string[] = []
  const fn = (async (input: RequestInfo | URL) => {
    calls.push(String(input))
    return response()
  }) as typeof fetch
  return { fn, calls }
}

describe('ItunesSongSearch', () => {
  it('builds US song search URL', async () => {
    const { fn, calls } = fakeFetch(() => okResponse([]))
    await new ItunesSongSearch(fn).search(' 아이유 밤편지 ')

    const url = new URL(calls[0])
    expect(url.origin + url.pathname).toBe('https://itunes.apple.com/search')
    expect(url.searchParams.get('term')).toBe('아이유 밤편지')
    expect(url.searchParams.get('country')).toBe('US')
    expect(url.searchParams.get('media')).toBe('music')
    expect(url.searchParams.get('entity')).toBe('song')
  })

  it('maps and cleans fields, drops non-songs and preview', async () => {
    const { fn } = fakeFetch(() =>
      okResponse([
        {
          kind: 'song',
          trackId: 7,
          trackName: '‎Good Night Good Dream',
          artistName: 'Nerd Connection ',
          collectionName: 'Good Night Good Dream - Single',
          artworkUrl100: 'https://img/100.jpg',
          releaseDate: '2020-03-23T12:00:00Z',
          previewUrl: 'https://audio/preview.m4a',
        },
        { kind: 'music-video', trackId: 8, trackName: 'MV', artistName: 'x' },
      ]),
    )

    const results = await new ItunesSongSearch(fn).search('좋은 밤 좋은 꿈')

    expect(results).toEqual([
      {
        trackId: 7,
        originalTitle: 'Good Night Good Dream',
        artistName: 'Nerd Connection',
        albumName: 'Good Night Good Dream - Single',
        artworkUrl: 'https://img/100.jpg',
        releaseDate: '2020-03-23T12:00:00Z',
      },
    ])
  })

  it('fills missing optional fields with null', async () => {
    const { fn } = fakeFetch(() => okResponse([{ kind: 'song', trackId: 1, trackName: 't', artistName: 'a' }]))
    const [r] = await new ItunesSongSearch(fn).search('t')
    expect(r).toMatchObject({ albumName: null, artworkUrl: null, releaseDate: null })
  })

  it('skips fetch for blank term', async () => {
    const { fn, calls } = fakeFetch(() => okResponse([]))
    expect(await new ItunesSongSearch(fn).search('   ')).toEqual([])
    expect(calls).toHaveLength(0)
  })

  it('throws SearchError on non-ok response', async () => {
    const { fn } = fakeFetch(() => new Response('', { status: 403 }))
    await expect(new ItunesSongSearch(fn).search('x')).rejects.toBeInstanceOf(SearchError)
  })

  it('throws SearchError on network failure', async () => {
    const { fn } = fakeFetch(() => Promise.reject(new TypeError('Failed to fetch')))
    await expect(new ItunesSongSearch(fn).search('x')).rejects.toBeInstanceOf(SearchError)
  })

  it('rethrows abort as-is', async () => {
    const { fn } = fakeFetch(() => Promise.reject(new DOMException('aborted', 'AbortError')))
    await expect(new ItunesSongSearch(fn).search('x')).rejects.toMatchObject({ name: 'AbortError' })
  })
})
