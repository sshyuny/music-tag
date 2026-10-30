import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SongRepository } from '../ports/SongRepository'
import { fakePlayer, freshRepo, searchResult, testDeps } from '../test/fakes'
import { AppProvider, type AppDeps } from './AppContext'
import { BrowseScreen } from './BrowseScreen'

/** Task 3 픽스처와 같은 구성: s1 [가을, 새벽], s2 [가을], s3 [여름, 재즈], s4 [비] */
const seed = async (repo: SongRepository) => {
  const season = await repo.createGroup('계절')
  const genre = await repo.createGroup('장르')
  const [summer, autumn, jazz, dawn, rain] = await Promise.all(['여름', '가을', '재즈', '새벽', '비'].map((n) => repo.createTag(n)))
  await repo.setTagGroup(summer.id, season.id)
  await repo.setTagGroup(autumn.id, season.id)
  await repo.setTagGroup(jazz.id, genre.id)
  await repo.createTag('빈태그')

  const songs: [number, string, string[]][] = [
    [1, 's1', [autumn.id, dawn.id]],
    [2, 's2', [autumn.id]],
    [3, 's3', [summer.id, jazz.id]],
    [4, 's4', [rain.id]],
  ]
  for (const [id, title, tagIds] of songs) {
    await repo.saveSong(searchResult(id, title))
    for (const tagId of tagIds) await repo.addTagToSong(id, tagId)
  }
}

const renderScreen = async (overrides: Partial<AppDeps> = {}) => {
  const repo = freshRepo()
  await seed(repo)
  render(
    <AppProvider deps={testDeps({ repo, ...overrides })}>
      <BrowseScreen />
    </AppProvider>,
  )
  await screen.findByRole('button', { name: '#여름 1' })
}

const chip = (name: RegExp) => within(screen.getByRole('region', { name: '태그 목록' })).getByRole('button', { name })
const resultTitles = () =>
  within(screen.getByRole('region', { name: '결과' }))
    .queryAllByRole('listitem')
    .map((li) => li.querySelector('b')?.textContent)

it('groups tags by name with counts, ungrouped last, hiding empty tags', async () => {
  await renderScreen()
  const groups = within(screen.getByRole('region', { name: '태그 목록' })).getAllByRole('group')
  expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['계절', '장르', '그룹 없음'])
  expect(within(groups[0]).getAllByRole('button').map((b) => b.textContent)).toEqual(['#가을 2', '#여름 1'])
  expect(screen.queryByRole('button', { name: /빈태그/ })).toBeNull()
})

it('shows all songs when nothing selected', async () => {
  await renderScreen()
  expect(screen.getByRole('heading', { name: '4곡' })).toBeInTheDocument()
})

it('OR within group, AND across groups', async () => {
  await renderScreen()
  await userEvent.click(chip(/^#여름/))
  await userEvent.click(chip(/^#가을/))
  expect(resultTitles()).toEqual(['s3', 's2', 's1'])

  await userEvent.click(chip(/^#새벽/))
  expect(resultTitles()).toEqual(['s1'])
  expect(chip(/^#새벽/)).toHaveAttribute('aria-pressed', 'true')
})

it('marks dimmed tags', async () => {
  await renderScreen()
  await userEvent.click(chip(/^#여름/))
  expect(chip(/^#새벽/)).toHaveAttribute('data-dimmed', 'true')
  expect(chip(/^#재즈/)).not.toHaveAttribute('data-dimmed', 'true')
  expect(chip(/^#가을/)).not.toHaveAttribute('data-dimmed', 'true')
})

it('clears selection', async () => {
  await renderScreen()
  await userEvent.click(chip(/^#여름/))
  await userEvent.click(screen.getByRole('button', { name: '선택 해제' }))
  expect(screen.getByRole('heading', { name: '4곡' })).toBeInTheDocument()
})

it('play button calls player', async () => {
  const player = fakePlayer()
  await renderScreen({ player })
  await userEvent.click(chip(/^#재즈/))
  await userEvent.click(screen.getByRole('button', { name: 's3 재생' }))
  expect(player.play).toHaveBeenCalledWith(expect.objectContaining({ artistName: 'IU', originalTitle: 's3' }))
  expect(screen.queryByRole('region', { name: '선택한 곡' })).toBeNull()
})

it('play-all is disabled', async () => {
  await renderScreen()
  expect(screen.getByRole('button', { name: '▶ 전체 재생' })).toBeDisabled()
})

it('shows empty message when there are no songs', async () => {
  render(
    <AppProvider deps={testDeps()}>
      <BrowseScreen />
    </AppProvider>,
  )
  expect(await screen.findByText("아직 태그 단 곡이 없어. '추가' 탭에서 시작해줘.")).toBeInTheDocument()
})


const openSong = async (title: string) => {
  await userEvent.click(screen.getByRole('button', { name: `${title} 태그 편집` }))
  return screen.findByRole('region', { name: '선택한 곡' })
}

it('edits tags from a song in the browse results and updates counts', async () => {
  await renderScreen()
  const panel = await openSong('s1')
  const input = within(panel).getByRole('combobox', { name: '태그 입력' })
  await userEvent.type(input, '산책{Enter}')
  expect(await within(panel).findByRole('button', { name: '#산책 떼기' })).toBeInTheDocument()
  expect(chip(/^#산책/)).toHaveTextContent('1')
  await userEvent.type(input, '재즈{Enter}')
  expect(await within(panel).findByRole('button', { name: '#재즈 떼기' })).toBeInTheDocument()
  expect(chip(/^#재즈/)).toHaveTextContent('2')
  await userEvent.click(within(panel).getByRole('button', { name: '#가을 떼기' }))
  await waitFor(() => expect(within(panel).queryByRole('button', { name: '#가을 떼기' })).toBeNull())
  expect(chip(/^#가을/)).toHaveTextContent('1')
})

it('keeps the editor open when tag removal filters the song out', async () => {
  await renderScreen()
  await userEvent.click(chip(/^#새벽/))
  const panel = await openSong('s1')
  await userEvent.click(within(panel).getByRole('button', { name: '#새벽 떼기' }))
  await waitFor(() => expect(resultTitles()).toEqual([]))
  expect(screen.getByRole('region', { name: '선택한 곡' })).toBeInTheDocument()
  await userEvent.type(within(panel).getByRole('combobox'), '새벽{Enter}')
  await waitFor(() => expect(resultTitles()).toEqual(['s1']))
})

it('switches the selected song and closes the editor', async () => {
  await renderScreen()
  await openSong('s1')
  const panel = await openSong('s3')
  expect(within(panel).getByLabelText('표시 제목')).toHaveValue('s3')
  expect(within(panel).getByRole('button', { name: '#여름 떼기' })).toBeInTheDocument()
  expect(within(panel).queryByRole('button', { name: '#가을 떼기' })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: '편집 닫기' }))
  expect(screen.queryByRole('region', { name: '선택한 곡' })).toBeNull()
})
