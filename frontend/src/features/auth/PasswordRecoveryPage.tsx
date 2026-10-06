import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Banner, Field } from '../../components/kit/primitives'
import { useForgotPassword, useResetPassword } from '../../hooks/useAuth'

export function PasswordRecoveryPage({ reset = false }: { reset?: boolean }) {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const forgot = useForgotPassword()
  const change = useResetPassword()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const validToken = /^[a-f0-9]{64}$/i.test(token)
  const validPassword = password.length >= 8 && /[0-9]/.test(password)
  const busy = forgot.isPending || change.isPending
  const error = reset ? change.error : forgot.error

  return <div className="auth"><div className="auth-card">
    <h1 className="disp">{reset ? 'Reset password' : 'Forgot password'}</h1>
    {done ? <Banner kind="ok">{reset
      ? 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสใหม่'
      : 'รับคำขอแล้ว หากอีเมลนี้อยู่ในระบบ คุณจะได้รับลิงก์ตั้งรหัสใหม่ กรุณาตรวจกล่องจดหมายและสแปม'}</Banner>
      : reset && !validToken ? <Banner kind="crit">ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือไม่มี token กรุณาขอลิงก์ใหม่</Banner>
        : <form className="vstack" onSubmit={async e => {
          e.preventDefault()
          if (busy || (reset && (!validToken || !validPassword || password !== confirm))) return
          try {
            if (reset) await change.mutateAsync({ token, newPassword: password })
            else await forgot.mutateAsync(email.trim())
            setPassword(''); setConfirm(''); setDone(true)
          } catch { /* Mutation supplies the visible error below. */ }
        }}>
          {reset ? <>
            <Field label="New password" htmlFor="reset-password"><input id="reset-password" type="password" autoComplete="new-password" required value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /></Field>
            <p className="sub">อย่างน้อย 8 ตัวอักษร และมีตัวเลขอย่างน้อย 1 ตัว</p>
            <Field label="Confirm new password" htmlFor="reset-confirm"><input id="reset-confirm" type="password" autoComplete="new-password" required value={confirm} disabled={busy} onChange={e => setConfirm(e.target.value)} /></Field>
            {confirm && password !== confirm ? <p role="alert">รหัสผ่านทั้งสองช่องไม่ตรงกัน</p> : null}
          </> : <Field label="Email" htmlFor="recovery-email"><input id="recovery-email" type="email" autoComplete="email" required value={email} disabled={busy} onChange={e => setEmail(e.target.value)} /></Field>}
          {error ? <Banner kind="crit">{error instanceof Error ? error.message : 'ทำรายการไม่สำเร็จ กรุณาลองใหม่'}</Banner> : null}
          <button className="btn primary" disabled={busy || (reset && (!validPassword || password !== confirm))}>{busy ? 'Sending…' : reset ? 'Set new password' : 'Send reset link'}</button>
        </form>}
    {reset ? <Link className="btn ghost" to="/forgot-password">Request a new link</Link> : null}
    <Link className="btn ghost" to="/login">Back to login</Link>
  </div></div>
}
