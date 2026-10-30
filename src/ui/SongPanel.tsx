import { useState } from 'react'
import { tagSongCounts } from '../domain/filter'
import type { Song, Tag } from '../domain/types'
import { useApp } from './AppContext'
import { TagInput } from './TagInput'

const RECENT_TAG_LIMIT = 8

export function SongPanel({ song }: { song: Song }) {
  const { tags, songs, repo, refresh } = useApp()
  const [draft, setDraft] = useState(song.title)

  const attached = new Set(song.tagIds)
  const attachedTags = song.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is Tag => !!t)
  const recentTags = tags
    .filter((t) => t.lastUsedAt !== null && !attached.has(t.id))
    .sort((a, b) => b.lastUsedAt! - a.lastUsedAt!)
    .slice(0, RECENT_TAG_LIMIT)

  const commitTitle = async () => {
    if (draft === song.title) return
    await repo.updateSongTitle(song.trackId, draft)
    setDraft(draft.trim() || song.originalTitle)
    await refresh()
  }

  const attach = async (tagId: string) => {
    await repo.addTagToSong(song.trackId, tagId)
    await refresh()
  }

  const create = async (name: string) => {
    const tag = await repo.createTag(name)
    await attach(tag.id)
  }

  const detach = async (tagId: string) => {
    await repo.removeTagFromSong(song.trackId, tagId)
    await refresh()
  }

  return (
    <section aria-label="선택한 곡" className="song-panel">
      <label>
        <span className="label">표시 제목</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commitTitle()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) void commitTitle()
          }}
        />
      </label>
      <p className="hint">
        원제 {song.originalTitle} · {song.artistName}
      </p>

      <div className="chips" role="group" aria-label="달린 태그">
        {attachedTags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className="chip on"
            aria-label={`#${tag.name} 떼기`}
            onClick={() => void detach(tag.id)}
          >
            #{tag.name} ✕
          </button>
        ))}
      </div>

      <div className="chips" role="group" aria-label="최근 쓴 태그">
        <span className="label">최근 쓴 태그</span>
        {recentTags.map((tag) => (
          <button key={tag.id} type="button" className="chip" onClick={() => void attach(tag.id)}>
            #{tag.name}
          </button>
        ))}
      </div>

      <TagInput
        tags={tags}
        excludeIds={attached}
        songCounts={tagSongCounts(songs)}
        onPick={(id) => void attach(id)}
        onCreate={(name) => void create(name)}
      />
    </section>
  )
}
