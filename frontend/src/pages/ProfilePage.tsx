import type { MeDto } from '../types/dto'

interface ProfilePageProps {
  user: MeDto
}

export function ProfilePage({ user }: ProfilePageProps) {
  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">Account</span>
          <h1>Profile</h1>
          <p>{user.fullName}</p>
        </div>
      </div>
    </div>
  )
}
