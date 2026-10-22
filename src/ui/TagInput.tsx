import { useId, useState, type KeyboardEvent } from 'react'
import { normalizeTagName, tagKey } from '../domain/tagName'
import type { Tag } from '../domain/types'

interface Props {
  /** 전체 태그 */
  tags: Tag[]
  /** 이미 곡에 달린 태그 */
  excludeIds: ReadonlySet<string>
  songCounts: Map<string, number>
  onPick(tagId: string): void
  /** 정리된 이름을 넘긴다 */
  onCreate(name: string): void
}

type Option = { kind: 'pick'; tag: Tag } | { kind: 'create'; name: string }

function buildOptions(tags: Tag[], excludeIds: ReadonlySet<string>, input: string): Option[] {
  const name = normalizeTagName(input)
  const key = tagKey(input)
  if (!key) return []

  const matches = tags
    .filter((t) => !excludeIds.has(t.id) && tagKey(t.name).includes(key))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  const prefixMatches = matches.filter((t) => tagKey(t.name).startsWith(key))
  const innerMatches = matches.filter((t) => !tagKey(t.name).startsWith(key))
  // 이미 곡에 달린 태그와 같은 이름이면 새로 만들 것도 없다
  const exists = tags.some((t) => tagKey(t.name) === key)

  // "여름"을 쳤는데 엔터가 #20대초반여름을 달지 않도록, 가운데만 일치하는 태그는 새로 만들기 뒤에 둔다
  return [
    ...prefixMatches.map((tag): Option => ({ kind: 'pick', tag })),
    ...(exists ? [] : [{ kind: 'create', name } as Option]),
    ...innerMatches.map((tag): Option => ({ kind: 'pick', tag })),
  ]
}

/** 한글 조합 중에 누른 엔터는 무시해야 한다 */
const isComposing = (e: KeyboardEvent) => e.nativeEvent.isComposing || e.keyCode === 229

export function TagInput({ tags, excludeIds, songCounts, onPick, onCreate }: Props) {
  const listId = useId()
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const options = open ? buildOptions(tags, excludeIds, input) : []

  const run = (option: Option) => {
    if (option.kind === 'pick') onPick(option.tag.id)
    else onCreate(option.name)
    setInput('')
    setHighlight(0)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (options.length === 0) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      setHighlight((h) => (h + step + options.length) % options.length)
    } else if (e.key === 'Enter') {
      if (isComposing(e)) return
      e.preventDefault()
      const option = options[highlight]
      if (option) run(option)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="tag-input">
      <input
        role="combobox"
        aria-expanded={options.length > 0}
        aria-controls={listId}
        aria-label="태그 입력"
        placeholder="태그 입력 후 엔터"
        value={input}
        onChange={(e) => {
          setInput(e.target.value)
          setOpen(true)
          setHighlight(0)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      />
      {options.length > 0 && (
        <ul role="listbox" id={listId} className="tag-options">
          {options.map((option, i) => {
            const count = option.kind === 'pick' ? songCounts.get(option.tag.id) : undefined
            return (
              <li
                key={option.kind === 'pick' ? option.tag.id : 'create'}
                role="option"
                aria-selected={i === highlight}
                className={i === highlight ? 'highlighted' : undefined}
                // 입력창 포커스를 잃지 않게 mousedown에서 막는다
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(option)}
              >
                {option.kind === 'pick'
                  ? `#${option.tag.name}${count ? ` · ${count}곡` : ''}`
                  : `＋ "${option.name}" 새 태그로 만들기`}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
