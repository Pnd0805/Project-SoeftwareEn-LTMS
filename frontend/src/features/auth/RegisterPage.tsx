/**
 * src/features/auth/RegisterPage.tsx
 *
 * Minimal registration page wired to useRegister() and the schema.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { Icon } from '../../components/kit/Icon'
import { useRegister } from '../../hooks/useAuth'
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
  const register = useRegister()
  const faculties = useFaculties()

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues,
  })
  const facultyId = form.watch('facultyId')
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
      navigate('/login')
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
