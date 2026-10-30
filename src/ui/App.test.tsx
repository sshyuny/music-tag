import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { testDeps } from '../test/fakes'
import { App } from './App'
import { AppProvider } from './AppContext'

it('starts on 추가 and switches tabs', async () => {
  const deps = testDeps()
  await deps.repo.createGroup('테스트 그룹')
  render(
    <AppProvider deps={deps}>
      <App />
    </AppProvider>,
  )

  expect(screen.getByRole('tab', { name: '추가' })).toHaveAttribute('aria-selected', 'true')

  await userEvent.click(screen.getByRole('tab', { name: '꺼내기' }))
  expect(screen.getByRole('tab', { name: '꺼내기' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('heading', { name: '꺼내기' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('tab', { name: '관리' }))
  expect(screen.getByRole('heading', { name: '관리' })).toBeInTheDocument()
  expect(await screen.findByRole('textbox', { name: '그룹 이름 테스트 그룹' })).toBeInTheDocument()
})
