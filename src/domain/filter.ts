import type { Song, Tag } from './types'

/** 그룹 없는 태그는 혼자 하나의 그룹으로 취급한다 */
const groupKey = (tag: Tag) => tag.groupId ?? `solo:${tag.id}`

const newestFirst = (songs: Song[]) => [...songs].sort((a, b) => b.addedAt - a.addedAt)

/** 같은 그룹 안은 OR, 다른 그룹끼리는 AND */
export function filterSongs(songs: Song[], tags: Tag[], selectedTagIds: ReadonlySet<string>): Song[] {
  const selectedByGroup = new Map<string, Set<string>>()
  for (const tag of tags) {
    if (!selectedTagIds.has(tag.id)) continue
    const key = groupKey(tag)
    const group = selectedByGroup.get(key) ?? new Set<string>()
    group.add(tag.id)
    selectedByGroup.set(key, group)
  }

  const groups = [...selectedByGroup.values()]
  return newestFirst(songs.filter((song) => groups.every((group) => song.tagIds.some((id) => group.has(id)))))
}

/** 지금 선택에 더하면 0곡이 되는 태그. 이미 선택된 그룹의 태그는 결과를 넓히므로 흐리게 하지 않는다 */
export function dimmedTagIds(songs: Song[], tags: Tag[], selectedTagIds: ReadonlySet<string>): Set<string> {
  const dimmed = new Set<string>()
  const selectedTags = tags.filter((tag) => selectedTagIds.has(tag.id))
  if (selectedTags.length === 0) return dimmed

  const selectedGroups = new Set(selectedTags.map(groupKey))
  for (const tag of tags) {
    if (selectedTagIds.has(tag.id) || selectedGroups.has(groupKey(tag))) continue
    if (filterSongs(songs, tags, new Set([...selectedTagIds, tag.id])).length === 0) dimmed.add(tag.id)
  }
  return dimmed
}

export function tagSongCounts(songs: Song[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const song of songs) {
    for (const id of song.tagIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/** 꺼내기 화면에 보일 태그. 곡이 1개 이상인 태그만 */
export function browsableTags(songs: Song[], tags: Tag[]): Tag[] {
  const counts = tagSongCounts(songs)
  return tags.filter((tag) => (counts.get(tag.id) ?? 0) > 0)
}
