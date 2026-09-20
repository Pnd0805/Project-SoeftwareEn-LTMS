import { fireEvent, render, screen } from '@testing-library/react'
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

describe('Modal', () => {
  it('does not steal focus again when an inline onClose callback changes during typing', () => {
    render(<RerenderingModal closed={vi.fn()} />)
    const second = screen.getByRole('textbox', { name: 'Second' })
    second.focus()
    fireEvent.change(second, { target: { value: 'keeps focus' } })
    expect(second).toHaveFocus()
  })

  it('uses the current close callback for Escape without reopening the focus effect', () => {
    const firstClose = vi.fn()
    const secondClose = vi.fn()
    const { rerender } = render(<Modal open onClose={firstClose}><input aria-label="Field" /></Modal>)
    const field = screen.getByRole('textbox', { name: 'Field' })
    rerender(<Modal open onClose={secondClose}><input aria-label="Field" /></Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(field).toHaveFocus()
    expect(firstClose).not.toHaveBeenCalled()
    expect(secondClose).toHaveBeenCalledOnce()
  })
})
