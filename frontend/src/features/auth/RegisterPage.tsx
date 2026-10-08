/**
 * src/features/auth/RegisterPage.tsx
 *
 * Registration page wired to useRegister(), useVerifyEmail(), and useResendVerification().
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { isKuEmail } from '../../shared/kuEmail'
import { Icon } from '../../components/kit/Icon'
import { useRegister, useVerifyEmail, useResendVerification } from '../../hooks/useAuth'
import { useDepartments, useFaculties } from '../../hooks/useReference'
import { personalRegisterSchema, registerSchema, type RegisterInput } from '../../schemas/auth.schema'
import { activeOtpRequests, readOtpRequests, saveOtpRequest, OTP_COOLDOWN_MS, OTP_REQUEST_LIMIT, OTP_WINDOW_MS } from './otpRequests'

const defaultValues: RegisterInput = {
  fullName: '',
  email: '',
  password: '',
  gender: 'male',
  birthDate: '2000-01-01',
  facultyId: 0,
  departmentId: 0,
  year: 1,
}

const personalFields = ['email', 'fullName', 'password', 'gender', 'birthDate'] as const

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const step = searchParams.get('step')
  const emailParam = searchParams.get('email') || ''

  const register = useRegister()
  const verifyEmail = useVerifyEmail()
  const resendVerification = useResendVerification()
  const [accountStep, setAccountStep] = useState<'personal' | 'student'>('personal')
  const stepTitle = useRef<HTMLHeadingElement>(null)

  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpSuccess, setOtpSuccess] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const [requestHistory, setRequestHistory] = useState(() => ({ email: emailParam, times: readOtpRequests(emailParam, Date.now()) }))
  const requestTimes = activeOtpRequests(requestHistory.email === emailParam ? requestHistory.times : readOtpRequests(emailParam, clock), clock)
  const quotaReached = requestTimes.length >= OTP_REQUEST_LIMIT
  const quotaSeconds = quotaReached ? Math.max(0, Math.ceil((requestTimes[requestTimes.length - OTP_REQUEST_LIMIT] + OTP_WINDOW_MS - clock) / 1000)) : 0
  const resendCooldown = requestTimes.length ? Math.max(0, Math.ceil((requestTimes.at(-1)! + OTP_COOLDOWN_MS - clock) / 1000)) : 0

  useEffect(() => {
    if (step !== 'otp') return
    const refresh = () => setClock(Date.now())
    const storage = () => { setRequestHistory({ email: emailParam, times: readOtpRequests(emailParam, Date.now()) }); refresh() }
    const timer = setInterval(refresh, 1000)
    window.addEventListener('storage', storage)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(timer); window.removeEventListener('storage', storage); window.removeEventListener('focus', refresh) }
  }, [step, emailParam])

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues,
  })
  const emailRegistration = form.register('email')
  const facultyRegistration = form.register('facultyId', { valueAsNumber: true })
  const email = useWatch({ control: form.control, name: 'email' })
  const facultyId = useWatch({ control: form.control, name: 'facultyId' }) ?? 0
  const departmentId = useWatch({ control: form.control, name: 'departmentId' })
  const studentStep = step !== 'otp' && accountStep === 'student' && isKuEmail(email)
  const faculties = useFaculties(studentStep)
  const departments = useDepartments(studentStep && facultyId > 0 ? facultyId : undefined)
  const referenceReady = faculties.isSuccess && departments.isSuccess
    && faculties.data.items.some(item => item.id === facultyId)
    && departments.data.items.some(item => item.id === departmentId)

  useEffect(() => {
    stepTitle.current?.focus()
  }, [accountStep, step])

  const showPersonal = () => {
    setAccountStep('personal')
    form.clearErrors('root')
  }

  const handleAccountSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (register.isPending || form.formState.isSubmitting) return
    form.clearErrors('root')
    if (studentStep) {
      if (!referenceReady) return
      await form.handleSubmit(submit, errors => {
        if (personalFields.some(field => errors[field])) setAccountStep('personal')
      })(event)
      return
    }
    const valid = await form.trigger([...personalFields], { shouldFocus: true })
    if (!valid) return
    if (isKuEmail(form.getValues('email'))) {
      setAccountStep('student')
    } else {
      // Strip even valid study values retained after Back; external accounts submit personal details only.
      await submit(personalRegisterSchema.parse(form.getValues()))
    }
  }

  const submit = async (values: RegisterInput) => {
    if (isKuEmail(values.email) && !referenceReady) return
    try {
      await register.mutateAsync(values)
      const now = Date.now()
      setRequestHistory({ email: values.email, times: saveOtpRequest(values.email, readOtpRequests(values.email, now), now) })
      setClock(now)
      navigate(`/register?step=otp&email=${encodeURIComponent(values.email)}`)
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        Object.entries(error.fields).forEach(([field, message]) => {
          form.setError(field as keyof RegisterInput, { type: 'server', message })
        })
        if (personalFields.some(field => error.fields?.[field])) setAccountStep('personal')
      } else {
        form.setError('root', { type: 'server', message: 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' })
      }
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setOtpError(null)
    try {
      await verifyEmail.mutateAsync({ email: emailParam, code: otpCode.trim() })
      setOtpSuccess(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setOtpError(err.message || 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ')
      } else if (err instanceof Error) {
        setOtpError(err.message)
      } else {
        setOtpError('ยืนยันรหัส OTP ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      }
    }
  }

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || quotaReached || resendVerification.isPending) return
    setOtpError(null)
    setResendMessage(null)
    try {
      await resendVerification.mutateAsync({ email: emailParam })
      const now = Date.now()
      setRequestHistory({ email: emailParam, times: saveOtpRequest(emailParam, requestTimes, now) })
      setClock(now)
      setResendMessage('รับคำขอแล้ว หากอีเมลนี้ยังรอยืนยันและไม่เกินโควตา ระบบจะส่งรหัสใหม่ให้ กรุณาตรวจกล่องจดหมายและสแปม (สูงสุด 3 ครั้ง/ชั่วโมง)')
    } catch (err) {
      if (err instanceof ApiError) {
        setOtpError(err.message)
      } else {
        setOtpError('ไม่สามารถส่งรหัสใหม่ได้ กรุณาลองอีกครั้ง')
      }
    }
  }

  if (step === 'otp') {
    return (
      <div className="auth"><div className="auth-card">
        <div className="hstack" style={{ gap: 11 }}>
          <span style={{ width: 34, height: 34, background: 'var(--red)', display: 'grid', placeItems: 'center', clipPath: 'polygon(0 0,100% 0,100% 72%,72% 100%,0 100%)' }}>
            <Icon name="trophy" size={19} />
          </span>
          <span className="disp" style={{ fontSize: 30 }}>LTMS</span>
        </div>

        <div className="disp" style={{ fontSize: 20 }}>
          ยืนยันรหัส OTP (Email Verification)
        </div>

        <div className="sub">
          กรุณากรอกรหัส OTP 6 หลักที่ส่งไปยังอีเมล <b>{emailParam}</b>
        </div>

        {otpSuccess ? (
          <div className="vstack" style={{ gap: 16 }}>
            <div className="banner ok">
              <b>ยืนยันอีเมลสำเร็จเรียบร้อยแล้ว!</b> คุณสามารถเข้าสู่ระบบเพื่อเริ่มใช้งานได้ทันที
            </div>
            <button className="btn primary" type="button" onClick={() => navigate('/login')}>
              เข้าสู่ระบบ
            </button>
          </div>
        ) : (
          <form className="vstack" style={{ gap: 12 }} onSubmit={handleVerifyOtp}>
            <label className="field">
              <span className="label">รหัส OTP 6 หลัก</span>
              <input
                type="text"
                placeholder="123456"
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </label>

            {otpError && <span className="error">{otpError}</span>}
            {quotaReached ? <div className="banner warn" role="status">
              <b>คุณขอรหัสครบ 3 ครั้งในช่วง 1 ชั่วโมงจากเบราว์เซอร์นี้แล้ว</b> ขอใหม่ได้ในอีก {Math.ceil(quotaSeconds / 60)} นาที
            </div> : resendMessage && <span className="sub" role="status">{resendMessage}</span>}

            <button className="btn primary" type="submit" disabled={verifyEmail.isPending || otpCode.length !== 6}>
              {verifyEmail.isPending ? 'กำลังยืนยัน...' : 'ยืนยันรหัส OTP'}
            </button>

            <div className="vstack" style={{ gap: 6, alignItems: 'center', marginTop: 8 }}>
              <button
                className="btn ghost"
                type="button"
                disabled={resendVerification.isPending || resendCooldown > 0 || quotaReached}
                onClick={handleResendOtp}
              >
                {quotaReached ? 'ขอรหัส OTP ใหม่อีกครั้ง — ครบโควตา 3 ครั้ง/ชั่วโมง' : resendCooldown > 0 ? `ขอรหัส OTP ใหม่อีกครั้ง (${resendCooldown}s)` : 'ขอรหัส OTP ใหม่อีกครั้ง'}
              </button>
              <span className="sub" style={{ fontSize: 12 }}>
                * สูงสุด 3 ครั้ง/ชั่วโมง รวมรหัสครั้งแรกตอนสมัคร · เบราว์เซอร์นี้บันทึก {requestTimes.length}/3 ครั้ง
              </span>
            </div>
          </form>
        )}

        <div className="hstack" style={{ justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
          <Link className="btn ghost" to="/register">ย้อนกลับไปหน้าสมัคร</Link>
          {!otpSuccess ? <span className="sub">กรุณายืนยัน OTP ให้สำเร็จก่อนเข้าสู่ระบบ</span> : null}
        </div>
      </div></div>
    )
  }

  return (
    <div className="auth"><div className="auth-card">
      <div className="hstack" style={{ gap: 11 }}>
        <span style={{ width: 34, height: 34, background: 'var(--red)', display: 'grid', placeItems: 'center', clipPath: 'polygon(0 0,100% 0,100% 72%,72% 100%,0 100%)' }}>
          <Icon name="trophy" size={19} />
        </span>
        <span className="disp" style={{ fontSize: 30 }}>LTMS</span>
      </div>

      <div className="sub">
        สมัครสมาชิกเพื่อเข้าระบบ LTMS
      </div>

      <h2 ref={stepTitle} tabIndex={-1} className="disp" style={{ fontSize: 20 }}>
        {studentStep ? 'ขั้นตอนที่ 2: ข้อมูลนิสิต' : 'ขั้นตอนที่ 1: ข้อมูลส่วนตัว'}
      </h2>
      <form noValidate className="vstack" style={{ gap: 12 }} onSubmit={event => { void handleAccountSubmit(event) }}>
        {!studentStep ? <>
        <label className="field">
          <span className="label">อีเมล</span>
          <input type="email" autoComplete="email" placeholder="you@example.com"
            aria-invalid={!!form.formState.errors.email} aria-describedby={form.formState.errors.email ? 'register-email-error' : undefined}
            {...emailRegistration} />
        </label>
        {form.formState.errors.email && <span className="error" id="register-email-error">{form.formState.errors.email.message}</span>}

        <label className="field">
          <span className="label">ชื่อ-นามสกุล</span>
          <input type="text" autoComplete="name" placeholder="สมชาย ใจดี"
            aria-invalid={!!form.formState.errors.fullName} aria-describedby={form.formState.errors.fullName ? 'register-name-error' : undefined}
            {...form.register('fullName')} />
        </label>
        {form.formState.errors.fullName && <span className="error" id="register-name-error">{form.formState.errors.fullName.message}</span>}

        <label className="field">
          <span className="label">รหัสผ่าน</span>
          <input type="password" autoComplete="new-password" placeholder="••••••••"
            aria-invalid={!!form.formState.errors.password} aria-describedby={form.formState.errors.password ? 'register-password-error' : undefined}
            {...form.register('password')} />
        </label>
        {form.formState.errors.password && <span className="error" id="register-password-error">{form.formState.errors.password.message}</span>}

        <label className="field">
          <span className="label">เพศ</span>
          <select {...form.register('gender')}>
            <option value="male">ชาย</option>
            <option value="female">หญิง</option>
            <option value="other">อื่น ๆ</option>
          </select>
        </label>

        <label className="field">
          <span className="label">วันเกิด</span>
          <input type="date" autoComplete="bday"
            aria-invalid={!!form.formState.errors.birthDate} aria-describedby={form.formState.errors.birthDate ? 'register-birth-error' : undefined}
            {...form.register('birthDate')} />
        </label>
        {form.formState.errors.birthDate && <span className="error" id="register-birth-error">{form.formState.errors.birthDate.message}</span>}

        <p className="sub">นิสิต/บุคลากรใช้อีเมล @ku.th เพื่อรับสิทธิ์ภายในและกรอกข้อมูลนิสิตในขั้นตอนถัดไป อีเมลอื่นจะสมัครเป็นบุคคลภายนอก เปลี่ยนอีเมลหลังสมัครไม่ได้</p>
        </> : <>
        <p className="sub">สมัครด้วยอีเมล <b>{email}</b> กรุณากรอกข้อมูลนิสิตของคุณ</p>
        {faculties.isPending ? <p className="sub" role="status">กำลังโหลดข้อมูลคณะ…</p> : null}
        {facultyId > 0 && departments.isPending ? <p className="sub" role="status">กำลังโหลดข้อมูลสาขา…</p> : null}
        {faculties.isError ? <div className="banner crit" role="alert">โหลดข้อมูลคณะไม่สำเร็จ <button type="button" className="btn" onClick={() => void faculties.refetch()}>ลองใหม่</button></div> : null}
        {departments.isError ? <div className="banner crit" role="alert">โหลดข้อมูลสาขาไม่สำเร็จ <button type="button" className="btn" onClick={() => void departments.refetch()}>ลองใหม่</button></div> : null}
        {faculties.isSuccess && !faculties.data.items.length ? <div className="banner warn" role="alert">ยังไม่มีข้อมูลคณะ กรุณาติดต่อผู้ดูแล</div> : null}

        <label className="field">
          <span className="label">คณะ</span>
          <select {...facultyRegistration}
            onChange={event => {
              void facultyRegistration.onChange(event)
              form.setValue('departmentId', 0)
              form.clearErrors('departmentId')
            }}
            aria-invalid={!!form.formState.errors.facultyId} aria-describedby={form.formState.errors.facultyId ? 'register-faculty-error' : undefined}
            disabled={faculties.isPending || faculties.isError || register.isPending}>
            <option value={0}>เลือกคณะ</option>
            {faculties.data?.items.map(faculty => (
              <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
            ))}
          </select>
        </label>
        {form.formState.errors.facultyId && <span className="error" id="register-faculty-error">{form.formState.errors.facultyId.message}</span>}

        <label className="field">
          <span className="label">สาขา / ภาควิชา</span>
          <select {...form.register('departmentId', { valueAsNumber: true })}
            aria-invalid={!!form.formState.errors.departmentId} aria-describedby={form.formState.errors.departmentId ? 'register-department-error' : undefined}
            disabled={facultyId <= 0 || departments.isPending || departments.isError || !departments.data?.items.length || register.isPending}>
            <option value={0}>เลือกสาขา / ภาควิชา</option>
            {departments.data?.items.map(department => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </label>
        {form.formState.errors.departmentId && <span className="error" id="register-department-error">{form.formState.errors.departmentId.message}</span>}
        {departments.isSuccess && facultyId > 0 && !departments.data.items.length ? <div className="banner warn" role="alert">คณะนี้ยังไม่มีข้อมูลสาขา กรุณาเลือกคณะอื่นหรือติดต่อผู้ดูแล</div> : null}

        <label className="field">
          <span className="label">ชั้นปี</span>
          <input type="number" min={1} max={8} disabled={register.isPending}
            aria-invalid={!!form.formState.errors.year} aria-describedby={form.formState.errors.year ? 'register-year-error' : undefined}
            {...form.register('year', { valueAsNumber: true })} />
        </label>
        {form.formState.errors.year && <span className="error" id="register-year-error">{form.formState.errors.year.message}</span>}
        <button className="btn ghost" type="button" disabled={register.isPending} onClick={showPersonal}>ย้อนกลับไปข้อมูลส่วนตัว</button>
        </>}

        {form.formState.errors.root && <span className="error">{form.formState.errors.root.message}</span>}

        <button className="btn primary" type="submit" disabled={register.isPending || form.formState.isSubmitting || (studentStep && !referenceReady)}>
          {register.isPending ? 'กำลังสมัครสมาชิก...' : studentStep || !isKuEmail(email) ? 'สมัครสมาชิก' : 'ถัดไป: ข้อมูลนิสิต'}
        </button>
      </form>

      <div className="hstack" style={{ justifyContent: 'space-between', gap: 8 }}>
        <span className="sub">มีบัญชีอยู่แล้ว?</span>
        <Link className="btn ghost" to="/login">เข้าสู่ระบบ</Link>
      </div>
    </div></div>
  )
}
