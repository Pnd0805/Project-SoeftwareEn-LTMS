import { Check, ChevronRight, Clock3, Shield, Users, X } from 'lucide-react'

interface AdminDashboardProps {
    onNavigate: (label: string) => void
}

const requests = [
    { title: 'Inter-Faculty Swimming 2026', requester: 'Sirawit Kanchana', type: 'Tournament request', status: 'Pending', tone: 'warning' },
    { title: 'Campus Table Tennis Open', requester: 'Kittipong Rojana', type: 'Tournament request', status: 'Pending', tone: 'warning' },
]

const permissionRows = [
    { name: 'Rattana Admin', email: 'admin@ltms.test', scope: 'University-wide admin', status: 'Active' },
    { name: 'Thanwa Sirichai', email: 'organizer@ltms.test', scope: 'Organizer', status: 'Active' },
    { name: 'Kittipong Rojana', email: 'referee@ltms.test', scope: 'Referee', status: 'Active' },
]

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
    return <div className="page-stack admin-page">
        <div className="page-header">
            <div>
                <span className="eyebrow">System administration · Access controlled</span>
                <h1>Admin</h1>
                <p>Review requests, manage permissions, and keep the tournament system healthy.</p>
            </div>
            <span className="admin-clearance"><Shield size={16} /> University-wide admin</span>
        </div>

        <section className="admin-stat-grid" aria-label="System overview">
            <div className="admin-stat-card"><span className="eyebrow">Pending requests</span><strong>2</strong><small>Needs review</small></div>
            <div className="admin-stat-card"><span className="eyebrow">Active users</span><strong>143</strong><small>Across the university</small></div>
            <div className="admin-stat-card"><span className="eyebrow">Active tournaments</span><strong>12</strong><small>Public and private</small></div>
            <div className="admin-stat-card"><span className="eyebrow">Registered teams</span><strong>28</strong><small>Ready to compete</small></div>
        </section>

        <div className="admin-layout">
            <section className="admin-panel">
                <div className="section-heading-row">
                    <div><span className="eyebrow">Approval queue</span><h2>Tournament requests</h2></div>
                    <span className="queue-count">2 waiting</span>
                </div>
                <div className="admin-request-list">
                    {requests.map((request) => <article className="admin-request" key={request.title}>
                        <div className="admin-request-icon"><Clock3 size={18} /></div>
                        <div className="admin-request-copy"><strong>{request.title}</strong><span>{request.requester} · {request.type}</span></div>
                        <span className="status-badge status-pending">{request.status}</span>
                        <div className="admin-actions">
                            <button className="admin-icon-button admin-icon-success" type="button" aria-label={`Approve ${request.title}`} title="Approve"><Check size={17} /></button>
                            <button className="admin-icon-button admin-icon-danger" type="button" aria-label={`Reject ${request.title}`} title="Reject"><X size={17} /></button>
                            <button className="admin-open-button" type="button" onClick={() => onNavigate('Tournaments')}><ChevronRight size={17} /></button>
                        </div>
                    </article>)}
                </div>
            </section>

            <section className="admin-panel admin-health-panel">
                <div className="section-heading-row"><div><span className="eyebrow">System health</span><h2>Operations</h2></div></div>
                <div className="admin-health-row"><span className="admin-health-dot" /><span>Match services</span><strong>Operational</strong></div>
                <div className="admin-health-row"><span className="admin-health-dot" /><span>Eligibility checks</span><strong>Operational</strong></div>
                <div className="admin-health-row"><span className="admin-health-dot" /><span>Notifications</span><strong>Operational</strong></div>
            </section>
        </div>

        <section className="admin-panel">
            <div className="section-heading-row">
                <div><span className="eyebrow">Access control</span><h2>Users and permissions</h2></div>
                <button className="secondary-button" type="button" onClick={() => onNavigate('Profile')}><Users size={16} /> View profiles</button>
            </div>
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Scope</th><th>Status</th><th /></tr></thead><tbody>
                {permissionRows.map((row) => <tr key={row.email}><td><strong>{row.name}</strong><small>{row.email}</small></td><td>{row.scope}</td><td><span className="status-badge status-active">{row.status}</span></td><td><button className="admin-text-button" type="button">Manage <ChevronRight size={15} /></button></td></tr>)}
            </tbody></table></div>
        </section>
    </div>
}
