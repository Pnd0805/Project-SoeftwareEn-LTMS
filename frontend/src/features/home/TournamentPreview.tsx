import { Link } from 'react-router-dom'
import { Modal } from '../../components/kit/Modal'
import { Icon } from '../../components/kit/Icon'

export function TournamentPreview({ open, name, sport, facts, href, onClose }: {
  open: boolean
  name: string
  sport: string
  facts: readonly { label: string; value: string }[]
  href: string
  onClose: () => void
}) {
  return <Modal open={open} title={<span className="disp tournament-preview-title">{name}</span>} onClose={onClose}>
    <p className="tournament-preview-sport">{sport}</p>
    {facts.length ? <dl className="tournament-preview-facts">
      {facts.map(fact => <div key={fact.label}>
        <dt>{fact.label}</dt>
        <dd>{fact.value}</dd>
      </div>)}
    </dl> : <p className="sub">Details unavailable.</p>}
    <div className="tournament-preview-actions">
      <button className="btn" type="button" onClick={onClose}>Close</button>
      <Link className="btn primary" to={href}>Open tournament <Icon name="chev" size={14} /></Link>
    </div>
  </Modal>
}
