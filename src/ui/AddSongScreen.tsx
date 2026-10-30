import { useEffect, useState } from 'react'
import { matchSavedSongs, rankItunesResults } from '../domain/searchText'
import type { SearchResult, Song, Tag } from '../domain/types'
import { useApp } from './AppContext'
import { SongPanel } from './SongPanel'

const DEBOUNCE_MS = 400

type ItunesState =
  | { term: string; status: 'loading' }
  | { term: string; status: 'ok'; results: SearchResult[] }
  | { term: string; status: 'error' }

export function AddSongScreen() {
  const { songs, tags, repo, search, refresh } = useApp()
  const [query, setQuery] = useState('')
  const [itunes, setItunes] = useState<ItunesState | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const term = query.trim()

  useEffect(() => {
    if (!term) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setItunes({ term, status: 'loading' })
      search.search(term, controller.signal).then(
        (results) => {
          if (!controller.signal.aborted) setItunes({ term, status: 'ok', results })
        },
        () => {
          if (!controller.signal.aborted) setItunes({ term, status: 'error' })
        },
      )
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [term, search])

  // 지금 입력과 다른 검색어의 결과는 보여주지 않는다
  const current = itunes?.term === term ? itunes : null
  const saved = matchSavedSongs(songs, query)
  const savedIds = new Set(songs.map((s) => s.trackId))
  const itunesResults = current?.status === 'ok' ? rankItunesResults(current.results, savedIds) : []
  const selected = songs.find((s) => s.trackId === selectedId) ?? null

  const pickItunes = async (result: SearchResult) => {
    await repo.saveSong(result)
    await refresh()
    setSelectedId(result.trackId)
  }

  return (
    <div className="add-screen">
      <input
        type="search"
        aria-label="곡 검색"
        placeholder="곡명이나 아티스트로 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {/* 검색 결과가 길어도 바로 태그를 달 수 있게 검색창 바로 아래에 둔다 */}
      {selected && <SongPanel key={selected.trackId} song={selected} />}

      {term && (
        <div className="search-results">
          <section aria-label="내 곡">
            <h3>내 곡</h3>
            {saved.length === 0 && <p className="hint">저장한 곡 중에는 없어.</p>}
            {saved.map((song) => (
              <SongRow key={song.trackId} song={song} tags={tags} onClick={() => setSelectedId(song.trackId)} />
            ))}
          </section>
          <section aria-label="iTunes 검색 결과">
            <h3>iTunes 검색 결과</h3>
            {(!current || current.status === 'loading') && <p className="hint">검색 중…</p>}
            {current?.status === 'error' && <p className="error">iTunes 검색에 실패했어. 잠시 뒤 다시 시도해줘.</p>}
            {current?.status === 'ok' && itunesResults.length === 0 && <p className="hint">결과가 없어.</p>}
            {itunesResults.map((result) => (
              <SongRow key={result.trackId} song={result} onClick={() => void pickItunes(result)} />
            ))}
          </section>
        </div>
      )}
    </div>
  )
}

function SongRow({ song, tags, onClick }: { song: SearchResult | Song; tags?: Tag[]; onClick: () => void }) {
  const title = 'title' in song ? song.title : song.originalTitle
  const meta = [song.artistName, song.albumName, song.releaseDate?.slice(0, 4)].filter(Boolean).join(' · ')
  const tagNames =
    'tagIds' in song && tags
      ? song.tagIds.map((id) => tags.find((t) => t.id === id)?.name).filter(Boolean).map((n) => `#${n}`).join(' ')
      : ''

  return (
    <button type="button" className="song-row" onClick={onClick}>
      {song.artworkUrl ? <img src={song.artworkUrl} alt="" width={40} height={40} /> : <span className="art" />}
      <span className="meta">
        <b>{title}</b>
        <span>
          {meta}
          {tagNames && ` · ${tagNames}`}
        </span>
      </span>
    </button>
  )
}
