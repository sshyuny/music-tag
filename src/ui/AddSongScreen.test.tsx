import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SearchResult } from '../domain/types'
import type { SongRepository } from '../ports/SongRepository'
import { SearchError } from '../ports/SongSearch'
import { fakeSearch, freshRepo, searchResult, testDeps } from '../test/fakes'
import { AddSongScreen } from './AddSongScreen'
import { AppProvider, type AppDeps } from './AppContext'

const renderScreen = (deps: AppDeps) =>
  render(
    <AppProvider deps={deps}>
      <AddSongScreen />
    </AppProvider>,
  )

const section = (name: string) => screen.getByRole('region', { name })
const searchBox = () => screen.getByRole('searchbox', { name: '곡 검색' })

const seedSaved = async (repo: SongRepository) => {
  await repo.saveSong(searchResult(1, 'Through the Night'))
  await repo.updateSongTitle(1, '밤편지')
}

it('shows saved songs first and hides them from iTunes section', async () => {
  const repo = freshRepo()
  await seedSaved(repo)
  const search = fakeSearch(async () => [searchResult(1, 'Through the Night'), searchResult(2, 'Through the Night [Piano]')])
  renderScreen(testDeps({ repo, search }))

  await userEvent.type(searchBox(), '밤편지')

  expect(await within(section('내 곡')).findByText('밤편지')).toBeInTheDocument()
  expect(await within(section('iTunes 검색 결과')).findByText('Through the Night [Piano]')).toBeInTheDocument()
  expect(within(section('iTunes 검색 결과')).queryByText('Through the Night')).toBeNull()
})

it('debounces iTunes search', async () => {
  const search = fakeSearch()
  renderScreen(testDeps({ search }))

  await userEvent.type(searchBox(), '밤편지')

  await waitFor(() => expect(search.search).toHaveBeenCalled())
  expect(search.search).toHaveBeenCalledTimes(1)
  expect(search.search.mock.calls[0][0]).toBe('밤편지')
})

it('ignores stale search responses', async () => {
  const pending = new Map<string, (r: SearchResult[]) => void>()
  const search = fakeSearch((term) => new Promise((resolve) => pending.set(term, resolve)))
  renderScreen(testDeps({ search }))

  await userEvent.type(searchBox(), '밤')
  await waitFor(() => expect(pending.has('밤')).toBe(true))
  await userEvent.type(searchBox(), '편지')
  await waitFor(() => expect(pending.has('밤편지')).toBe(true))

  pending.get('밤편지')!([searchResult(10, 'New Result')])
  pending.get('밤')!([searchResult(11, 'Stale Result')])

  expect(await screen.findByText('New Result')).toBeInTheDocument()
  await new Promise((r) => setTimeout(r, 20))
  expect(screen.queryByText('Stale Result')).toBeNull()
})

it('shows error message when search fails and keeps saved songs', async () => {
  const repo = freshRepo()
  await seedSaved(repo)
  const search = fakeSearch(async () => {
    throw new SearchError('403')
  })
  renderScreen(testDeps({ repo, search }))

  await userEvent.type(searchBox(), '밤편지')

  expect(await screen.findByText('iTunes 검색에 실패했어. 잠시 뒤 다시 시도해줘.')).toBeInTheDocument()
  expect(within(section('내 곡')).getByText('밤편지')).toBeInTheDocument()
})

it('selecting iTunes result saves it and shows tag panel', async () => {
  const repo = freshRepo()
  const search = fakeSearch(async () => [searchResult(5, 'Through the Night')])
  renderScreen(testDeps({ repo, search }))

  await userEvent.type(searchBox(), '밤편지')
  await userEvent.click(await screen.findByRole('button', { name: /Through the Night/ }))

  const panel = await screen.findByRole('region', { name: '선택한 곡' })
  expect(within(panel).getByLabelText('표시 제목')).toHaveValue('Through the Night')
  expect(await repo.listSongs()).toHaveLength(1)
})

it('shows the selected song panel above the search results', async () => {
  const search = fakeSearch(async () => [searchResult(5, 'Through the Night'), searchResult(6, 'Other')])
  renderScreen(testDeps({ search }))

  await userEvent.type(searchBox(), '밤편지')
  await userEvent.click(await screen.findByRole('button', { name: /Through the Night/ }))

  const panel = await screen.findByRole('region', { name: '선택한 곡' })
  const results = section('iTunes 검색 결과')
  expect(panel.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

const selectSaved = async (repo: SongRepository) => {
  renderScreen(testDeps({ repo }))
  await userEvent.type(searchBox(), '밤편지')
  await userEvent.click(await within(section('내 곡')).findByRole('button', { name: /밤편지/ }))
  return screen.findByRole('region', { name: '선택한 곡' })
}

it('creating a tag via input attaches it', async () => {
  const repo = freshRepo()
  await seedSaved(repo)
  const panel = await selectSaved(repo)

  await userEvent.type(within(panel).getByRole('combobox'), '가을{Enter}')

  expect(await within(panel).findByRole('button', { name: '#가을 떼기' })).toBeInTheDocument()
  expect((await repo.listSongs())[0].tagIds).toHaveLength(1)
})

it('removing a tag chip detaches it', async () => {
  const repo = freshRepo()
  await seedSaved(repo)
  const tag = await repo.createTag('가을')
  await repo.addTagToSong(1, tag.id)
  const panel = await selectSaved(repo)

  await userEvent.click(await within(panel).findByRole('button', { name: '#가을 떼기' }))

  await waitFor(async () => expect((await repo.listSongs())[0].tagIds).toEqual([]))
})

it('recent tag chip attaches in one click', async () => {
  const repo = freshRepo()
  await seedSaved(repo)
  await repo.saveSong(searchResult(2, 'Other'))
  const tag = await repo.createTag('가을')
  await repo.addTagToSong(2, tag.id)
  const panel = await selectSaved(repo)

  const recent = within(panel).getByRole('group', { name: '최근 쓴 태그' })
  await userEvent.click(await within(recent).findByRole('button', { name: '#가을' }))

  expect(await within(panel).findByRole('button', { name: '#가을 떼기' })).toBeInTheDocument()
  expect(within(recent).queryByRole('button', { name: '#가을' })).toBeNull()
})

it('edits display title', async () => {
  const repo = freshRepo()
  await repo.saveSong(searchResult(1, 'Through the Night'))
  renderScreen(testDeps({ repo }))
  await userEvent.type(searchBox(), 'through')
  await userEvent.click(await within(section('내 곡')).findByRole('button', { name: /Through the Night/ }))
  const panel = await screen.findByRole('region', { name: '선택한 곡' })

  const title = within(panel).getByLabelText('표시 제목')
  await userEvent.clear(title)
  await userEvent.type(title, '밤편지{Enter}')

  expect(within(panel).getByText(/^원제 Through the Night/)).toBeInTheDocument()
  await waitFor(async () => expect((await repo.listSongs())[0].title).toBe('밤편지'))
})

it('does not offer shared song deletion', async () => {
  const repo = freshRepo()
  await seedSaved(repo)
  const panel = await selectSaved(repo)

  expect(within(panel).queryByRole('button', { name: '곡 삭제' })).not.toBeInTheDocument()
  expect(await repo.listSongs()).toHaveLength(1)
})
