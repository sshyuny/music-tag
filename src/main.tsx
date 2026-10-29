import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initializeRepository } from './adapters/initializeRepository'
import { ItunesSongSearch } from './adapters/itunesSearch'
import { YoutubePlayer } from './adapters/youtubePlayer'
import './index.css'
import { App } from './ui/App'
import { AppProvider, type AppDeps } from './ui/AppContext'

const root = createRoot(document.getElementById('root')!)
root.render(<p role="status">데이터를 준비하고 있어요…</p>)

initializeRepository().then(
  (repo) => {
    const deps: AppDeps = {
      repo,
      search: new ItunesSongSearch(),
      player: new YoutubePlayer(),
    }
    root.render(
      <StrictMode>
        <AppProvider deps={deps}>
          <App />
        </AppProvider>
      </StrictMode>,
    )
  },
  () => root.render(<p role="alert">데이터를 열지 못했어요. 다른 music-tag 탭을 닫고 새로고침해 주세요.</p>),
)
