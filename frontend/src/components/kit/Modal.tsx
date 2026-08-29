/**
 * src/components/kit/Modal.tsx
 *
 * A job with one answer opens over the page: the page states, the modal changes.
 * Escape closes it, the first control takes focus, and a click on the backdrop
 * is a cancel — the same three affordances the prototype's `modal()` had.
 */
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Tag } from './primitives'

interface ModalProps {
  open: boolean
  onClose: () => void
  label?: string
  title?: ReactNode
  children: ReactNode
}

export function Modal({ open, onClose, label, title, children }: ModalProps) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    box.current?.querySelector<HTMLElement>('button, input, select, textarea')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" ref={box} onClick={e => e.stopPropagation()}>
        <div className="vstack">
          {label ? <Tag>{label}</Tag> : null}
          {title ? <h3 style={{ margin: 0, fontSize: 20 }}>{title}</h3> : null}
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * The browser's confirm() is another application's dialog wearing none of this
 * one's clothes, and it cannot say which answer is the destructive one.
 */
export function ConfirmCard({ danger, body, ok = 'Confirm', onCancel, onConfirm }: {
  danger?: boolean; body?: ReactNode; ok?: string; onCancel: () => void; onConfirm: () => void
}) {
  return (
    <>
      {body ? <div className="sub">{body}</div> : null}
      <div className="hstack">
        <button className="btn" type="button" onClick={onCancel}>Cancel</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} type="button" onClick={onConfirm}>{ok}</button>
      </div>
    </>
  )
}
