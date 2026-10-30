import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SongRepository } from '../ports/SongRepository'
import { freshRepo, searchResult, testDeps } from '../test/fakes'
import { AppProvider } from './AppContext'
import { ManageScreen } from './ManageScreen'

const renderScreen = async (seed?: (repo: SongRepository) => Promise<void>) => {
  const repo = freshRepo()
  await seed?.(repo)
  render(
    <AppProvider deps={testDeps({ repo })}>
      <ManageScreen />
    </AppProvider>,
  )
  return repo
}

const tagRow = (name: string) => screen.findByRole('row', { name: new RegExp(`태그 ${name}`) })

it('creates group and assigns tag to it', async () => {
  const repo = await renderScreen(async (r) => void (await r.createTag('가을')))

  await userEvent.type(screen.getByLabelText('새 그룹'), '계절{Enter}')
  const row = await tagRow('가을')
  const option = await within(row).findByRole('option', { name: '계절' })
  await userEvent.selectOptions(within(row).getByRole('combobox', { name: '그룹' }), option)

  await waitFor(async () => {
    const [group] = await repo.listGroups()
    expect((await repo.listTags())[0].groupId).toBe(group.id)
  })
})

it('creates a tag without a song', async () => {
  const repo = await renderScreen()
  await userEvent.type(screen.getByLabelText('새 태그'), '#비오는날{Enter}')
  expect(await tagRow('비오는날')).toBeInTheDocument()
  expect((await repo.listTags()).map((t) => t.name)).toEqual(['비오는날'])
})

it('renames tag', async () => {
  const repo = await renderScreen(async (r) => void (await r.createTag('가을')))
  const input = within(await tagRow('가을')).getByRole('textbox', { name: '태그 이름' })

  await userEvent.clear(input)
  await userEvent.type(input, '가을밤{Enter}')

  await waitFor(async () => expect((await repo.listTags())[0].name).toBe('가을밤'))
})

it('shows error on duplicate rename and reverts', async () => {
  await renderScreen(async (r) => {
    await r.createTag('가을')
    await r.createTag('여름')
  })
  const row = await tagRow('여름')
  const input = within(row).getByRole('textbox', { name: '태그 이름' })

  await userEvent.clear(input)
  await userEvent.type(input, '가을{Enter}')

  expect(await within(row).findByText('이미 있는 태그 이름이야.')).toBeInTheDocument()
  expect(input).toHaveValue('여름')
})

it('reverts blank rename', async () => {
  await renderScreen(async (r) => void (await r.createTag('가을')))
  const input = within(await tagRow('가을')).getByRole('textbox', { name: '태그 이름' })

  await userEvent.clear(input)
  await userEvent.tab()

  await waitFor(() => expect(input).toHaveValue('가을'))
})

it('renames group', async () => {
  const repo = await renderScreen(async (r) => void (await r.createGroup('계절')))
  const input = await screen.findByRole('textbox', { name: '그룹 이름 계절' })

  await userEvent.clear(input)
  await userEvent.type(input, '계절·시간대{Enter}')

  await waitFor(async () => expect((await repo.listGroups())[0].name).toBe('계절·시간대'))
})

it('deleting group keeps tags as ungrouped, after second click', async () => {
  const repo = await renderScreen(async (r) => {
    const group = await r.createGroup('계절')
    const tag = await r.createTag('가을')
    await r.setTagGroup(tag.id, group.id)
  })
  const groupRow = await screen.findByRole('listitem', { name: '그룹 계절' })

  await userEvent.click(within(groupRow).getByRole('button', { name: '삭제' }))
  expect(await repo.listGroups()).toHaveLength(1)
  await userEvent.click(within(groupRow).getByRole('button', { name: '정말 삭제' }))

  await waitFor(async () => expect(await repo.listGroups()).toEqual([]))
  expect((await repo.listTags())[0].groupId).toBeNull()
})

it('delete tag requires second click', async () => {
  const repo = await renderScreen(async (r) => void (await r.createTag('가을')))
  const row = await tagRow('가을')

  await userEvent.click(within(row).getByRole('button', { name: '삭제' }))
  expect(await repo.listTags()).toHaveLength(1)
  await userEvent.click(within(row).getByRole('button', { name: '정말 삭제' }))

  await waitFor(async () => expect(await repo.listTags()).toEqual([]))
})

it('lists zero-song tags with counts', async () => {
  await renderScreen(async (r) => {
    await r.saveSong(searchResult(1, 's1'))
    const used = await r.createTag('가을')
    await r.addTagToSong(1, used.id)
    await r.createTag('빈태그')
  })
  expect(within(await tagRow('빈태그')).getByText('0곡')).toBeInTheDocument()
  expect(within(await tagRow('가을')).getByText('1곡')).toBeInTheDocument()
})
