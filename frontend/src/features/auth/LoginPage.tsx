/**
 * src/features/auth/LoginPage.tsx
 *
 * Login form wired to the real auth hook. We keep the quick-role buttons for the
 * prototype experience, but each one now calls the same login mutation as the form.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, USE_MOCK } from '../../api/client'
import { Icon } from '../../components/kit/Icon'
import { useLogin } from '../../hooks/useAuth'
import { loginSchema, type LoginInput } from '../../schemas/auth.schema'
import { continueAsGuest, resetDemo } from '../../shared/store'
import './account-workspace.css'

const DEMO: Array<{ email: string; password: string; label: string; note: string }> = [
  { email: 'admin@ltms.test', password: 'password123', label: 'Admin', note: 'Approves tournament requests, manages users and permanent squads' },
  { email: 'organizer@ltms.test', password: 'password123', label: 'Organizer', note: 'Owns Faculty Football Cup 2026 — approve squads, draw, resolve disputes' },
  { email: 'referee@ltms.test', password: 'password123', label: 'Referee', note: 'Appointed to the Football Cup — check in players, enter results' },
  { email: 'leader@ltms.test', password: 'password123', label: 'Team Leader', note: 'Leads Byte Force — invite players, register, confirm results' },
  { email: 'player@ltms.test', password: 'password123', label: 'Player', note: 'In Byte Force with a pending invite; fails the age rule on purpose' },
]

export function LoginPage() {
  const navigate = useNavigate()
  const login = useLogin()

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: USE_MOCK
      ? { email: 'player@ltms.test', password: 'password123' }
      : { email: '', password: '' },
  })

  const redirectAfterLogin = (userType: string) => {
    navigate(userType === 'staff' ? '/admin' : '/')
  }

  const submit = async (values: LoginInput) => {
    try {
      const result = await login.mutateAsync(values)
      redirectAfterLogin(result.user.userType)
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        Object.entries(error.fields).forEach(([field, message]) => {
          form.setError(field as keyof LoginInput, { type: 'server', message })
        })
      } else {
        form.setError('root', { type: 'server', message: 'Unable to sign in. Please try again.' })
      }
    }
  }

  const quickLogin = async (email: string, password: string) => {
    try {
      const result = await login.mutateAsync({ email, password })
      redirectAfterLogin(result.user.userType)
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        Object.entries(error.fields).forEach(([field, message]) => {
          form.setError(field as keyof LoginInput, { type: 'server', message })
        })
      } else {
        form.setError('root', { type: 'server', message: 'Unable to sign in. Please try again.' })
      }
    }
  }

  return (
    <main className="auth account-workspace account-login"><div className="auth-card">
      <div className="account-brand">
        <span className="account-brand-mark">
          <Icon name="trophy" size={19} />
        </span>
        <span className="disp">LTMS</span>
      </div>

      <header className="account-heading">
        <h1 className="disp">Sign in</h1>
        <p className="sub">
        {USE_MOCK
          ? 'Sign in or choose a demo role.'
          : 'Use your LTMS account to continue.'}
        </p>
      </header>

      <form className="account-form" onSubmit={form.handleSubmit(submit)} aria-busy={login.isPending}>
        <div className="account-field">
          <label className="field">
            <span className="label">Email</span>
            <input type="email" placeholder="you@ku.th" autoComplete="username" aria-invalid={!!form.formState.errors.email}
              aria-describedby={form.formState.errors.email ? 'login-email-error' : undefined} {...form.register('email')} />
          </label>
          {form.formState.errors.email && <span className="error" id="login-email-error" role="alert">{form.formState.errors.email.message}</span>}
        </div>
        <div className="account-field">
          <label className="field">
            <span className="label">Password</span>
            <input type="password" placeholder="Enter your password" autoComplete="current-password" aria-invalid={!!form.formState.errors.password}
              aria-describedby={form.formState.errors.password ? 'login-password-error' : undefined} {...form.register('password')} />
          </label>
          {form.formState.errors.password && <span className="error" id="login-password-error" role="alert">{form.formState.errors.password.message}</span>}
        </div>

        {form.formState.errors.root && <span className="error" role="alert">{form.formState.errors.root.message}</span>}

        <button className="btn primary" type="submit" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
        {login.isPending && <span className="sub" role="status">Signing in. Please wait.</span>}
      </form>

      <div className="account-actions">
        <span className="sub">New to LTMS?</span>
        <Link className="btn ghost" to="/register">Create account</Link>
      </div>

      {USE_MOCK ? (
        <section className="account-demo" aria-label="Demo roles">
          {DEMO.map(({ email, password, label, note }) => (
            <button className="who" type="button" key={email} disabled={login.isPending} onClick={() => void quickLogin(email, password)}>
              <span className="avatar">{label.slice(0, 1)}</span>
              <span className="meta"><b>{label}</b><span className="tag">{note}</span></span>
              <Icon name="chev" size={13} />
            </button>
          ))}
        </section>
      ) : null}

      <button className="btn ghost" type="button" onClick={() => { continueAsGuest(); navigate('/') }}>
        Continue as guest
      </button>
      {USE_MOCK ? (
        <div className="account-actions">
          <span className="sub">Demo data stays in this browser.</span>
          <button className="btn ghost" type="button" onClick={resetDemo}>Reset demo data</button>
        </div>
      ) : null}
    </div></main>
  )
}
