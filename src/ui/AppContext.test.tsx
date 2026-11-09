import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { testDeps, searchResult, fakeSearch } from '../test/fakes'
import { AppProvider } from './AppContext'
import { App } from './App'

it('shows initial load failure and retries without an unhandled rejection', async () => {
  const deps = testDeps()
  const list = vi.spyOn(deps.repo, 'listSongs').mockRejectedValueOnce(new Error('offline'))
  render(<AppProvider deps={deps}><App /></AppProvider>)
  expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했어요')
  await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  expect(list).toHaveBeenCalledTimes(2)
})
it('preserves group input after a failed save and allows retry', async () => {
  const deps = testDeps()
  const create = vi.spyOn(deps.repo, 'createGroup').mockRejectedValueOnce(new Error('offline'))
  render(<AppProvider deps={deps}><App /></AppProvider>)
  await userEvent.click(screen.getByRole('tab', { name: '관리' }))
  const input = screen.getByRole('textbox', { name: '새 그룹' })
  await userEvent.type(input, '계절{Enter}')
  expect(await screen.findByRole('alert')).toHaveTextContent('저장')
  expect(input).toHaveValue('계절')
  await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByRole('textbox', { name: '그룹 이름 계절' })).toBeInTheDocument()
  expect(input).toHaveValue('')
  expect(create).toHaveBeenCalledTimes(2)
})
it('retries only loading if saving succeeded and the subsequent refresh failed', async () => {
  const deps = testDeps()
  const create = vi.spyOn(deps.repo, 'createGroup')
  render(<AppProvider deps={deps}><App /></AppProvider>)
  await userEvent.click(screen.getByRole('tab', { name: '관리' }))
  vi.spyOn(deps.repo, 'listSongs').mockRejectedValueOnce(new Error('offline'))
  await userEvent.type(screen.getByRole('textbox', { name: '새 그룹' }), '계절{Enter}')
  expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했어요')
  await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByRole('textbox', { name: '그룹 이름 계절' })).toBeInTheDocument()
  expect(create).toHaveBeenCalledTimes(1)
})
it('does not select a song when saving it failed and can retry saving', async () => {
  const deps = testDeps({ search: fakeSearch(async () => [searchResult(1, '밤편지')]) })
  vi.spyOn(deps.repo, 'saveSong').mockRejectedValueOnce(new Error('offline'))
  render(<AppProvider deps={deps}><App /></AppProvider>)
  await userEvent.type(screen.getByRole('searchbox'), '밤편지')
  await userEvent.click(await screen.findByRole('button', { name: /밤편지/ }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: '선택한 곡' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByRole('region', { name: '선택한 곡' })).toBeInTheDocument()
})

it('does not drop a second action while the first request is pending', async () => {
  const deps = testDeps()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const original = deps.repo.createGroup.bind(deps.repo)
  const create = vi.spyOn(deps.repo, 'createGroup')
  create.mockImplementationOnce(async name => { await gate; return original(name) })
  render(<AppProvider deps={deps}><App /></AppProvider>)
  await userEvent.click(screen.getByRole('tab', { name: '관리' }))
  await userEvent.type(screen.getByRole('textbox', { name: '새 그룹' }), '계절{Enter}')
  await userEvent.type(screen.getByRole('textbox', { name: '새 태그' }), '가을{Enter}')
  release()
  expect(await screen.findByRole('textbox', { name: '그룹 이름 계절' })).toBeInTheDocument()
  expect(await screen.findByRole('row', { name: '태그 가을' })).toBeInTheDocument()
})
