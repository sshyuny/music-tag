import { cleanText, isAltVersion, matchSavedSongs, rankItunesResults } from './searchText'
import type { SearchResult, Song } from './types'

const result = (trackId: number, originalTitle: string): SearchResult => ({
  trackId,
  originalTitle,
  artistName: 'IU',
  albumName: null,
  artworkUrl: null,
  releaseDate: null,
})

describe('cleanText', () => {
  it('removes invisible marks', () => {
    expect(cleanText('‎Good Night Good Dream ')).toBe('Good Night Good Dream')
    expect(cleanText('﻿a⁠b‪c')).toBe('abc')
  })
})

describe('isAltVersion', () => {
  it('detects alternate versions', () => {
    expect(isAltVersion('Through the Night [Piano]')).toBe(true)
    expect(isAltVersion('I Knew I Love (Instrumental)')).toBe(true)
    expect(isAltVersion('가끔 미치도록 네가 안고 싶어질 때가 있어 (Karaoke Verison)')).toBe(true)
    expect(isAltVersion('Every moment of you (Inst.)')).toBe(true)
  })

  it('keeps originals', () => {
    expect(isAltVersion('Through the Night')).toBe(false)
    expect(isAltVersion('Instinct')).toBe(false)
  })
})

describe('rankItunesResults', () => {
  it('drops saved songs and pushes alt versions down, keeping order', () => {
    const results = [result(1, 'Song (Instrumental)'), result(2, 'Song'), result(3, 'Song'), result(4, 'Song B')]
    expect(rankItunesResults(results, new Set([3])).map((r) => r.trackId)).toEqual([2, 4, 1])
  })
})

describe('matchSavedSongs', () => {
  const song: Song = {
    ...result(1, 'Through the Night'),
    title: '밤편지',
    tagIds: [],
    addedAt: 1,
  }

  it('matches display title, original title and artist ignoring case and spaces', () => {
    expect(matchSavedSongs([song], '밤 편지')).toHaveLength(1)
    expect(matchSavedSongs([song], 'through')).toHaveLength(1)
    expect(matchSavedSongs([song], 'iu')).toHaveLength(1)
  })

  it('returns nothing for blank or unmatched query', () => {
    expect(matchSavedSongs([song], '')).toHaveLength(0)
    expect(matchSavedSongs([song], '   ')).toHaveLength(0)
    expect(matchSavedSongs([song], '봄')).toHaveLength(0)
  })
})
