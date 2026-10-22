import { useState, type KeyboardEvent } from 'react'
import { tagSongCounts } from '../domain/filter'
import { DuplicateTagNameError, InvalidNameError } from '../ports/SongRepository'
import { useApp } from './AppContext'
import { ConfirmButton } from './ConfirmButton'

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ko')

/** 한글 조합 중이 아닌 엔터에서만 실행한다 */
const onEnter = (run: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) run()
}

export function ManageScreen() {
  const { tags, groups, songs, repo, refresh } = useApp()
  const counts = tagSongCounts(songs)

  const after = (action: () => Promise<void>) => async () => {
    await action()
    await refresh()
  }

  return (
    <div className="manage-screen">
      <section aria-label="그룹">
        <h3>그룹</h3>
        <NewNameInput label="새 그룹" onSubmit={async (name) => void (await repo.createGroup(name))} onDone={refresh} />
        <ul>
          {[...groups].sort(byName).map((group) => (
            <li key={group.id} aria-label={`그룹 ${group.name}`}>
              <EditableName
                key={group.name}
                label={`그룹 이름 ${group.name}`}
                value={group.name}
                save={async (name) => {
                  await repo.renameGroup(group.id, name)
                  await refresh()
                }}
              />
              <ConfirmButton onConfirm={after(() => repo.deleteGroup(group.id))} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="태그">
        <h3>태그</h3>
        <NewNameInput label="새 태그" onSubmit={async (name) => void (await repo.createTag(name))} onDone={refresh} />
        <table>
          <tbody>
            {[...tags].sort(byName).map((tag) => (
              <tr key={tag.id} aria-label={`태그 ${tag.name}`}>
                <td>
                  <EditableName
                    key={tag.name}
                    label="태그 이름"
                    value={tag.name}
                    save={async (name) => {
                      await repo.renameTag(tag.id, name)
                      await refresh()
                    }}
                  />
                </td>
                <td>
                  <select
                    aria-label="그룹"
                    value={tag.groupId ?? ''}
                    onChange={(e) => void after(() => repo.setTagGroup(tag.id, e.target.value || null))()}
                  >
                    <option value="">그룹 없음</option>
                    {[...groups].sort(byName).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{counts.get(tag.id) ?? 0}곡</td>
                <td>
                  <ConfirmButton onConfirm={after(() => repo.deleteTag(tag.id))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function NewNameInput({ label, onSubmit, onDone }: { label: string; onSubmit(name: string): Promise<void>; onDone(): Promise<void> }) {
  const [value, setValue] = useState('')
  const submit = async () => {
    try {
      await onSubmit(value)
    } catch (e) {
      if (!(e instanceof InvalidNameError)) throw e
    }
    setValue('')
    await onDone()
  }
  return (
    <input aria-label={label} placeholder={`${label} 입력 후 엔터`} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onEnter(() => void submit())} />
  )
}

/** 엔터나 포커스를 잃을 때 저장한다. 빈 이름은 되돌리고, 중복 이름은 오류를 보여주고 되돌린다 */
function EditableName({ label, value, save }: { label: string; value: string; save(name: string): Promise<void> }) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)

  const commit = async () => {
    if (draft === value) return
    try {
      await save(draft)
      setError(null)
    } catch (e) {
      if (e instanceof DuplicateTagNameError) setError('이미 있는 태그 이름이야.')
      else if (!(e instanceof InvalidNameError)) throw e
      setDraft(value)
    }
  }

  return (
    <span className="editable-name">
      <input aria-label={label} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => void commit()} onKeyDown={onEnter(() => void commit())} />
      {error && <span className="error">{error}</span>}
    </span>
  )
}
