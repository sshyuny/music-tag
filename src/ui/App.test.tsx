import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { testDeps } from '../test/fakes'
import { App } from './App'
import { AppProvider } from './AppContext'

it('starts on 추가 and switches tabs', async () => {
  render(
    <AppProvider deps={testDeps()}>
      <App />
    </AppProvider>,
  )

  expect(screen.getByRole('tab', { name: '추가' })).toHaveAttribute('aria-selected', 'true')

  await userEvent.click(screen.getByRole('tab', { name: '꺼내기' }))
  expect(screen.getByRole('tab', { name: '꺼내기' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('heading', { name: '꺼내기' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('tab', { name: '관리' }))
  expect(screen.getByRole('heading', { name: '관리' })).toBeInTheDocument()
})
