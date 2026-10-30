import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ScheduleDateInput } from './ScheduleDateInput'

function Editor({ initial = '2026-10-30T19:28:00Z', withTime = true }) {
  const [value, setValue] = useState(initial)
  return <><label htmlFor="date-test">Entry opens</label><ScheduleDateInput id="date-test" label="Entry opens" value={value} onChange={setValue} withTime={withTime} /><output aria-label="Submitted value">{value}</output></>
}
afterEach(() => vi.restoreAllMocks())

it('displays a formatted field and preserves the canonical value after editing or clearing', () => {
  render(<Editor />)
  const input = screen.getByRole('textbox', { name: 'Entry opens' })
  expect(input).toHaveValue('31 Oct 2026, 02:28 (UTC+7)')
  fireEvent.change(input, { target: { value: '1 Nov 2026, 14:05 (UTC+7)' } })
  expect(input).toHaveValue('1 Nov 2026, 14:05 (UTC+7)')
  expect(screen.getByLabelText('Submitted value')).toHaveTextContent('2026-11-01T14:05:00+07:00')
  fireEvent.change(input, { target: { value: '' } })
  expect(input).toHaveValue('')
  expect(screen.getByLabelText('Submitted value')).toBeEmptyDOMElement()
})

it('retains invalid text for correction instead of silently submitting the previous valid date', () => {
  render(<Editor />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Entry opens' }), { target: { value: '31 Feb 2026, 02:28' } })
  expect(screen.getByRole('textbox')).toHaveValue('31 Feb 2026, 02:28')
  expect(screen.getByLabelText('Submitted value')).toHaveTextContent('31 Feb 2026, 02:28')
})

it('provides a usable calendar fallback and converts its Bangkok selection', () => {
  render(<Editor />)
  fireEvent.click(screen.getByRole('button', { name: 'Choose Entry opens' }))
  const picker = screen.getByLabelText('Calendar selection for Entry opens')
  expect(picker).not.toHaveAttribute('aria-hidden', 'true')
  fireEvent.change(picker, { target: { value: '2026-11-01T00:15' } })
  expect(screen.getByRole('textbox', { name: 'Entry opens' })).toHaveValue('1 Nov 2026, 00:15 (UTC+7)')
  expect(screen.getByLabelText('Submitted value')).toHaveTextContent('2026-11-01T00:15:00+07:00')
})

it('opens the native picker when supported while keeping the formatted text field', () => {
  render(<Editor />)
  const native = screen.getByLabelText('Calendar selection for Entry opens')
  const showPicker = vi.fn()
  Object.defineProperty(native, 'showPicker', { value: showPicker })
  expect(native).toHaveValue('2026-10-31T02:28')
  fireEvent.click(screen.getByRole('button', { name: 'Choose Entry opens' }))
  expect(showPicker).toHaveBeenCalledOnce()
  expect(native).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByRole('textbox')).toHaveValue('31 Oct 2026, 02:28 (UTC+7)')
})

it('keeps date-only values as calendar dates', () => {
  render(<Editor initial="2026-10-31" withTime={false} />)
  expect(screen.getByRole('textbox')).toHaveValue('31 Oct 2026')
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '1 Nov 2026' } })
  expect(screen.getByLabelText('Submitted value')).toHaveTextContent('2026-11-01')
})
