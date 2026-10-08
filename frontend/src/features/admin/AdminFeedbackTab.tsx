import { Link } from 'react-router-dom'
import { Panel } from '../../components/kit/primitives'

export function AdminFeedbackTab() {
  return <Panel quiet className="admin-feedback">
    <h2>Feedback moderation</h2>
    <p className="sub">Target context is unavailable from a feedback ID alone. Open a tournament’s Community section and select a visible comment or review to inspect it before removal.</p>
    <Link className="btn" to="/home/all">Find a tournament</Link>
    <p className="sub">You can restore an item just removed while its confirmation context remains in that Community view. Previously removed items cannot be identified here, so restoring them is unavailable.</p>
  </Panel>
}
