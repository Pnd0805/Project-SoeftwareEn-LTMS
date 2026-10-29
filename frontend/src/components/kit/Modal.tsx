/**
 * src/components/kit/Modal.tsx
 *
 * A job with one answer opens over the page: the page states, the modal changes.
 * Escape closes it, the first control takes focus, and a click on the backdrop
 * is a cancel — the same three affordances the prototype's `modal()` had.
 */
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Tag } from './primitives'

interface ModalProps {
  open: boolean
  onClose: () => void
  label?: string
  title?: ReactNode
  className?: string
  children: ReactNode
}

export function Modal({ open, onClose, label, title, className, children }: ModalProps) {
  const backdropClosing = useRef(false)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement
    backdropClosing.current = false
    return () => {
      /* การกดฉากหลังต้องคืนโฟกัสด้วย แม้ browser ไม่รองรับ preventScroll */
      if (backdropClosing.current && opener instanceof HTMLElement && opener.isConnected) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen, details) => {
      if (!nextOpen) {
        backdropClosing.current = details.reason === 'outside-press'
        onClose()
      }
    }}>
      <Dialog.Portal>
        <Dialog.Viewport className="modal-bg">
          <Dialog.Popup className={['modal', className].filter(Boolean).join(' ')} aria-modal="true" aria-label={title ? undefined : label || 'Dialog'}>
            <div className="vstack">
              {label ? <Tag>{label}</Tag> : null}
              {title ? <Dialog.Title render={<h3 style={{ margin: 0, fontSize: 20 }} />}>{title}</Dialog.Title> : null}
              {children}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
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
