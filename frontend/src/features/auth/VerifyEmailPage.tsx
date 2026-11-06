import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, USE_MOCK } from '../../api/client'
import { useResendVerification, useVerifyEmail } from '../../hooks/useAuth'
import { verificationEmailSchema, verifyEmailSchema } from '../../schemas/auth.schema'
import { activeOtpRequests, OTP_COOLDOWN_MS, OTP_REQUEST_LIMIT, OTP_WINDOW_MS, readOtpRequests, saveOtpRequest } from './otpRequests'
import './account-workspace.css'

const OTP_LENGTH = 6
const emptyCode = () => Array<string>(OTP_LENGTH).fill('')

function maskedEmail(email: string) {
  if (!verificationEmailSchema.safeParse(email).success) return 'Email unavailable'
  const [name, domain] = email.split('@')
  return `${name.slice(0, Math.min(2, name.length - 1))}***@${domain}`
}

export function VerifyEmailPage({ email: initialEmail, emailVerificationSent }: { email: string; emailVerificationSent?: boolean }) {
  const email = initialEmail.trim()
  const [code, setCode] = useState(emptyCode)
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
  const emailRecovery = useRef<HTMLAnchorElement>(null)
  const codeFields = useRef<(HTMLInputElement | null)[]>([])
  const pending = verify.isPending || resend.isPending
  const times = activeOtpRequests(requests, now)
  const cooldown = Math.max(0, Math.ceil(((times.at(-1) ?? 0) + OTP_COOLDOWN_MS - now) / 1000))
  const limited = times.length >= OTP_REQUEST_LIMIT

  const focusCode = (index: number) => {
    codeFields.current[index]?.focus()
    codeFields.current[index]?.select()
  }
  const clearCodeFeedback = () => {
    setErrors(previous => ({ ...previous, code: undefined })); setError(''); setNotice('')
  }
  const fillCode = (value: string, index: number) => {
    if (pending) return
    const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (value && !digits) return
    // วาง/เติมรหัสครบชุดจากช่องไหนก็ได้ โดยเก็บเลขศูนย์นำหน้าเป็น string เสมอ
    const start = digits.length === OTP_LENGTH ? 0 : index
    setCode(previous => {
      const next = [...previous]
      if (!digits) next[index] = ''
      else [...digits].forEach((digit, offset) => { if (start + offset < OTP_LENGTH) next[start + offset] = digit })
      return next
    })
    clearCodeFeedback()
    if (digits) focusCode(Math.min(start + digits.length, OTP_LENGTH - 1))
  }
  const navigateCode = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (pending) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      focusCode(Math.max(0, Math.min(OTP_LENGTH - 1, index + (event.key === 'ArrowLeft' ? -1 : 1))))
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      setCode(previous => {
        const next = [...previous]
        next[index] = ''
        if (event.key === 'Backspace' && !previous[index] && index > 0) next[index - 1] = ''
        return next
      })
      clearCodeFeedback()
      if (event.key === 'Backspace') focusCode(Math.max(0, index - 1))
    }
  }

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
    const result = verifyEmailSchema.safeParse({ email: email.trim(), code: code.join('') })
    setError(''); setNotice('')
    if (!result.success) {
      setErrors({ email: result.error.issues.find(issue => issue.path[0] === 'email')?.message, code: result.error.issues.find(issue => issue.path[0] === 'code')?.message })
      if (result.error.issues.some(issue => issue.path[0] === 'email')) emailRecovery.current?.focus()
      else focusCode(Math.max(0, code.findIndex(digit => !digit)))
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
    if (!result.success) { setErrors({ email: result.error.issues[0].message }); emailRecovery.current?.focus(); return }
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
      {USE_MOCK ? <p className="sub" role="status">Demo OTP: 123456. No email is sent.</p>
        : deliveryFailed && !error && !notice && <p className="error" role="alert">Account created. OTP could not be sent. Request a new OTP.</p>}
      <form className="account-form" noValidate onSubmit={event => void submit(event)} aria-busy={pending}>
        <div className="account-field">
          <span className="label" id="otp-email-label">Email</span>
          <p className="otp-email-display" aria-labelledby="otp-email-label" aria-describedby={errors.email ? 'otp-email-error' : undefined}>{maskedEmail(email)}</p>
          {errors.email && <span className="error" role="alert" id="otp-email-error">{errors.email}</span>}
        </div>
        <div className="account-field">
          <span className="label" id="otp-code-label">Code</span>
          <div className="otp-code-fields" role="group" aria-labelledby="otp-code-label" aria-describedby={errors.code ? 'otp-code-error' : undefined}>
            {code.map((digit, index) => <input key={index} ref={field => { codeFields.current[index] = field }}
              type="text" inputMode="numeric" pattern="[0-9]*" autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={OTP_LENGTH} size={1} value={digit} disabled={pending}
              aria-label={`Code digit ${index + 1}`} aria-invalid={!!errors.code} aria-describedby={errors.code ? 'otp-code-error' : undefined}
              data-filled={digit ? 'true' : undefined}
              onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()}
              onChange={event => {
                const input = event.nativeEvent as InputEvent
                fillCode(input.inputType === 'insertText' && input.data?.length === 1 ? input.data : event.currentTarget.value, index)
              }}
              onPaste={event => { event.preventDefault(); fillCode(event.clipboardData.getData('text'), index) }}
              onKeyDown={event => navigateCode(event, index)} />)}
          </div>
          {errors.code && <span className="error" role="alert" id="otp-code-error">{errors.code}</span>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="sub" role="status">{notice}</p>}
        <button className="btn primary" type="submit" disabled={pending}>{verify.isPending ? 'Verifying…' : 'Verify email'}</button>
        <div className="account-actions">
          <button className="btn ghost" type="button" disabled={pending || cooldown > 0 || limited} onClick={() => void requestCode()}>
            {resend.isPending ? 'Requesting…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </div>
        <p className="sub">No OTP within 10 minutes? <Link ref={emailRecovery} to="/register">Register again with the same email.</Link></p>
        <p className="sub">Up to 3 OTP requests per hour. Wait 60s between requests.</p>
        {limited && <p className="sub" role="status">Request limit reached. Try again in {Math.max(1, Math.ceil((times[0] + OTP_WINDOW_MS - now) / 60000))} min.</p>}
      </form>
    </>}
  </div></main>
}
