/**
 * src/features/auth/RegisterPage.tsx
 *
 * Registration page wired to useRegister(), useVerifyEmail(), and useResendVerification().
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { Icon } from '../../components/kit/Icon'
import { useRegister, useVerifyEmail, useResendVerification } from '../../hooks/useAuth'
import { useDepartments, useFaculties } from '../../hooks/useReference'
import { registerSchema, type RegisterInput } from '../../schemas/auth.schema'

const defaultValues: RegisterInput = {
  fullName: '',
  email: '',
  password: '',
  gender: 'male',
  birthDate: '2000-01-01',
  facultyId: 1,
  departmentId: 1,
  year: 1,
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const step = searchParams.get('step')
  const emailParam = searchParams.get('email') || ''

  const register = useRegister()
  const verifyEmail = useVerifyEmail()
  const resendVerification = useResendVerification()
  const faculties = useFaculties()

  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpSuccess, setOtpSuccess] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown(prev => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues,
  })
  const facultyId = useWatch({ control: form.control, name: 'facultyId' })
  const departments = useDepartments(facultyId)

  useEffect(() => {
    const firstDepartment = departments.data?.items[0]
    if (firstDepartment && !departments.data?.items.some(item => item.id === form.getValues('departmentId'))) {
      form.setValue('departmentId', firstDepartment.id, { shouldValidate: true })
    }
  }, [departments.data, form])

  const submit = async (values: RegisterInput) => {
    try {
      await register.mutateAsync(values)
      navigate(`/register?step=otp&email=${encodeURIComponent(values.email)}`)
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        Object.entries(error.fields).forEach(([field, message]) => {
          form.setError(field as keyof RegisterInput, { type: 'server', message })
        })
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
    if (resendCooldown > 0) return
    setOtpError(null)
    try {
      await resendVerification.mutateAsync({ email: emailParam })
      setResendMessage('ระบบได้ส่งรหัส OTP ใหม่ไปยังอีเมลของคุณเรียบร้อยแล้ว (สามารถขอใหม่ได้สูงสุด 3 ครั้ง/ชั่วโมง)')
      setResendCooldown(60)
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
            {resendMessage && <span className="sub" style={{ color: 'var(--green)' }}>{resendMessage}</span>}

            <button className="btn primary" type="submit" disabled={verifyEmail.isPending || otpCode.length !== 6}>
              {verifyEmail.isPending ? 'กำลังยืนยัน...' : 'ยืนยันรหัส OTP'}
            </button>

            <div className="vstack" style={{ gap: 6, alignItems: 'center', marginTop: 8 }}>
              <button
                className="btn ghost"
                type="button"
                disabled={resendVerification.isPending || resendCooldown > 0}
                onClick={handleResendOtp}
              >
                {resendCooldown > 0 ? `ขอรหัส OTP ใหม่อีกครั้ง (${resendCooldown}s)` : 'ขอรหัส OTP ใหม่อีกครั้ง'}
              </button>
              <span className="sub" style={{ fontSize: 12 }}>
                * สามารถขอรหัสใหม่ได้สูงสุด 3 ครั้ง/ชั่วโมง
              </span>
            </div>
          </form>
        )}

        <div className="hstack" style={{ justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
          <Link className="btn ghost" to="/register">ย้อนกลับไปหน้าสมัคร</Link>
          <Link className="btn ghost" to="/login">เข้าสู่ระบบ</Link>
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

      <form className="vstack" style={{ gap: 12 }} onSubmit={form.handleSubmit(submit)}>
        <label className="field">
          <span className="label">ชื่อ-นามสกุล</span>
          <input type="text" placeholder="สมชาย ใจดี" {...form.register('fullName')} />
        </label>
        {form.formState.errors.fullName && <span className="error">{form.formState.errors.fullName.message}</span>}

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
          <input type="date" {...form.register('birthDate')} />
        </label>
        {form.formState.errors.birthDate && <span className="error">{form.formState.errors.birthDate.message}</span>}

        <label className="field">
          <span className="label">คณะ</span>
          <select {...form.register('facultyId', { valueAsNumber: true })} disabled={faculties.isLoading}>
            {faculties.data?.items.map(faculty => (
              <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
            ))}
          </select>
        </label>
        {form.formState.errors.facultyId && <span className="error">{form.formState.errors.facultyId.message}</span>}

        <label className="field">
          <span className="label">ภาควิชา</span>
          <select {...form.register('departmentId', { valueAsNumber: true })}
            disabled={departments.isLoading || !departments.data?.items.length}>
            {departments.data?.items.map(department => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </label>
        {form.formState.errors.departmentId && <span className="error">{form.formState.errors.departmentId.message}</span>}

        <label className="field">
          <span className="label">ชั้นปี</span>
          <input type="number" min={1} {...form.register('year', { valueAsNumber: true })} />
        </label>
        {form.formState.errors.year && <span className="error">{form.formState.errors.year.message}</span>}

        {form.formState.errors.root && <span className="error">{form.formState.errors.root.message}</span>}

        <button className="btn primary" type="submit" disabled={register.isPending}>
          {register.isPending ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
        </button>
      </form>

      <div className="hstack" style={{ justifyContent: 'space-between', gap: 8 }}>
        <span className="sub">มีบัญชีอยู่แล้ว?</span>
        <Link className="btn ghost" to="/login">เข้าสู่ระบบ</Link>
      </div>
    </div></div>
  )
}
