import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Tag } from '../domain/types'
import { TagInput } from './TagInput'

const tag = (id: string, name: string): Tag => ({ id, userId: 'default', name, nameKey: name.toLowerCase(), groupId: null, lastUsedAt: null })
const tags = [tag('autumn', '가을'), tag('autumn-dawn', '가을새벽'), tag('summer', '여름'), tag('jazz', 'Jazz')]
const counts = new Map([
  ['autumn', 12],
  ['autumn-dawn', 3],
])

const setup = (excludeIds: ReadonlySet<string> = new Set()) => {
  const onPick = vi.fn()
  const onCreate = vi.fn()
  render(<TagInput tags={tags} excludeIds={excludeIds} songCounts={counts} onPick={onPick} onCreate={onCreate} />)
  return { onPick, onCreate, input: screen.getByRole('combobox') }
}

const optionTexts = () => screen.queryAllByRole('option').map((o) => o.textContent)

it('suggests matching tags with counts', async () => {
  const { input } = setup()
  await userEvent.type(input, '가')
  expect(optionTexts()).toEqual(['#가을 · 12곡', '#가을새벽 · 3곡', '＋ "가" 새 태그로 만들기'])
})

it('puts inner matches after the create option', async () => {
  const { input } = setup()
  await userEvent.type(input, '을')
  expect(optionTexts()).toEqual(['＋ "을" 새 태그로 만들기', '#가을 · 12곡', '#가을새벽 · 3곡'])
})

it('excludes tags already on the song', async () => {
  const { input } = setup(new Set(['autumn']))
  await userEvent.type(input, '가')
  expect(optionTexts()[0]).toBe('#가을새벽 · 3곡')
})

it('Enter picks highlighted existing tag and clears input', async () => {
  const { input, onPick } = setup()
  await userEvent.type(input, '가{Enter}')
  expect(onPick).toHaveBeenCalledWith('autumn')
  expect(input).toHaveValue('')
})

it('ArrowDown then Enter picks second', async () => {
  const { input, onPick } = setup()
  await userEvent.type(input, '가{ArrowDown}{Enter}')
  expect(onPick).toHaveBeenCalledWith('autumn-dawn')
})

it('Enter on exact match picks, not creates', async () => {
  const { input, onPick, onCreate } = setup()
  await userEvent.type(input, '#jazz{Enter}')
  expect(onPick).toHaveBeenCalledWith('jazz')
  expect(onCreate).not.toHaveBeenCalled()
  expect(optionTexts()).not.toContain('＋ "jazz" 새 태그로 만들기')
})

it('Enter on new name creates normalized', async () => {
  const { input, onCreate } = setup()
  await userEvent.type(input, '  #비오는날 {Enter}')
  expect(onCreate).toHaveBeenCalledWith('비오는날')
  expect(input).toHaveValue('')
})

it('clicking an option picks it', async () => {
  const { input, onPick } = setup()
  await userEvent.type(input, '여')
  await userEvent.click(screen.getByRole('option', { name: '#여름' }))
  expect(onPick).toHaveBeenCalledWith('summer')
})

it('ignores Enter while composing', async () => {
  const { input, onPick, onCreate } = setup()
  await userEvent.type(input, '가으')
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
  expect(onPick).not.toHaveBeenCalled()
  expect(onCreate).not.toHaveBeenCalled()
  expect(input).toHaveValue('가으')
})

it('ignores Enter on blank', async () => {
  const { input, onPick, onCreate } = setup()
  await userEvent.type(input, ' # {Enter}')
  expect(onPick).not.toHaveBeenCalled()
  expect(onCreate).not.toHaveBeenCalled()
})

it('Enter on a new name creates it even when a longer tag contains it', async () => {
  const onPick = vi.fn()
  const onCreate = vi.fn()
  const longer = [tag('early20s', '20대초반여름'), tag('autumn-night', '가을밤')]
  render(<TagInput tags={longer} excludeIds={new Set()} songCounts={counts} onPick={onPick} onCreate={onCreate} />)

  await userEvent.type(screen.getByRole('combobox'), '여름')
  expect(optionTexts()).toEqual(['＋ "여름" 새 태그로 만들기', '#20대초반여름'])

  await userEvent.keyboard('{Enter}')
  expect(onCreate).toHaveBeenCalledWith('여름')
  expect(onPick).not.toHaveBeenCalled()
})

it('Escape closes the list', async () => {
  const { input } = setup()
  await userEvent.type(input, '가{Escape}')
  expect(optionTexts()).toEqual([])
})
