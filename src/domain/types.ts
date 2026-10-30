/** 모든 사용자가 공유하는 곡 원본. 태그 연결은 별도 테이블에 저장한다. */
export interface SongRecord {
  /** iTunes trackId. 곡을 구분하는 기준 */
  trackId: number
  /** 표시 제목. 사용자 수정은 공통으로 반영한다 */
  title: string
  /** iTunes 원래 제목 */
  originalTitle: string
  artistName: string
  albumName: string | null
  artworkUrl: string | null
  releaseDate: string | null
  /** 공통 목록에 처음 등록한 시각. epoch ms */
  addedAt: number
}

/** 현재 사용자의 태그 연결을 조립한 조회 결과. DB 저장 모델과 구분한다. */
export interface Song extends SongRecord {
  tagIds: string[]
}

export interface User {
  id: string
  name: string
}

export interface SongTag {
  userId: string
  trackId: number
  tagId: string
}

export interface Tag {
  userId: string
  nameKey: string
  id: string
  name: string
  groupId: string | null
  lastUsedAt: number | null
}

export interface TagGroup {
  userId: string
  id: string
  name: string
}

export type SearchResult = Omit<SongRecord, 'title' | 'addedAt'>
