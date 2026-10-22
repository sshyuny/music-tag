import { browsableTags, dimmedTagIds, filterSongs, tagSongCounts } from './filter'
import type { Song, Tag } from './types'

const tag = (id: string, groupId: string | null): Tag => ({ id, name: id, groupId, lastUsedAt: null })
const song = (trackId: number, tagIds: string[]): Song => ({
  trackId,
  title: `s${trackId}`,
  originalTitle: `s${trackId}`,
  artistName: 'a',
  albumName: null,
  artworkUrl: null,
  releaseDate: null,
  tagIds,
  addedAt: trackId,
})
const ids = (s: Song[]) => s.map((x) => x.trackId)

const tags = [tag('summer', 'season'), tag('autumn', 'season'), tag('jazz', 'genre'), tag('dawn', null), tag('rain', null)]
const songs = [song(1, ['autumn', 'dawn']), song(2, ['autumn']), song(3, ['summer', 'jazz']), song(4, ['rain'])]

describe('filterSongs', () => {
  it('returns all songs newest first when nothing selected', () => {
    expect(ids(filterSongs(songs, tags, new Set()))).toEqual([4, 3, 2, 1])
  })

  it('ORs within the same group', () => {
    expect(ids(filterSongs(songs, tags, new Set(['summer', 'autumn'])))).toEqual([3, 2, 1])
  })

  it('ANDs across groups', () => {
    expect(ids(filterSongs(songs, tags, new Set(['summer', 'autumn', 'jazz'])))).toEqual([3])
  })

  it('treats ungrouped tags as their own group', () => {
    expect(ids(filterSongs(songs, tags, new Set(['summer', 'autumn', 'dawn'])))).toEqual([1])
  })

  it('ignores selected ids that no longer exist', () => {
    expect(ids(filterSongs(songs, tags, new Set(['deleted-id', 'jazz'])))).toEqual([3])
  })
})

describe('dimmedTagIds', () => {
  it('returns nothing when nothing selected', () => {
    expect(dimmedTagIds(songs, tags, new Set()).size).toBe(0)
  })

  it('does not dim tags in an already-selected group', () => {
    expect(dimmedTagIds(songs, tags, new Set(['summer'])).has('autumn')).toBe(false)
  })

  it('dims cross-group tags that would yield zero songs', () => {
    const dimmed = dimmedTagIds(songs, tags, new Set(['summer']))
    expect(dimmed.has('dawn')).toBe(true)
    expect(dimmed.has('jazz')).toBe(false)
  })
})

describe('browsableTags', () => {
  it('hides tags with zero songs', () => {
    const extra = [...tags, { id: 'empty', name: '빈태그', groupId: null, lastUsedAt: null }]
    expect(browsableTags(songs, extra).map((t) => t.id)).not.toContain('empty')
  })
})

describe('tagSongCounts', () => {
  it('counts songs per tag', () => {
    const counts = tagSongCounts(songs)
    expect(counts.get('autumn')).toBe(2)
    expect(counts.get('jazz')).toBe(1)
    expect(counts.get('nope')).toBeUndefined()
  })
})
