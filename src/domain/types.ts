export interface Song {
  /** iTunes trackId. 곡을 구분하는 기준 */
  trackId: number
  /** 표시 제목. 사용자가 수정할 수 있다 */
  title: string
  /** iTunes 원래 제목 */
  originalTitle: string
  artistName: string
  albumName: string | null
  artworkUrl: string | null
  releaseDate: string | null
  tagIds: string[]
  /** epoch ms */
  addedAt: number
}

export interface Tag {
  id: string
  name: string
  groupId: string | null
  lastUsedAt: number | null
}

export interface TagGroup {
  id: string
  name: string
}

export type SearchResult = Omit<Song, 'title' | 'tagIds' | 'addedAt'>
