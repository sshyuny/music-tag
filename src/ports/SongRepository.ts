import type { SearchResult, Song, Tag, TagGroup } from '../domain/types'

export class DuplicateTagNameError extends Error {
  constructor(name: string) {
    super(`이미 있는 태그 이름: ${name}`)
    this.name = 'DuplicateTagNameError'
  }
}

export class InvalidNameError extends Error {
  constructor() {
    super('이름이 비어 있음')
    this.name = 'InvalidNameError'
  }
}

export class InvalidReferenceError extends Error {
  constructor() {
    super('대상이 없거나 현재 사용자의 데이터가 아닙니다')
    this.name = 'InvalidReferenceError'
  }
}

/** 태그·그룹·연결은 현재 사용자 범위, 곡 정보는 공통이다. */
export interface SongRepository {
  listSongs(): Promise<Song[]>
  /** 이미 있으면 기존 곡을 그대로 돌려준다 */
  saveSong(result: SearchResult): Promise<Song>
  /** 빈 제목이면 originalTitle로 되돌린다 */
  updateSongTitle(trackId: number, title: string): Promise<void>
  /** 중복 없이 추가하고 태그의 lastUsedAt을 갱신한다 */
  addTagToSong(trackId: number, tagId: string): Promise<void>
  removeTagFromSong(trackId: number, tagId: string): Promise<void>

  listTags(): Promise<Tag[]>
  /** 같은 tagKey가 있으면 기존 태그를 돌려준다. 이름이 비면 InvalidNameError */
  createTag(rawName: string): Promise<Tag>
  /** 다른 태그와 tagKey가 겹치면 DuplicateTagNameError */
  renameTag(tagId: string, rawName: string): Promise<void>
  /** 모든 곡에서도 떼어낸다 */
  deleteTag(tagId: string): Promise<void>
  setTagGroup(tagId: string, groupId: string | null): Promise<void>

  listGroups(): Promise<TagGroup[]>
  createGroup(name: string): Promise<TagGroup>
  renameGroup(groupId: string, name: string): Promise<void>
  /** 소속 태그는 그룹 없음으로 옮긴다 */
  deleteGroup(groupId: string): Promise<void>
}
