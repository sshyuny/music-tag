import type { SearchResult, Song } from './types'

const INVISIBLE = /[​-‏‪-‮⁠﻿]/g
const ALT_VERSION = /instrumental|karaoke|piano|\binst\b/i

/** iTunes 문자열에 섞인 보이지 않는 문자를 지우고 앞뒤 공백을 자른다 */
export function cleanText(s: string): string {
  return s.replace(INVISIBLE, '').trim()
}

/** Instrumental, Karaoke, Piano 같은 다른 버전인지 */
export function isAltVersion(title: string): boolean {
  return ALT_VERSION.test(title)
}

/** 저장된 곡은 빼고, 원곡 버전을 먼저 두되 각 구간 안의 순서는 유지한다 */
export function rankItunesResults(results: SearchResult[], savedTrackIds: ReadonlySet<number>): SearchResult[] {
  const fresh = results.filter((r) => !savedTrackIds.has(r.trackId))
  return [...fresh.filter((r) => !isAltVersion(r.originalTitle)), ...fresh.filter((r) => isAltVersion(r.originalTitle))]
}

const compact = (s: string) => s.toLowerCase().replace(/\s+/g, '')

/** 표시 제목, 원래 제목, 아티스트명에서 대소문자와 공백을 무시하고 찾는다 */
export function matchSavedSongs(songs: Song[], query: string): Song[] {
  const q = compact(query)
  if (!q) return []
  return songs.filter((song) => [song.title, song.originalTitle, song.artistName].some((field) => compact(field).includes(q)))
}
