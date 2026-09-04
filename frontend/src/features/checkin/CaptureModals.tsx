/**
 * src/features/checkin/CaptureModals.tsx
 *
 * สองวิธียืนยันตัวตนตอนเช็คอิน ซึ่งต่างกันเพราะสิ่งที่มันพิสูจน์ต่างกัน
 *
 *   on-site (FR-PV-03)  สแกน QR ที่โต๊ะกรรมการ — QR หมุนทุกนาที คนที่สแกนได้จึง
 *                       ต้องอยู่ตรงนั้นจริง สกรีนช็อตส่งต่อกันไม่ได้
 *   online  (FR-PV-04)  ไม่มีอะไรพิสูจน์ว่าอยู่ที่ไหน จึงถ่ายรูปหน้าคู่บัตรนักศึกษา
 *                       แล้วให้กรรมการเป็นคนตัดสิน — ผ่านเลยไม่ได้
 *
 * ── ขอบเขตของงานนี้ ──────────────────────────────────────────────────────
 * เป็น UI จริง แต่ตัวถอดรหัส QR ยังเป็น mock: ไม่มีไลบรารีอ่านภาพ จึงเทียบรหัส
 * ที่พิมพ์/ที่จำลองว่าสแกนได้ กับ `expectedToken` ตรงๆ ของจริงต้องต่อ
 * BarcodeDetector หรือ zxing แล้วอ่านจากเฟรมวิดีโอ — จุดต่อคือ `onScanned`
 *
 * กล้องเปิดด้วย getUserMedia จริง ถ้าเครื่องไม่มีกล้องหรือผู้ใช้ไม่อนุญาต **ไม่มี**
 * ทางให้แนบไฟล์แทน — UC-04 E2b กำหนดว่าเมื่อกล้องใช้ไม่ได้ ให้กรรมการยืนยันด้วย
 * ตนเองแล้วบันทึกเป็นข้อยกเว้นพร้อมเหตุผล ซึ่งสมเหตุสมผล เพราะไฟล์ที่แนบมาจะเป็น
 * รูปเมื่อไหร่ก็ได้ ไม่ได้พิสูจน์ว่าคนนั้นอยู่ตรงนั้นตอนนี้จริง (ดู ManualVerifyModal)
 */
import { useEffect, useRef, useState } from 'react'
import { Badge, Banner, Field } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'

/**
 * เปิดกล้อง ถ้าไม่ได้ก็บอกเหตุผลแล้วให้เลือกไฟล์แทน
 *
 * ไม่รับ `active` เพราะเนื้อโมดัลถูก mount เฉพาะตอนเปิดอยู่แล้ว — state จึงเริ่ม
 * ใหม่เองทุกครั้ง ไม่ต้องมี effect คอยรีเซ็ต (ซึ่ง react-hooks ห้ามด้วยเหตุผลที่ถูก:
 * setState ตรงๆ ใน effect ทำให้เรนเดอร์ซ้อน)
 */
function useCamera(facing: 'user' | 'environment') {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('เบราว์เซอร์นี้ไม่รองรับกล้อง')
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
          setReady(true)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'เปิดกล้องไม่ได้')
      }
    }
    void start()
    return () => {
      cancelled = true
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [facing])

  return { videoRef, error, ready }
}

const frameStyle: React.CSSProperties = {
  position: 'relative', width: '100%', aspectRatio: '4 / 3', background: 'var(--void-2)',
  border: '2px solid var(--ink)', overflow: 'hidden', display: 'grid', placeItems: 'center',
}
const videoStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' }

// ══════════════ on-site — สแกน QR ══════════════

/**
 * `expectedToken` คือรหัสที่กรรมการกำลังแสดงอยู่ ผู้เล่นต้องได้รหัสเดียวกันมา
 * ในเดโมกดปุ่ม "จำลองว่าสแกนติด" ได้ หรือพิมพ์รหัสที่เห็นบนจอกรรมการก็ได้
 */
interface QrProps {
  open: boolean
  onClose: () => void
  expectedToken: string | null
  onScanned: (token: string) => void
  pending: boolean
}

export function QrScanModal(props: QrProps) {
  return (
    <Modal open={props.open} onClose={props.onClose} label="Check in — on-site"
      title="สแกน QR ที่โต๊ะกรรมการ">
      {props.open ? <QrScanBody {...props} /> : null}
    </Modal>
  )
}

function QrScanBody({ onClose, expectedToken, onScanned, pending }: QrProps) {
  const { videoRef, error, ready } = useCamera('environment')
  const [typed, setTyped] = useState('')
  const [bad, setBad] = useState<string | null>(null)

  const submit = (token: string) => {
    const clean = token.trim().toUpperCase()
    if (!clean) { setBad('ยังไม่ได้กรอกรหัส'); return }
    if (expectedToken && clean !== expectedToken.toUpperCase()) {
      setBad('รหัสไม่ตรงกับที่กรรมการแสดงอยู่ — รหัสหมุนทุกนาที ลองอ่านใหม่')
      return
    }
    setBad(null)
    onScanned(clean)
  }

  return (
    <>
      <div style={frameStyle}>
        <video ref={videoRef} style={videoStyle} muted playsInline />
        {/* กรอบเล็ง — บอกว่าต้องเอา QR มาไว้ตรงไหน */}
        <span aria-hidden style={{
          position: 'absolute', width: '58%', aspectRatio: '1', border: '3px solid var(--teal)',
          boxShadow: '0 0 0 9999px rgba(0,0,0,.45)',
        }} />
        {!ready ? (
          <span className="tag" style={{ position: 'absolute', bottom: 10 }}>
            {error ? 'กล้องไม่พร้อม' : 'กำลังเปิดกล้อง…'}
          </span>
        ) : null}
      </div>

      {error ? (
        <Banner kind="warn">
          <b>เปิดกล้องไม่ได้</b> — {error} กรอกรหัสที่เห็นบนจอกรรมการแทนได้
        </Banner>
      ) : null}
      {bad ? <Banner kind="crit">{bad}</Banner> : null}

      <Field label="รหัสบนจอกรรมการ" htmlFor="qr-manual">
        <input id="qr-manual" autoComplete="off" placeholder="เช่น SEED-M-121"
          value={typed} onChange={e => setTyped(e.target.value)} />
      </Field>

      <div className="hstack">
        <button className="btn" type="button" onClick={onClose}>ยกเลิก</button>
        <button className="btn" type="button" disabled={pending || !expectedToken}
          title={expectedToken ? undefined : 'แมตช์นี้ยังไม่เปิดเช็คอิน'}
          onClick={() => submit(expectedToken ?? '')}>
          จำลองว่าสแกนติด
        </button>
        <button className="btn primary" type="button" disabled={pending}
          onClick={() => submit(typed)}>
          {pending ? 'กำลังเช็คอิน…' : 'ยืนยันรหัส'}
        </button>
      </div>
    </>
  )
}

// ══════════════ online — ถ่ายรูปคู่บัตร ══════════════

/**
 * FR-PV-04 — รูปหน้าคู่บัตรนักศึกษา ส่งแล้วยังไม่ผ่านทันที กรรมการต้องตรวจก่อน
 * รูปถูกย่อก่อนเก็บด้วยเหตุผลเดียวกับโลโก้ทีม (ดู mocks/imageInput.ts)
 */
interface PhotoProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: { photo: string; documentType: 'student_id' | 'national_id' }) => void
  pending: boolean
}

export function IdPhotoModal(props: PhotoProps) {
  return (
    <Modal open={props.open} onClose={props.onClose} label="Check in — online"
      title="ถ่ายรูปหน้าคู่บัตรนักศึกษา">
      {props.open ? <IdPhotoBody {...props} /> : null}
    </Modal>
  )
}

function IdPhotoBody({ onClose, onSubmit, pending }: PhotoProps) {
  const { videoRef, error, ready } = useCamera('user')
  const [shot, setShot] = useState<string | null>(null)
  const [docType, setDocType] = useState<'student_id' | 'national_id'>('student_id')
  const [bad, setBad] = useState<string | null>(null)
  /* UC-04 online ขั้นที่ 2 — จัดเก็บภาพต้องมาพร้อมการบันทึกความยินยอม (DC-08, PDPA) */
  const [consent, setConsent] = useState(false)

  const capture = async () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) { setBad('กล้องยังไม่พร้อม'); return }
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight))
    canvas.width = Math.round(v.videoWidth * scale)
    canvas.height = Math.round(v.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) { setBad('วาดภาพไม่ได้'); return }
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
    setBad(null)
    setShot(canvas.toDataURL('image/jpeg', 0.8))
  }

  return (
    <>
      <Banner kind="warn">
        <b>ถือบัตรไว้ข้างหน้าให้เห็นทั้งหน้าและบัตรในรูปเดียว</b>{' '}
        กรรมการเป็นคนตรวจ — ส่งแล้วยังไม่ถือว่าเช็คอินสำเร็จจนกว่าจะได้รับอนุมัติ
      </Banner>

      <div style={frameStyle}>
        {shot
          ? <img src={shot} alt="รูปที่ถ่ายไว้" style={videoStyle} />
          : <video ref={videoRef} style={videoStyle} muted playsInline />}
        {!shot ? (
          <span aria-hidden style={{
            position: 'absolute', width: '52%', height: '78%', borderRadius: '50%',
            border: '3px dashed var(--teal)', opacity: .8,
          }} />
        ) : null}
        {!shot && !ready ? (
          <span className="tag" style={{ position: 'absolute', bottom: 10 }}>
            {error ? 'กล้องไม่พร้อม' : 'กำลังเปิดกล้อง…'}
          </span>
        ) : null}
      </div>

      {error && !shot ? (
        <Banner kind="crit">
          <b>เปิดกล้องไม่ได้</b> — {error}{' '}
          แนบไฟล์แทนไม่ได้ตามข้อกำหนด ให้แจ้งกรรมการยืนยันตัวตนให้ที่หน้างานแทน (UC-04 E2b)
        </Banner>
      ) : null}
      {bad ? <Banner kind="crit">{bad}</Banner> : null}

      <Field label="บัตรที่ใช้" htmlFor="doc-type">
        <select id="doc-type" value={docType}
          onChange={e => setDocType(e.target.value as 'student_id' | 'national_id')}>
          <option value="student_id">บัตรนักศึกษา</option>
          <option value="national_id">บัตรประชาชน</option>
        </select>
      </Field>

      <label className="hstack" style={{ gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <span className="sub">
          ยินยอมให้จัดเก็บภาพนี้เพื่อยืนยันตัวตน และเข้าใจว่าภาพจะถูกลบเมื่อการแข่งขันสิ้นสุด
          (เห็นได้เฉพาะกรรมการของแมตช์และผู้ดูแลระบบ)
        </span>
      </label>

      <div className="hstack">
        <button className="btn" type="button" onClick={onClose}>ยกเลิก</button>
        {shot ? (
          <button className="btn" type="button" onClick={() => setShot(null)}>ถ่ายใหม่</button>
        ) : (
          <button className="btn" type="button" disabled={!ready} onClick={() => void capture()}>ถ่ายรูป</button>
        )}
        <button className="btn primary" type="button" disabled={!shot || !consent || pending}
          title={consent ? undefined : 'ต้องให้ความยินยอมก่อนส่งภาพ'}
          onClick={() => shot && onSubmit({ photo: shot, documentType: docType })}>
          {pending ? 'กำลังส่ง…' : 'ส่งให้กรรมการตรวจ'}
        </button>
      </div>
    </>
  )
}

// ══════════════ ฝั่งกรรมการ — ดูรูปแล้วตัดสิน ══════════════

/** FR-PV-04 — กรรมการเปิดรูปที่ผู้เล่นส่ง แล้วอนุมัติหรือปฏิเสธพร้อมเหตุผล */
interface ReviewProps {
  open: boolean
  onClose: () => void
  playerName: string
  photo: string | null
  onDecide: (approve: boolean, reason?: string) => void
  pending: boolean
}

export function ReviewPhotoModal(props: ReviewProps) {
  return (
    <Modal open={props.open} onClose={props.onClose} label="ตรวจหลักฐาน" title={props.playerName}>
      {props.open ? <ReviewPhotoBody {...props} /> : null}
    </Modal>
  )
}

function ReviewPhotoBody({ onClose, playerName, photo, onDecide, pending }: ReviewProps) {
  const [reason, setReason] = useState('')

  return (
    <>
      <div style={frameStyle}>
        {photo
          ? <img src={photo} alt={`หลักฐานของ ${playerName}`} style={videoStyle} />
          : <span className="sub">ผู้เล่นคนนี้ไม่ได้แนบรูปมา</span>}
      </div>
      <div className="hstack">
        <Badge kind="warn">รอการตรวจ</Badge>
        <span className="sub">เทียบหน้ากับบัตร และเทียบชื่อกับรายชื่อในทีม</span>
      </div>
      <Field label="เหตุผล ถ้าจะปฏิเสธ" htmlFor="reject-why">
        <input id="reject-why" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="เช่น รูปเบลอจนอ่านบัตรไม่ออก" />
      </Field>
      <div className="hstack">
        <button className="btn" type="button" onClick={onClose}>ปิด</button>
        <button className="btn danger" type="button" disabled={pending || !reason.trim()}
          onClick={() => onDecide(false, reason.trim())}>
          ปฏิเสธ
        </button>
        <button className="btn primary" type="button" disabled={pending}
          onClick={() => onDecide(true)}>
          {pending ? 'กำลังบันทึก…' : 'อนุมัติ'}
        </button>
      </div>
    </>
  )
}

// ══════════════ UC-04 E2b — กรรมการยืนยันด้วยตนเอง ══════════════

/**
 * ไม่มีกล้องหรือสัญญาณขัดข้อง กรรมการยืนยันตัวตนหน้างานแล้วบันทึกเป็นข้อยกเว้น
 * ต้องมีเหตุผลเสมอ เพราะเป็นการข้ามหลักฐานที่ระบบเก็บไว้ตรวจสอบย้อนหลังได้
 */
interface ManualProps {
  open: boolean
  onClose: () => void
  playerName: string
  onConfirm: (reason: string) => void
  pending: boolean
}

export function ManualVerifyModal(props: ManualProps) {
  return (
    <Modal open={props.open} onClose={props.onClose} label="ยืนยันด้วยตนเอง"
      title={props.playerName}>
      {props.open ? <ManualVerifyBody {...props} /> : null}
    </Modal>
  )
}

function ManualVerifyBody({ onClose, onConfirm, pending }: ManualProps) {
  const [reason, setReason] = useState('')
  return (
    <>
      <Banner kind="warn">
        <b>ใช้เมื่อกล้องหรือสัญญาณใช้ไม่ได้เท่านั้น</b>{' '}
        คุณกำลังรับรองว่าตรวจบัตรของผู้เล่นคนนี้ด้วยตาที่หน้างานแล้ว — บันทึกนี้ตรวจสอบ
        ย้อนหลังได้ จึงต้องระบุเหตุผล
      </Banner>
      <Field label="เหตุผล" htmlFor="manual-why">
        <input id="manual-why" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="เช่น กล้องของผู้เล่นเสีย ตรวจบัตรนักศึกษาที่หน้างานแล้ว" />
      </Field>
      <div className="hstack">
        <button className="btn" type="button" onClick={onClose}>ยกเลิก</button>
        <button className="btn primary" type="button" disabled={pending || !reason.trim()}
          onClick={() => onConfirm(reason.trim())}>
          {pending ? 'กำลังบันทึก…' : 'ยืนยันว่าตรวจแล้ว'}
        </button>
      </div>
    </>
  )
}
