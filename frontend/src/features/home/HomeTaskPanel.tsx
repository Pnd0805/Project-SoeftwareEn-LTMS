import { Link } from 'react-router-dom'
import { Icon } from '../../components/kit/Icon'
import { composeHomeTasks, type HomeTaskFeed } from './homeTasks'

const urgencyBadge = {
  urgent: { className: 'crit', label: 'Urgent' },
  waiting: { className: 'warn', label: 'Waiting' },
  ready: { className: 'ok', label: 'Ready' },
} as const

export function HomeTaskPanel({ feeds }: { feeds: readonly HomeTaskFeed[] }) {
  const { tasks, loading, failed } = composeHomeTasks(feeds)
  const allReady = feeds.length > 0 && feeds.every(feed => feed.state === 'ready')

  return (
    <section className="home-task-panel" aria-labelledby="home-task-heading" aria-busy={loading}>
      <h2 id="home-task-heading" className="h-sec">Needs you</h2>
      {loading ? <p role="status">Loading work…</p> : null}
      {failed.length ? (
        <>
          <p role="alert">Some work could not load</p>
          {failed.map(feed => (
            <div key={feed.label} className="hstack" role="group" aria-label={`${feed.label} could not load`}>
              <span className="sub">{feed.label}</span>
              <button className="btn" type="button" onClick={feed.retry}
                aria-label={`Retry ${feed.label}`}>
                Retry
              </button>
            </div>
          ))}
        </>
      ) : null}
      {allReady && tasks.length === 0 ? (
        <>
          <p role="status">No tasks right now</p>
          <a href="#tournaments">Browse tournaments</a>
        </>
      ) : null}
      <ul className="home-task-list">
        {tasks.map(task => {
          const urgency = urgencyBadge[task.urgency]
          return (
            <li key={task.key}>
              <Link className="home-task-link" to={task.href}>
                <span className={`badge ${urgency.className}`}>{urgency.label}</span>
                <span className="home-task-copy">
                  <strong>{task.label}</strong>
                  <span className="sub">{task.context}</span>
                  {task.detail ? <span className="home-task-detail">{task.detail}</span> : null}
                </span>
                <Icon name="chev" size={13} aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
