/**
 * ช่องหาผู้ใช้ของ Grant rights — รายการลอยติดใต้ช่องแบบ Google (เอกสารแก้ UI ข้อ 14)
 * เดิมผลลัพธ์เป็นปุ่มเรียงต่อกันที่ดันฟอร์มลงไป · รองรับลูกศร/Enter/Esc ตาม combobox pattern
 */
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Avatar } from '../../components/kit/Avatar'
import { Field } from '../../components/kit/primitives'
import { useSearchUsers } from '../../hooks/useUser'
import { searchUserLabel } from '../../shared/display'

const LIST_ID = 'grant-search-list'
const optionId = (id: number) => `grant-search-option-${id}`

type FoundUser = NonNullable<ReturnType<typeof useSearchUsers>['data']>['items'][number]

export function GrantUserSearch({ enabled, onPick }: { enabled: boolean; onPick: (user: FoundUser) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const found = useSearchUsers(query, enabled)
  const items = found.data?.items ?? []
  const expanded = open && query.trim().length >= 3
  const highlighted = expanded ? items[active] : undefined

  const pick = (user: FoundUser) => {
    onPick(user)
    setQuery(user.fullName)
    setOpen(false)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && expanded) { event.preventDefault(); setOpen(false); return }
    if (event.key === 'Enter' && highlighted) { event.preventDefault(); pick(highlighted); return }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && items.length) {
      event.preventDefault()
      setOpen(true)
      setActive((active + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length)
    }
  }

  return (
    <div className="search-dropdown" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
      <Field label="Find a user by name" htmlFor="grant-search">
        <input id="grant-search" type="search" role="combobox" autoComplete="off" placeholder="At least 3 characters"
          aria-autocomplete="list" aria-expanded={expanded} aria-controls={LIST_ID}
          aria-activedescendant={highlighted ? optionId(highlighted.id) : undefined}
          value={query} onKeyDown={onKeyDown} onFocus={() => setOpen(true)}
          onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true) }} />
      </Field>
      {expanded ? (
        /* กดรายการต้องไม่ทำให้ช่องเสียโฟกัส ไม่งั้น onBlur ปิดรายการก่อน click ทำงาน */
        <div className="search-dropdown-panel" onMouseDown={event => event.preventDefault()}>
          {found.isFetching && !items.length ? <p className="search-dropdown-note" role="status">Searching users…</p> : null}
          {found.isError ? <p className="search-dropdown-note" role="alert">
            {found.error instanceof Error ? found.error.message : 'Request failed.'}{' '}
            <button className="btn" type="button" onClick={() => void found.refetch()}>Retry search</button>
          </p> : null}
          {found.isSuccess && !items.length ? <p className="search-dropdown-note">No matching users.</p> : null}
          <ul id={LIST_ID} role="listbox" aria-label="Matching users">
            {items.map((user, index) => (
              <li key={user.id} id={optionId(user.id)} role="option" aria-selected={index === active}
                className={index === active ? 'on' : undefined}
                onMouseEnter={() => setActive(index)} onClick={() => pick(user)}>
                <Avatar name={user.fullName} avatarUrl={user.avatarUrl} size={32} />
                <span><b>{user.fullName}</b><span className="sub">{searchUserLabel(user)}</span></span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
