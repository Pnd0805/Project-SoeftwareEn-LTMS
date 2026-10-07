/**
 * src/features/auth/LoginPage.tsx
 *
 * Login form wired to the real auth hook. We keep the quick-role buttons for the
 * prototype experience, but each one now calls the same login mutation as the form.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, USE_MOCK } from '../../api/client'
import { Icon } from '../../components/kit/Icon'
import { useLogin } from '../../hooks/useAuth'
import { loginSchema, type LoginInput } from '../../schemas/auth.schema'
import { continueAsGuest, resetDemo } from '../../shared/store'

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
  const [blockedUntil, setBlockedUntil] = useState(0)
  const [now, setNow] = useState(Date.now)
  const remaining = Math.max(0, Math.ceil((blockedUntil - now) / 1000))
  useEffect(() => {
    if (!blockedUntil) return
    const timer = setInterval(() => { const time = Date.now(); setNow(time); if (time >= blockedUntil) clearInterval(timer) }, 1000)
    return () => clearInterval(timer)
  }, [blockedUntil])

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: USE_MOCK
      ? { email: 'player@ltms.test', password: 'password123' }
      : { email: '', password: '' },
  })

  const redirectAfterLogin = useCallback((userType: string) => {
    navigate(userType === 'staff' ? '/admin' : '/')
  }, [navigate])

  const showError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.code === 'TOO_MANY_LOGIN_ATTEMPTS') {
      const seconds = error.extra.retryAfterSeconds
      if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
        const time = Date.now(); setNow(time); setBlockedUntil(time + Math.ceil(seconds) * 1000)
      }
    }
    if (error instanceof ApiError && error.fields) Object.entries(error.fields).forEach(([field, message]) => form.setError(field as keyof LoginInput, { type: 'server', message }))
    else form.setError('root', { type: 'server', message: error instanceof Error ? error.message : 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง' })
  }, [form])

  const submit = useCallback(async (values: LoginInput) => {
    if (blockedUntil > Date.now() || login.isPending) return
    try {
      const result = await login.mutateAsync(values)
      redirectAfterLogin(result.user.userType)
    } catch (error) {
      showError(error)
    }
  }, [blockedUntil, login, redirectAfterLogin, showError])

  const quickLogin = useCallback(async (email: string, password: string) => {
    if (blockedUntil > Date.now() || login.isPending) return
    try {
      const result = await login.mutateAsync({ email, password })
      redirectAfterLogin(result.user.userType)
    } catch (error) {
      showError(error)
    }
  }, [blockedUntil, login, redirectAfterLogin, showError])

  return (
    <div className="auth"><div className="auth-card">
      <div className="hstack" style={{ gap: 11 }}>
        <span style={{ width: 34, height: 34, background: 'var(--red)', display: 'grid', placeItems: 'center', clipPath: 'polygon(0 0,100% 0,100% 72%,72% 100%,0 100%)' }}>
          <Icon name="trophy" size={19} />
        </span>
        <span className="disp" style={{ fontSize: 30 }}>LTMS</span>
      </div>

      <div className="sub">
        {USE_MOCK
          ? 'Local Tournament Management System — sign in or pick a demo role.'
          : 'Local Tournament Management System — sign in with your account.'}
      </div>

      <form className="vstack" style={{ gap: 12 }} onSubmit={form.handleSubmit(submit)}>
        <label className="field">
          <span className="label">อีเมล</span>
          <input type="email" placeholder="you@ku.th" {...form.register('email')} />
        </label>
        {form.formState.errors.email && <span className="error">{form.formState.errors.email.message}</span>}

        <label className="field">
          <span className="label">รหัสผ่าน</span>
          <input type="password" placeholder="••••••••" {...form.register('password')} />
        </label>
        {form.formState.errors.password && <span className="error">{form.formState.errors.password.message}</span>}

        {form.formState.errors.root && <span className="error">{form.formState.errors.root.message}</span>}

        {remaining > 0 ? <p role="status">ลองเข้าสู่ระบบบ่อยเกินไป กรุณารออีก {remaining} วินาทีตามเวลาที่เซิร์ฟเวอร์แจ้ง</p> : null}
        <button className="btn primary" type="submit" disabled={login.isPending || remaining > 0}>
          {login.isPending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>
      {(login.error as { code?: string } | null)?.code === 'EMAIL_NOT_VERIFIED' ? <Link className="btn" to={`/register?step=otp&email=${encodeURIComponent(form.getValues('email'))}`}>กลับไปยืนยันอีเมลด้วย OTP</Link> : null}

      <Link className="btn ghost" to="/forgot-password">ลืมรหัสผ่าน?</Link>
      <div className="hstack" style={{ justifyContent: 'space-between', gap: 8 }}>
        <span className="sub">ยังไม่มีบัญชี?</span>
        <Link className="btn ghost" to="/register">สมัครสมาชิก</Link>
      </div>

      {USE_MOCK ? (
        <div className="vstack" style={{ gap: 9 }}>
          {DEMO.map(({ email, password, label, note }) => (
            <button className="who" type="button" key={email} onClick={() => void quickLogin(email, password)}>
              <span className="avatar">{label.slice(0, 1)}</span>
              <span className="meta"><b>{label}</b><span className="tag">{note}</span></span>
              <Icon name="chev" size={13} />
            </button>
          ))}
        </div>
      ) : null}

      <button className="btn ghost" type="button" onClick={() => { continueAsGuest(); navigate('/') }}>
        Continue as guest — browse without signing in
      </button>
      {USE_MOCK ? (
        <div className="hstack" style={{ justifyContent: 'space-between' }}>
          <span className="tag"><em>//</em> Data lives in this browser only</span>
          <button className="btn ghost" type="button" onClick={resetDemo}>Reset demo data</button>
        </div>
      ) : null}
    </div></div>
  )
}
