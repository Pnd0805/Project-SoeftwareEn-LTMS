import { useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import { CalendarDays } from 'lucide-react'
import { formatScheduleDate, parseScheduleDate, schedulePickerValue } from './scheduleDate'
import './schedule-date-input.css'

type Props = Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'> & {
  value: string; onChange: (value: string) => void; label: string; withTime?: boolean
}

export function ScheduleDateInput({ value, onChange, label, withTime = false, ...inputProps }: Props) {
  const picker = useRef<HTMLInputElement>(null)
  const [fallback, setFallback] = useState(false)
  const placeholder = withTime ? '31 Oct 2026, 02:28 (UTC+7)' : '31 Oct 2026'
  return <div className="schedule-date-input">
    <input {...inputProps} type="text" value={formatScheduleDate(value, withTime)} placeholder={placeholder} autoComplete="off"
      onChange={event => onChange(parseScheduleDate(event.target.value, withTime) ?? event.target.value)} />
    <button className="schedule-date-picker-button" type="button" aria-label={`Choose ${label}`} disabled={inputProps.disabled}
      onClick={() => {
        try {
          if (!picker.current?.showPicker) { setFallback(true); return }
          picker.current.showPicker()
        } catch { setFallback(true) }
      }}><CalendarDays size={18} aria-hidden="true" /></button>
    <input ref={picker} type={withTime ? 'datetime-local' : 'date'} value={schedulePickerValue(value, withTime)}
      className={fallback ? 'schedule-date-native-fallback' : 'schedule-date-native'} tabIndex={fallback ? 0 : -1}
      aria-label={`Calendar selection for ${label}`} aria-hidden={!fallback} disabled={inputProps.disabled}
      onChange={event => onChange(parseScheduleDate(event.target.value, withTime) ?? event.target.value)} />
  </div>
}
