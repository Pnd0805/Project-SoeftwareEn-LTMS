/**
 * src/features/auth/RegisterPage.tsx
 *
 * Minimal registration page wired to useRegister() and the schema.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useRegister } from '../../hooks/useAuth'
import { useDepartments, useFaculties } from '../../hooks/useReference'
import { registerSchema, type RegisterInput } from '../../schemas/auth.schema'
import './account-workspace.css'

const defaultValues: Partial<RegisterInput> = {
  fullName: '',
  email: '',
  password: '',
  birthDate: '',
}

export function RegisterPage() {
  const navigate = useNavigate()
  const register = useRegister()
  const faculties = useFaculties()

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues,
  })
  const facultyId = useWatch({ control: form.control, name: 'facultyId' })
  const departmentId = useWatch({ control: form.control, name: 'departmentId' })
  const selectedFaculty = Number.isFinite(facultyId) && facultyId > 0 ? facultyId : undefined
  const departments = useDepartments(selectedFaculty)

  const submit = async (values: RegisterInput) => {
    if (!faculties.data?.items.some(item => item.id === values.facultyId)) {
      form.setError('facultyId', { type: 'validate', message: 'Choose an available faculty.' }, { shouldFocus: true })
      return
    }
    if (!departments.data?.items.some(item => item.id === values.departmentId && item.facultyId === values.facultyId)) {
      form.setError('departmentId', { type: 'validate', message: 'Choose a department in this faculty.' }, { shouldFocus: true })
      return
    }
    try {
      await register.mutateAsync(values)
      navigate('/login')
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        Object.entries(error.fields).forEach(([field, message]) => {
          form.setError(field as keyof RegisterInput, { type: 'server', message })
        })
      } else {
        form.setError('root', { type: 'server', message: 'Unable to create your account. Please try again.' })
      }
    }
  }

  return (
    <main className="auth account-workspace account-register"><div className="auth-card">
      <header className="account-heading">
        <h1 className="disp">Create account</h1>
        <p className="sub">Join LTMS. Already registered? <Link to="/login">Sign in</Link>.</p>
      </header>

      <form className="account-form" onSubmit={form.handleSubmit(submit)} aria-busy={register.isPending}>
        <fieldset className="account-fieldset">
          <legend>Account details</legend>
          <div className="account-fields">
            <div className="account-field account-wide">
              <label className="field">
                <span className="label">Full name</span>
                <input type="text" placeholder="Your full name" autoComplete="name" aria-invalid={!!form.formState.errors.fullName}
                  aria-describedby={form.formState.errors.fullName ? 'register-name-error' : undefined} {...form.register('fullName')} />
              </label>
              {form.formState.errors.fullName && <span className="error" id="register-name-error" role="alert">{form.formState.errors.fullName.message}</span>}
            </div>
            <div className="account-field">
              <label className="field">
                <span className="label">Email</span>
                <input type="email" placeholder="you@ku.th" autoComplete="email" aria-invalid={!!form.formState.errors.email}
                  aria-describedby={form.formState.errors.email ? 'register-email-error' : undefined} {...form.register('email')} />
              </label>
              {form.formState.errors.email && <span className="error" id="register-email-error" role="alert">{form.formState.errors.email.message}</span>}
            </div>
            <div className="account-field">
              <label className="field">
                <span className="label">Password</span>
                <input type="password" placeholder="Choose a password" autoComplete="new-password" aria-invalid={!!form.formState.errors.password}
                  aria-describedby={form.formState.errors.password ? 'register-password-hint register-password-error' : 'register-password-hint'} {...form.register('password')} />
              </label>
              <span className="sub" id="register-password-hint">At least 8 characters, including a number.</span>
              {form.formState.errors.password && <span className="error" id="register-password-error" role="alert">{form.formState.errors.password.message}</span>}
            </div>
          </div>
        </fieldset>
        <fieldset className="account-fieldset">
          <legend>Student details</legend>
          <div className="account-fields">
            <div className="account-field">
              <label className="field">
                <span className="label">Gender</span>
                <select aria-invalid={!!form.formState.errors.gender} aria-describedby={form.formState.errors.gender ? 'register-gender-error' : undefined} {...form.register('gender')}>
                  <option value="">Choose gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>
              {form.formState.errors.gender && <span className="error" id="register-gender-error" role="alert">{form.formState.errors.gender.message}</span>}
            </div>
            <div className="account-field">
              <label className="field">
                <span className="label">Birth date</span>
                <input type="date" autoComplete="bday" aria-invalid={!!form.formState.errors.birthDate}
                  aria-describedby={form.formState.errors.birthDate ? 'register-birth-error' : undefined} {...form.register('birthDate')} />
              </label>
              {form.formState.errors.birthDate && <span className="error" id="register-birth-error" role="alert">{form.formState.errors.birthDate.message}</span>}
            </div>
            <div className="account-field">
              <label className="field">
                <span className="label">Faculty</span>
                <select {...form.register('facultyId', { valueAsNumber: true, onChange: () => form.resetField('departmentId') })} disabled={faculties.isLoading}
                  aria-invalid={!!form.formState.errors.facultyId} aria-describedby={form.formState.errors.facultyId ? 'register-faculty-error' : undefined}>
                  <option value="">Choose faculty</option>
                  {faculties.data?.items.map(faculty => (
                    <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                  ))}
                </select>
              </label>
              <span className="sub account-reference-value">{faculties.data?.items.find(item => item.id === facultyId)?.name}</span>
              {form.formState.errors.facultyId && <span className="error" id="register-faculty-error" role="alert">{form.formState.errors.facultyId.message}</span>}
              {faculties.isLoading && <span className="sub" role="status">Loading faculties…</span>}
              {faculties.isError && <div className="error" role="alert">Unable to load faculties. <button className="btn ghost" type="button" onClick={() => void faculties.refetch()}>Retry faculties</button></div>}
              {faculties.isSuccess && !faculties.data.items.length && <span className="sub">No faculties available.</span>}
            </div>
            <div className="account-field">
              <label className="field">
                <span className="label">Department</span>
                <select {...form.register('departmentId', { valueAsNumber: true })}
                  disabled={!selectedFaculty || departments.isLoading || !departments.data?.items.length}
                  aria-invalid={!!form.formState.errors.departmentId} aria-describedby={form.formState.errors.departmentId ? 'register-department-error' : undefined}>
                  <option value="">Choose department</option>
                  {departments.data?.items.map(department => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </label>
              <span className="sub account-reference-value">{departments.data?.items.find(item => item.id === departmentId)?.name}</span>
              {form.formState.errors.departmentId && <span className="error" id="register-department-error" role="alert">{form.formState.errors.departmentId.message}</span>}
              {departments.isLoading && <span className="sub" role="status">Loading departments…</span>}
              {departments.isError && <div className="error" role="alert">Unable to load departments. <button className="btn ghost" type="button" onClick={() => void departments.refetch()}>Retry departments</button></div>}
              {!selectedFaculty ? <span className="sub">Choose a faculty first.</span> : null}
              {selectedFaculty && departments.isSuccess && !departments.data.items.length && <span className="sub">No departments available for this faculty.</span>}
            </div>
            <div className="account-field">
              <label className="field">
                <span className="label">Year</span>
                <input type="number" min={1} aria-invalid={!!form.formState.errors.year}
                  aria-describedby={form.formState.errors.year ? 'register-year-error' : undefined} {...form.register('year', { valueAsNumber: true })} />
              </label>
              {form.formState.errors.year && <span className="error" id="register-year-error" role="alert">{form.formState.errors.year.message}</span>}
            </div>
          </div>
        </fieldset>
        {form.formState.errors.root && <span className="error" role="alert">{form.formState.errors.root.message}</span>}

        <button className="btn primary" type="submit" disabled={register.isPending}>
          {register.isPending ? 'Creating account…' : 'Create account'}
        </button>
        {register.isPending && <span className="sub" role="status">Creating your account. Please wait.</span>}
      </form>

    </div></main>
  )
}
