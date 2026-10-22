import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ deps, children }: { deps: AppDeps; children: ReactNode }) {
  const [songs, setSongs] = useState<Song[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [groups, setGroups] = useState<TagGroup[]>([])

  const refresh = useCallback(async () => {
    const [nextSongs, nextTags, nextGroups] = await Promise.all([
      deps.repo.listSongs(),
      deps.repo.listTags(),
      deps.repo.listGroups(),
    ])
    setSongs(nextSongs)
    setTags(nextTags)
    setGroups(nextGroups)
  }, [deps.repo])

  useEffect(() => {
    // IndexedDB(외부 저장소)에서 처음 읽어오는 동기화라 effect가 맞다
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
  }, [refresh])

  const value = useMemo(() => ({ ...deps, songs, tags, groups, refresh }), [deps, songs, tags, groups, refresh])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// Provider와 훅은 같은 컨텍스트를 공유하므로 한 파일에 둔다
// oxlint-disable-next-line react/only-export-components
export function useApp(): AppState {
  const state = useContext(AppContext)
  if (!state) throw new Error('useApp은 AppProvider 안에서만 쓸 수 있다')
  return state
}
