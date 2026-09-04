/**
 * src/components/kit/chips.tsx
 *
 * A squad reads as its badge plus its name everywhere it appears. `TeamChip` is
 * the flat one — safe inside a <button>; `TeamLink` opens the squad's page and
 * must never be nested inside another button.
 *
 * ── สองชั้น: View (รับข้อมูล) กับ ตัวเดิม (ค้นจาก store) ────────────────────
 * ชั้นล่าง `*View` รับ `TeamView` / `PlayerView` มาตรงๆ ไม่แตะ store เลย
 * ชั้นบน `TeamChip` / `TeamLink` / `PlayerLink` ยังรับ id แล้วค้น store เหมือนเดิม
 * — ผู้เรียกเดิมทุกที่ไม่ต้องแก้สักบรรทัด
 *
 * เหตุผล: ระหว่างย้ายจาก `shared/store` ไป API layer (PLAN.md v2) แต่ละโดเมนจะมี
 * ข้อมูลทีมอยู่ในมือแล้วจาก DTO ของตัวเอง ไม่ได้อยู่ใน store — ถ้า chip ยังบังคับ
 * ให้ส่ง id มาค้น store ทุกคนจะย้ายไม่ได้จนกว่า Teams จะย้ายเสร็จก่อน ซึ่งบล็อกทั้งทีม
 * ชั้น View ตัดโซ่นั้นออก: ใครมี id, name, code, color ก็วาด chip ได้ทันที
 */
import { Link } from 'react-router-dom'
import { useLtms } from '../../shared/store'
import { team, user } from '../../shared/selectors'
import { toTeamView, type PlayerView, type TeamView } from './viewModels'
import type { Team } from '../../shared/types'

// ══════════════ ชั้น View — ไม่แตะ store ══════════════

export function TeamMarkView({ team: t }: { team?: TeamView | null }) {
  if (!t) return <i style={{ background: 'var(--hairline)' }} />
  return t.logoUrl
    ? <img src={t.logoUrl} alt="" width={16} height={16} style={{ borderRadius: 4, objectFit: 'cover', flex: '0 0 auto' }} />
    : <i style={{ background: t.color ?? 'var(--hairline)' }} />
}

/**
 * ตราประจำทีมแบบสี่เหลี่ยม — ใช้โลโก้ถ้าหัวหน้าทีมตั้งไว้ ไม่มีก็รหัสทีมบนสีประจำทีม
 *
 * ตัวเดียวสำหรับทุกที่ที่เคยวาดกล่องสีเองแล้วลืมรองรับรูป (หน้าทีม หน้าค้นหา
 * หน้าเช็คอิน พาเนลอนุมัติใบสมัคร) — เพิ่มโลโก้ที่เดียวแล้วขึ้นครบทุกจอ
 */
export function TeamCrestView({ team: t, size = 32 }: { team?: TeamView | null; size?: number }) {
  if (!t) return <span className="avatar" style={{ width: size, height: size }}>?</span>
  return (
    <span style={{
      width: size, height: size, flex: 'none', display: 'grid', placeItems: 'center',
      background: t.color ?? 'var(--hairline)', color: 'var(--void)',
      fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: Math.round(size * 0.4),
      clipPath: 'polygon(0 0,100% 0,100% 74%,74% 100%,0 100%)', overflow: 'hidden',
    }}>
      {t.logoUrl
        ? <img src={t.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : t.code}
    </span>
  )
}

export function TeamChipView({ team: t }: { team?: TeamView | null }) {
  if (!t) return <span className="sub">TBD</span>
  return <span className="tchip"><TeamMarkView team={t} />{t.name}</span>
}

export function TeamLinkView({ team: t }: { team?: TeamView | null }) {
  if (!t) return <span className="sub">TBD</span>
  return (
    <Link className="tchip link" to={`/team/${t.id}`} title={`Open ${t.name}`}>
      <TeamMarkView team={t} /><span>{t.name}</span>
    </Link>
  )
}

export function PlayerLinkView({ player: p }: { player?: PlayerView | null }) {
  if (!p) return <span className="sub">—</span>
  return <Link className="tchip link" to={`/player/${p.id}`}><span>{p.name}</span></Link>
}

// ══════════════ ชั้นเดิม — ค้นจาก store, ผู้เรียกไม่ต้องแก้ ══════════════

export function TeamMark({ t }: { t: Team }) {
  return <TeamMarkView team={toTeamView(t)} />
}

export function TeamChip({ id }: { id?: string | null }) {
  const t = team(useLtms(), id)
  return <TeamChipView team={t ? toTeamView(t) : null} />
}

export function TeamLink({ id }: { id?: string | null }) {
  const t = team(useLtms(), id)
  return <TeamLinkView team={t ? toTeamView(t) : null} />
}

export function PlayerLink({ id }: { id?: string | null }) {
  const u = user(useLtms(), id)
  return <PlayerLinkView player={u ? { id: u.id, name: u.name } : null} />
}

export function Avatar({ name, style }: { name?: string; style?: React.CSSProperties }) {
  return <span className="avatar" style={style}>{(name || '?').slice(0, 1)}</span>
}
