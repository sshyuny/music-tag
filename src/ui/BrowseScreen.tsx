import { useEffect, useRef, useState } from 'react'
import { browsableTags, dimmedTagIds, filterSongs, tagSongCounts } from '../domain/filter'
import type { Tag } from '../domain/types'
import { useApp } from './AppContext'
import { SongPanel } from './SongPanel'

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ko')

export function BrowseScreen() {
  const { songs, tags, groups, player } = useApp()
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  const [editingId, setEditingId] = useState<number | null>(null)
  const editingSong = songs.find(song => song.trackId === editingId)
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editingId !== null) editorRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [editingId])

  if (songs.length === 0) return <p className="hint">아직 태그 단 곡이 없어. '추가' 탭에서 시작해줘.</p>

  const visible = browsableTags(songs, tags)
  const counts = tagSongCounts(songs)
  const dimmed = dimmedTagIds(songs, tags, selected)
  const results = filterSongs(songs, tags, selected)
  const selectedTags = tags.filter((t) => selected.has(t.id))
  const tagName = (id: string) => tags.find((t) => t.id === id)?.name

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const sections: { key: string; name: string; tags: Tag[] }[] = [
    ...[...groups].sort(byName).map((g) => ({ key: g.id, name: g.name, tags: visible.filter((t) => t.groupId === g.id) })),
    { key: 'none', name: '그룹 없음', tags: visible.filter((t) => t.groupId === null || !groups.some((g) => g.id === t.groupId)) },
  ].filter((s) => s.tags.length > 0)

  return (
    <div className="browse-screen">
      <section aria-label="태그 목록" className="tag-list">
        {sections.map((section) => (
          <div key={section.key} role="group" aria-label={section.name} className="chips">
            <span className="label">{section.name}</span>
            {[...section.tags].sort(byName).map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="chip"
                aria-pressed={selected.has(tag.id)}
                data-dimmed={dimmed.has(tag.id) || undefined}
                onClick={() => toggle(tag.id)}
              >
                {`#${tag.name} `}
                <small>{counts.get(tag.id)}</small>
              </button>
            ))}
          </div>
        ))}
      </section>

      {editingSong && (
        <div ref={editorRef}>
          <SongPanel key={editingSong.trackId} song={editingSong} />
          <button type="button" onClick={() => setEditingId(null)}>편집 닫기</button>
        </div>
      )}

      <section aria-label="결과" className="results">
        <div className="results-bar">
          <h3>{results.length}곡</h3>
          {selectedTags.map((tag) => (
            <button key={tag.id} type="button" className="chip on" aria-label={`#${tag.name} 해제`} onClick={() => toggle(tag.id)}>
              #{tag.name} ✕
            </button>
          ))}
          {selectedTags.length > 0 && (
            <button type="button" onClick={() => setSelected(new Set())}>
              선택 해제
            </button>
          )}
          <button type="button" disabled title="재생할 곳을 정한 뒤 지원">
            ▶ 전체 재생
          </button>
        </div>
        <ul>
          {results.map((song) => (
            <li key={song.trackId} className="song-row">
              <button
                type="button"
                className="song-select"
                aria-label={`${song.title} 태그 편집`}
                aria-pressed={editingId === song.trackId}
                onClick={() => setEditingId(song.trackId)}
              >
                {song.artworkUrl ? <img src={song.artworkUrl} alt="" width={40} height={40} /> : <span className="art" />}
                <span className="meta">
                  <b>{song.title}</b>
                  <span>
                    {song.artistName} · {song.tagIds.map((id) => `#${tagName(id)}`).join(' ')}
                  </span>
                </span>
              </button>
              <button type="button" aria-label={`${song.title} 재생`} onClick={() => player.play(song)}>
                ▶
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
