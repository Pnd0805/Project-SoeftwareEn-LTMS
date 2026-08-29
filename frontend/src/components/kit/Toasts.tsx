/**
 * src/components/kit/Toasts.tsx
 * The bottom-right stack. One line, one action's worth of news.
 */
import { useToasts } from '../../shared/store'
import { Icon } from './Icon'

export function Toasts() {
  const toasts = useToasts()
  return (
    <div className="toast-stack" id="toasts">
      {toasts.map(t => (
        <div className={`toast ${t.kind === 'ok' ? '' : t.kind}`} key={t.id} role="status">
          <Icon name={t.kind === 'ok' ? 'check' : 'warn'} size={17} />
          <span className="body">{t.text}</span>
        </div>
      ))}
    </div>
  )
}
