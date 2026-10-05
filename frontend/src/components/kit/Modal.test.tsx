import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

function RerenderingModal({ closed }: { closed: () => void }) {
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  return (
    <Modal open onClose={() => closed()}>
      <input aria-label="First" value={first} onChange={event => setFirst(event.target.value)} />
      <input aria-label="Second" value={second} onChange={event => setSecond(event.target.value)} />
    </Modal>
  )
}

function OpeningModal({ nested = false }: { nested?: boolean }) {
  const [open, setOpen] = useState(false)
  const [childOpen, setChildOpen] = useState(false)
  const child = <Modal open={childOpen} onClose={() => setChildOpen(false)} title="Child">
    <button type="button">Child action</button>
  </Modal>
  return <>
    <button type="button" onClick={() => setOpen(true)}>Open parent</button>
    <button type="button">Outside</button>
    <Modal open={open} onClose={() => setOpen(false)} title="Parent">
      <button type="button" onClick={() => setChildOpen(true)}>Open child</button>
      <button type="button">Parent action</button>
      {nested ? child : null}
    </Modal>
    {nested ? null : child}
  </>
}

function ControlledModal({ open, openerVisible = true }: { open: boolean; openerVisible?: boolean }) {
  return <>
    {openerVisible ? <button type="button">Opener</button> : null}
    <Modal open={open} onClose={vi.fn()}><button type="button">Action</button></Modal>
  </>
}

describe('Modal', () => {
  it.each([
    { title: <span>Register team</span>, label: 'Entry', name: 'Register team' },
    { title: undefined, label: 'Create a team', name: 'Create a team' },
    { title: undefined, label: undefined, name: 'Dialog' },
  ])('names the dialog $name using existing title and label props', ({ title, label, name }) => {
    render(<Modal open onClose={vi.fn()} title={title} label={label}><button>Cancel</button></Modal>)
    expect(screen.getByRole('dialog', { name })).toBeInTheDocument()
  })

  it('initially focuses a visible enabled control rather than hidden or disabled fields', async () => {
    render(<Modal open onClose={vi.fn()}>
      <input type="hidden" value="7" readOnly />
      <button disabled>Unavailable</button>
      <fieldset disabled><input aria-label="Disabled fieldset" /></fieldset>
      <div hidden><input aria-label="Hidden ancestor" /></div>
      <input aria-label="Display hidden" style={{ display: 'none' }} />
      <input aria-label="Visibility hidden" style={{ visibility: 'hidden' }} />
      <a href="/teams">Teams</a>
      <input aria-label="Next" />
    </Modal>)
    await waitFor(() => expect(screen.getByRole('link', { name: 'Teams' })).toHaveFocus())
  })

  it('focuses an empty dialog and contains Tab in either direction', async () => {
    const user = userEvent.setup()
    render(<Modal open onClose={vi.fn()}><input type="hidden" /><button disabled>Unavailable</button></Modal>)
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(dialog).toHaveFocus())
    await user.tab()
    expect(dialog).toHaveFocus()
    await user.tab({ shift: true })
    expect(dialog).toHaveFocus()
  })

  it('cycles visible controls in both directions without reaching the page behind it', async () => {
    const user = userEvent.setup()
    render(<><button>Outside</button><Modal open onClose={vi.fn()}>
      <input aria-label="First" /><button disabled>Unavailable</button><button>Last</button>
    </Modal></>)
    const first = screen.getByRole('textbox', { name: 'First' })
    const last = screen.getByRole('button', { name: 'Last' })
    await waitFor(() => expect(first).toHaveFocus())
    await user.tab({ shift: true })
    await waitFor(() => expect(last).toHaveFocus())
    await user.tab()
    await waitFor(() => expect(first).toHaveFocus())
    await user.tab()
    expect(last).toHaveFocus()
    await user.tab()
    await waitFor(() => expect(first).toHaveFocus())
  })

  it('includes later-mounted controls in navigation without resetting dialog focus', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Modal open onClose={vi.fn()}><p>Loading fields…</p></Modal>)
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(dialog).toHaveFocus())
    rerender(<Modal open onClose={vi.fn()}><input aria-label="Loaded field" /><button>Loaded action</button></Modal>)
    expect(dialog).toHaveFocus()
    await user.tab()
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Loaded field' })).toHaveFocus())
    await user.tab()
    expect(screen.getByRole('button', { name: 'Loaded action' })).toHaveFocus()
    await user.tab()
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Loaded field' })).toHaveFocus())
  })

  it('restores its connected opener on Escape and backdrop close, but ignores content clicks', async () => {
    const user = userEvent.setup()
    render(<OpeningModal />)
    const opener = screen.getByRole('button', { name: 'Open parent' })
    await user.click(opener)
    await user.click(screen.getByRole('button', { name: 'Parent action' }))
    expect(screen.getByRole('dialog', { name: 'Parent' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(opener).toHaveFocus())
    await user.click(opener)
    const backdrop = screen.getByRole('dialog', { name: 'Parent' }).closest('.modal-bg')!
    await user.click(backdrop)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('restores its connected opener when the same controlled dialog closes', async () => {
    const { rerender } = render(<ControlledModal open={false} />)
    const opener = screen.getByRole('button', { name: 'Opener' })
    opener.focus()
    rerender(<ControlledModal open />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Action' })).toHaveFocus())
    rerender(<ControlledModal open={false} />)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('does not restore focus to an opener removed from the same open dialog instance', async () => {
    const { rerender } = render(<ControlledModal open={false} />)
    const opener = screen.getByRole('button', { name: 'Opener' })
    opener.focus()
    rerender(<ControlledModal open />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Action' })).toHaveFocus())
    const dialog = screen.getByRole('dialog')
    rerender(<ControlledModal open openerVisible={false} />)
    expect(screen.getByRole('dialog')).toBe(dialog)
    expect(screen.getByRole('button', { name: 'Action' })).toHaveFocus()
    expect(opener.isConnected).toBe(false)
    rerender(<ControlledModal open={false} openerVisible={false} />)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(document.body).toHaveFocus())
    expect(opener).not.toHaveFocus()
  })

  it.each([false, true])('contains focus and Escape in the top dialog (nested: %s)', async nested => {
    const user = userEvent.setup()
    render(<OpeningModal nested={nested} />)
    const opener = screen.getByRole('button', { name: 'Open parent' })
    await user.click(opener)
    const childOpener = screen.getByRole('button', { name: 'Open child' })
    await user.click(childOpener)
    const child = screen.getByRole('dialog', { name: 'Child' })
    const action = within(child).getByRole('button', { name: 'Child action' })
    await waitFor(() => expect(action).toHaveFocus())
    await user.tab()
    await waitFor(() => expect(action).toHaveFocus())
    await user.tab({ shift: true })
    await waitFor(() => expect(action).toHaveFocus())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Child' })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Parent' })).toBeInTheDocument()
    await waitFor(() => expect(childOpener).toHaveFocus())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('does not steal focus again when an inline onClose callback changes during typing', () => {
    render(<RerenderingModal closed={vi.fn()} />)
    const second = screen.getByRole('textbox', { name: 'Second' })
    second.focus()
    fireEvent.change(second, { target: { value: 'keeps focus' } })
    expect(second).toHaveFocus()
  })

  it('uses the current close callback for Escape without reopening the focus effect', async () => {
    const firstClose = vi.fn()
    const secondClose = vi.fn()
    const { rerender } = render(<Modal open onClose={firstClose}><input aria-label="Field" /></Modal>)
    const field = screen.getByRole('textbox', { name: 'Field' })
    await waitFor(() => expect(field).toHaveFocus())
    rerender(<Modal open onClose={secondClose}><input aria-label="Field" /></Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(field).toHaveFocus()
    expect(firstClose).not.toHaveBeenCalled()
    expect(secondClose).toHaveBeenCalledOnce()
  })
})
