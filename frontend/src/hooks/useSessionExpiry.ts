import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { SESSION_EXPIRED_EVENT, USE_MOCK } from '../api/client'
import { signout } from '../shared/store'

/** ให้ Guard เห็น session ที่หมดอายุจาก API ทุกเส้น ไม่ต้องรอ /me รอบถัดไป */
export function useSessionExpiry() {
  const qc = useQueryClient()
  useEffect(() => {
    if (USE_MOCK) return
    const expire = () => {
      void qc.cancelQueries()
      // เก็บ query ของตัวตนไว้เพื่อแจ้ง observer ที่ Guard ใช้อยู่ก่อนล้างข้อมูลส่วนตัว
      qc.setQueryData(['me'], null)
      qc.removeQueries({ predicate: query => !(query.queryKey.length === 1 && query.queryKey[0] === 'me') })
      signout()
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, expire)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire)
  }, [qc])
}
