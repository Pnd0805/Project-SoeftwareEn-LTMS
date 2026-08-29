import { AdminDashboard } from '../components/admin/AdminDashboard'

interface AdminPageProps {
  onNavigate: (label: string) => void
}

export function AdminPage({ onNavigate }: AdminPageProps) {
  return <AdminDashboard onNavigate={onNavigate} />
}
