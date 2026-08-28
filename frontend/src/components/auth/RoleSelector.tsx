import { useLogin } from '../../hooks/useAuth'

const demoAccounts = [
  { email: 'admin@ltms.test', role: 'Admin', description: 'Approve requests and manage system permissions' },
  { email: 'organizer@ltms.test', role: 'Organizer', description: 'Run tournaments and review registrations' },
  { email: 'referee@ltms.test', role: 'Referee', description: 'Check in players and record match results' },
  { email: 'leader@ltms.test', role: 'Team leader', description: 'Manage teams and tournament entries' },
  { email: 'player@ltms.test', role: 'Player', description: 'View fixtures, teams, and your competition record' },
]

interface RoleSelectorProps {
  onRoleSelected: (role: string) => void
}

export function RoleSelector({ onRoleSelected }: RoleSelectorProps) {
  const login = useLogin()

  return <main className="role-selector">
    <div className="role-selector-header">
      <span className="eyebrow">Local Tournament Management System</span>
      <h1>Choose a role</h1>
      <p>Select a demo account to enter the workspace with its own permissions and navigation.</p>
    </div>
    <div className="role-list">
      {demoAccounts.map((account) => <button
        className="role-option"
        disabled={login.isPending}
        key={account.email}
        type="button"
        onClick={() => login.mutate(
          { email: account.email, password: 'password123' },
          { onSuccess: () => onRoleSelected(account.role) },
        )}
      >
        <span className="role-avatar">{account.role.slice(0, 1)}</span>
        <span className="role-copy"><strong>{account.role}</strong><small>{account.description}</small><small>{account.email}</small></span>
        <span className="role-arrow">→</span>
      </button>)}
    </div>
    {login.isError && <p className="role-error">Unable to sign in to this demo account. Please try again.</p>}
  </main>
}
