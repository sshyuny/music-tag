import { useState } from 'react'
import { AddSongScreen } from './AddSongScreen'

const TABS = ['추가', '꺼내기', '관리'] as const
type TabName = (typeof TABS)[number]

export function App() {
  const [tab, setTab] = useState<TabName>('추가')

  return (
    <div className="app">
      <nav role="tablist" className="tabs">
        {TABS.map((name) => (
          <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>
            {name}
          </button>
        ))}
      </nav>
      <main>
        <h2>{tab}</h2>
        {tab === '추가' && <AddSongScreen />}
      </main>
    </div>
  )
}
