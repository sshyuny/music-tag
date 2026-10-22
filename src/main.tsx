import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DexieSongRepository } from './adapters/dexieRepository'
import { ItunesSongSearch } from './adapters/itunesSearch'
import { YoutubePlayer } from './adapters/youtubePlayer'
import './index.css'
import { App } from './ui/App'
import { AppProvider, type AppDeps } from './ui/AppContext'

const deps: AppDeps = {
  repo: new DexieSongRepository(),
  search: new ItunesSongSearch(),
  player: new YoutubePlayer(),
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider deps={deps}>
      <App />
    </AppProvider>
  </StrictMode>,
)
