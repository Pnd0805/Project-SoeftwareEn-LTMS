import { ArrowRight, CheckCircle2, Clock3, TriangleAlert } from 'lucide-react'

const workItems = [
  { label: 'Disputed result to settle', detail: 'Faculty Football Cup 2026 · Semi-final', tone: 'urgent', icon: TriangleAlert },
  { label: 'Squads to review', detail: '2 new registrations are waiting', tone: 'waiting', icon: Clock3 },
  { label: 'Fixture ready to schedule', detail: 'Engineering Futsal Challenge', tone: 'ready', icon: CheckCircle2 },
]

export function WorkQueue() {
  return (
    <section className="work-queue" aria-labelledby="work-queue-title">
      <div className="section-heading-row">
        <div><span className="eyebrow">Your workspace</span><h2 id="work-queue-title">Needs your attention</h2></div>
        <span className="queue-count">3 tasks</span>
      </div>
      <div className="work-grid">
        {workItems.map(({ label, detail, tone, icon: Icon }) => (
          <button className={`work-item work-${tone}`} key={label} type="button">
            <span className="work-icon"><Icon size={17} /></span>
            <span className="work-copy"><strong>{label}</strong><small>{detail}</small></span>
            <ArrowRight size={17} />
          </button>
        ))}
      </div>
    </section>
  )
}