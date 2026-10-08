import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, USE_MOCK } from '../../api/client'
import { useResendVerification, useVerifyEmail } from '../../hooks/useAuth'
import { verificationEmailSchema, verifyEmailSchema } from '../../schemas/auth.schema'
import { activeOtpRequests, OTP_COOLDOWN_MS, OTP_REQUEST_LIMIT, OTP_WINDOW_MS, readOtpRequests, saveOtpRequest } from './otpRequests'
import './account-workspace.css'

export function VerifyEmailPage({ email: initialEmail, emailVerificationSent }: { email: string; emailVerificationSent?: boolean }) {
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState<{ email?: string; code?: string }>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [verified, setVerified] = useState(false)
  const [deliveryFailed, setDeliveryFailed] = useState(emailVerificationSent === false)
  const [now, setNow] = useState(Date.now)
  const [requests, setRequests] = useState(() => readOtpRequests(initialEmail, Date.now()))
  const verify = useVerifyEmail()
  const resend = useResendVerification()
  const submitting = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const emailField = useRef<HTMLInputElement>(null)
  const codeField = useRef<HTMLInputElement>(null)
  const pending = verify.isPending || resend.isPending
  const times = activeOtpRequests(requests, now)
  const cooldown = Math.max(0, Math.ceil(((times.at(-1) ?? 0) + OTP_COOLDOWN_MS - now) / 1000))
  const limited = times.length >= OTP_REQUEST_LIMIT

  useEffect(() => { if (verified) heading.current?.focus() }, [verified])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    const sync = () => { setNow(Date.now()); setRequests(readOtpRequests(email, Date.now())) }
    window.addEventListener('storage', sync)
    window.addEventListener('focus', sync)
    return () => { window.clearInterval(timer); window.removeEventListener('storage', sync); window.removeEventListener('focus', sync) }
  }, [email])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current) return
    const result = verifyEmailSchema.safeParse({ email: email.trim(), code: code.trim() })
    setError(''); setNotice('')
    if (!result.success) {
      setErrors({ email: result.error.issues.find(issue => issue.path[0] === 'email')?.message, code: result.error.issues.find(issue => issue.path[0] === 'code')?.message })
      if (result.error.issues.some(issue => issue.path[0] === 'email')) emailField.current?.focus()
      else codeField.current?.focus()
      return
    }
    setErrors({}); submitting.current = true
    try {
      const response = await verify.mutateAsync(result.data)
      if (response.emailVerified === true) setVerified(true)
      else setError('Verification could not be confirmed. Try again.')
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Unable to verify. Try again.')
    } finally { submitting.current = false }
  }
  const requestCode = async () => {
    if (submitting.current) return
    const result = verificationEmailSchema.safeParse(email.trim())
    setError(''); setNotice('')
    if (!result.success) { setErrors({ email: result.error.issues[0].message }); emailField.current?.focus(); return }
    const current = activeOtpRequests([...new Set([...requests, ...readOtpRequests(result.data, Date.now())])], Date.now())
    if (current.length >= OTP_REQUEST_LIMIT || Date.now() - (current.at(-1) ?? 0) < OTP_COOLDOWN_MS) {
      setRequests(current); setNow(Date.now()); return
    }
    submitting.current = true; setErrors({})
    try {
      await resend.mutateAsync({ email: result.data })
      const requestedAt = Date.now()
      setRequests(saveOtpRequest(result.data, current, requestedAt)); setNow(requestedAt)
      setDeliveryFailed(false)
      setNotice(USE_MOCK ? 'Demo request received. No email is sent.' : 'Request received. Check your email if a code is available.')
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Unable to request a code. Try again.')
    } finally { submitting.current = false }
  }

  return <main className="auth account-workspace account-verify"><div className="auth-card">
    <header className="account-heading">
      <h1 className="disp" ref={heading} tabIndex={-1}>{verified ? 'Email verified' : 'Verify email'}</h1>
      <p className="sub">{verified ? 'You can now sign in.' : 'Enter the 6-digit code from your email.'}</p>
    </header>
    {verified ? <Link className="btn primary" to="/login">Sign in</Link> : <>
      {USE_MOCK ? <p className="sub" role="status">Demo code: 123456. No email is sent.</p>
        : deliveryFailed && email === initialEmail && !error && !notice && <p className="error" role="alert">Account created. Email could not be sent. Request a new code.</p>}
      <form className="account-form" noValidate onSubmit={event => void submit(event)} aria-busy={pending}>
        <div className="account-field">
          <label className="field"><span className="label">Email</span>
            <input ref={emailField} type="email" autoComplete="email" value={email} disabled={pending} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'otp-email-error' : undefined}
              onChange={event => { setEmail(event.target.value); setCode(''); setErrors({}); setError(''); setNotice(''); setRequests(readOtpRequests(event.target.value, Date.now())); setNow(Date.now()) }} />
          </label>
          {errors.email && <span className="error" role="alert" id="otp-email-error">{errors.email}</span>}
        </div>
        <div className="account-field">
          <label className="field"><span className="label">Code</span>
            <input ref={codeField} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={pending} aria-invalid={!!errors.code} aria-describedby={errors.code ? 'otp-code-error' : undefined}
              onChange={event => { setCode(event.target.value); setErrors(previous => ({ ...previous, code: undefined })); setError(''); setNotice('') }} />
          </label>
          {errors.code && <span className="error" role="alert" id="otp-code-error">{errors.code}</span>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="sub" role="status">{notice}</p>}
        <button className="btn primary" type="submit" disabled={pending}>{verify.isPending ? 'Verifying…' : 'Verify email'}</button>
        <div className="account-actions">
          <button className="btn ghost" type="button" disabled={pending || cooldown > 0 || limited} onClick={() => void requestCode()}>
            {resend.isPending ? 'Requesting…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
          <Link to="/login">Sign in</Link>
        </div>
        <p className="sub">Up to 3 code requests per hour. Wait 60s between requests.</p>
        {limited && <p className="sub" role="status">Request limit reached. Try again in {Math.max(1, Math.ceil((times[0] + OTP_WINDOW_MS - now) / 60000))} min.</p>}
      </form>
    </>}
  </div></main>
}
