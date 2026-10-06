import { useState } from 'react'
import type { ReactNode } from 'react'
import { MatchActivity } from './MatchActivity'

export function MatchSection({ active, label, children }: { active: boolean; label: string; children: ReactNode }) {
  const [visited, setVisited] = useState(active)
  // แผงที่เคยเปิดต้องยังอยู่เพื่อรักษา draft ส่วนแผงที่ยังไม่เปิดไม่ควรยิงคำขอเพิ่ม
  if (active && !visited) setVisited(true)
  if (!active && !visited) return null
  return <MatchActivity.Provider value={active}>
    <section className="match-section" hidden={!active} inert={!active} aria-label={label} tabIndex={0}>
      {children}
    </section>
  </MatchActivity.Provider>
}
