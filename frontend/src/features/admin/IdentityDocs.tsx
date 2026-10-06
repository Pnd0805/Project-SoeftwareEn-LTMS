/**
 * เอกสารยืนยันตัวตนในคิว AR01 — BE_KN `462fdb1` ส่ง presigned URL (อายุ 20 นาที) แทน S3 key ดิบ
 *
 * BE ไม่เช็คว่าไฟล์ยังอยู่ก่อนเซ็นลิงก์ (กันคิวเปิดไม่ได้ตอน storage ล่ม) ลิงก์จึงตอบ 403/404 ได้
 * เมื่อหมดอายุหรือไฟล์หาย — ต้องบอกว่า "เปิดไม่ได้ ลองรีเฟรชคิว" ไม่ใช่ "ไม่มีเอกสาร" เพราะ
 * แอดมินจะตัดสินคนละทาง: ไม่มีเอกสาร = ทวงเอกสาร · เปิดไม่ได้ = รีเฟรชแล้วดูใหม่ (`docsSubmitted` บอกว่ามีจริง)
 * ไฟล์ภาพตรวจจากการโหลด preview ได้ · PDF ตรวจข้าม origin ไม่ได้ จึงบอกอายุลิงก์แทน
 */
import { useState } from 'react'

/** ตัดให้เหลือเวลาเผื่อก่อน 20 นาทีจริง — ลิงก์ที่กดตอนนาทีที่ 19:59 ก็หมดระหว่างโหลดได้ */
export const DOC_LINK_TTL_MS = 18 * 60 * 1000
const IMAGE = /\.(jpe?g|png|webp|gif)$/i

/** href ได้เฉพาะ http(s) — ค่ามาจาก server ก็จริง แต่ `javascript:` ใน href รันได้ทันทีที่กด */
function linkOf(doc: string): URL | null {
  try {
    const url = new URL(doc)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function fileName(doc: string, url: URL | null) {
  const path = url ? url.pathname : doc.split('?')[0]
  const last = path.split('/').filter(Boolean).at(-1) ?? doc
  try { return decodeURIComponent(last) } catch { return last }
}

export function IdentityDocs({ docs, docsSubmitted, fetchedAt, now, onRefresh, refreshing }: {
  docs: string[] | undefined
  docsSubmitted: boolean | undefined
  fetchedAt: number
  now: number
  onRefresh: () => void
  refreshing: boolean
}) {
  const [broken, setBroken] = useState<Record<string, true>>({})
  const list = docs ?? []
  const refresh = <button className="btn" type="button" disabled={refreshing} onClick={onRefresh}>
    {refreshing ? 'Refreshing…' : 'Refresh queue'}
  </button>

  if (!list.length) {
    return docsSubmitted === true
      ? <div className="sub" role="alert">ส่งเอกสารแล้วแต่ไม่ได้รับลิงก์ — รีเฟรชคิวเพื่อขอลิงก์ใหม่ {refresh}</div>
      : <span className="sub">ยังไม่มีเอกสาร</span>
  }

  const links = list.map(doc => linkOf(doc))
  const expired = links.some(Boolean) && now - fetchedAt > DOC_LINK_TTL_MS
  const anyBroken = list.some(doc => broken[doc])

  return <div className="stack" style={{ gap: 4, minWidth: 220, overflowWrap: 'anywhere' }}>
    <div>{list.length} ไฟล์</div>
    {list.map((doc, index) => {
      const url = links[index]
      const label = `เอกสาร ${index + 1} · ${fileName(doc, url)}`
      if (!url) return <div className="sub" key={doc}>{label}</div>
      return <div key={doc}>
        <a href={url.href} target="_blank" rel="noopener noreferrer">{label}</a>
        {IMAGE.test(url.pathname) && !broken[doc] && !expired ? (
          <img src={url.href} alt={label} loading="lazy"
            style={{ display: 'block', maxWidth: 160, maxHeight: 120, marginTop: 4, objectFit: 'contain' }}
            onError={() => setBroken(b => ({ ...b, [doc]: true }))} />
        ) : null}
      </div>
    })}
    {anyBroken ? <div className="sub" role="alert">
      เปิดเอกสารไม่ได้ — ลิงก์อาจหมดอายุหรือไฟล์ไม่อยู่ในที่เก็บแล้ว ลองรีเฟรชคิว ถ้ายังเปิดไม่ได้ให้กด Request documents {refresh}
    </div> : expired ? <div className="sub" role="alert">
      ลิงก์เอกสารมีอายุ 20 นาทีและน่าจะหมดแล้ว — รีเฟรชคิวเพื่อรับลิงก์ใหม่ {refresh}
    </div> : links.some(Boolean) ? null : <span className="sub">ยังเปิดดูเอกสารไม่ได้ในระบบนี้</span>}
  </div>
}
