import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Song, Tag, TagGroup } from '../domain/types'
import type { Player } from '../ports/Player'
import type { SongRepository } from '../ports/SongRepository'
import type { SongSearch } from '../ports/SongSearch'

export interface AppDeps {
  repo: SongRepository
  search: SongSearch
  player: Player
}

interface AppState extends AppDeps {
  songs: Song[]
  tags: Tag[]
  groups: TagGroup[]
  /** 저장소에서 다시 읽는다. 화면은 변경 후 반드시 호출 */
  refresh(): Promise<void>
  run(action: () => Promise<void>): Promise<void>
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ deps, children }: { deps: AppDeps; children: ReactNode }) {
  const [songs, setSongs] = useState<Song[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [groups, setGroups] = useState<TagGroup[]>([])

  const [failure, setFailure] = useState<{ message: string; retry: () => Promise<void> } | null>(null)
  const [busy, setBusy] = useState(false)
  const actionQueue = useRef(Promise.resolve())
  const loadVersion = useRef(0)

  const refresh = useCallback(async function load() {
    const version = ++loadVersion.current
    setFailure(null)
    try {
      const [nextSongs, nextTags, nextGroups] = await Promise.all([
        deps.repo.listSongs(), deps.repo.listTags(), deps.repo.listGroups(),
      ])
      if (version !== loadVersion.current) return
      setSongs(nextSongs)
      setTags(nextTags)
      setGroups(nextGroups)
    } catch {
      if (version === loadVersion.current) setFailure({ message: '데이터를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.', retry: load })
    }
  }, [deps.repo])

  const run = useCallback(function runAction(action: () => Promise<void>): Promise<void> {
    const next = actionQueue.current.then(async () => {
      setBusy(true)
      setFailure(null)
      try {
        await action()
      } catch {
        setFailure({ message: '저장 결과를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.', retry: () => runAction(action) })
      } finally {
        setBusy(false)
      }
    })
    actionQueue.current = next
    return next
  }, [])

  useEffect(() => {
    // 외부 저장소에서 처음 읽어온다.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
  }, [refresh])

  const value = useMemo(() => ({ ...deps, songs, tags, groups, refresh, run }), [deps, songs, tags, groups, refresh, run])
  return (
    <AppContext.Provider value={value}>
      {failure && <div role="alert" className="error">{failure.message} <button type="button" disabled={busy} onClick={() => void failure.retry()}>다시 시도</button></div>}
      {busy && <p role="status">저장 중…</p>}
      {children}
    </AppContext.Provider>
  )
}

// Provider와 훅은 같은 컨텍스트를 공유하므로 한 파일에 둔다
// oxlint-disable-next-line react/only-export-components
export function useApp(): AppState {
  const state = useContext(AppContext)
  if (!state) throw new Error('useApp은 AppProvider 안에서만 쓸 수 있다')
  return state
}
