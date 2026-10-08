/** Camera capture for on-site QR and online identity checks. QR validity is checked by the server. */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'
import { USE_MOCK } from '../../api/client'
import { Badge, Banner, Field } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'

/**
 * Open the camera; QR capture requests enough detail for signed payloads.
 *
 * ไม่รับ `active` เพราะเนื้อโมดัลถูก mount เฉพาะตอนเปิดอยู่แล้ว — state จึงเริ่ม
 * ใหม่เองทุกครั้ง ไม่ต้องมี effect คอยรีเซ็ต (ซึ่ง react-hooks ห้ามด้วยเหตุผลที่ถูก:
 * setState ตรงๆ ใน effect ทำให้เรนเดอร์ซ้อน)
 */
function useCamera(facing: 'user' | 'environment', attempt = 0) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [camera, setCamera] = useState({ attempt, error: null as string | null, ready: false })

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not support camera access.')
        stream = await navigator.mediaDevices.getUserMedia({ video: facing === 'environment'
          ? { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: facing } })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          if (!cancelled) setCamera({ attempt, error: null, ready: true })
        }
      } catch (e) {
        stream?.getTracks().forEach(t => t.stop())
        stream = null
        if (!cancelled) setCamera({ attempt, error: e instanceof Error ? e.message : 'Camera unavailable', ready: false })
      }
    }
    void start()
    return () => {
      cancelled = true
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [facing, attempt])

  return { videoRef, error: camera.attempt === attempt ? camera.error : null, ready: camera.attempt === attempt && camera.ready }
}

const frameStyle: React.CSSProperties = {
  position: 'relative', width: '100%', aspectRatio: '4 / 3', background: 'var(--void-2)',
  border: '2px solid var(--ink)', overflow: 'hidden', display: 'grid', placeItems: 'center',
}
const videoStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' }

// ══════════════ on-site — สแกน QR ══════════════

/**
 * `expectedToken` คือรหัสที่กรรมการกำลังแสดงอยู่ ผู้เล่นต้องได้รหัสเดียวกันมา
 * ในเดโมกดปุ่ม "Demo scan" ได้ หรือพิมพ์รหัสที่เห็นบนจอกรรมการก็ได้
 */
interface QrProps {
  open: boolean
  onClose: () => void
  expectedToken: string | null
  onScanned: (token: string) => void
  pending: boolean
  submissionError?: string | null
}

export function QrScanModal(props: QrProps) {
  return (
    <Modal className="match-capture-dialog" open={props.open} onClose={props.onClose} label="Check in — on-site"
      title="Scan check-in QR">
      {props.open ? <QrScanBody {...props} /> : null}
    </Modal>
  )
}

function QrScanBody({ onClose, expectedToken, onScanned, pending, submissionError }: QrProps) {
  const [typed, setTyped] = useState('')
  const [bad, setBad] = useState<string | null>(null)
  const [scanAttempt, setScanAttempt] = useState(0)
  const [cameraAttempt, setCameraAttempt] = useState(0)
  const { videoRef, error, ready } = useCamera('environment', cameraAttempt)
  const [scanState, setScanState] = useState<'starting' | 'scanning' | 'detected' | 'error'>('starting')
  const delivered = useRef(false)
  const failure = pending ? null : submissionError ?? bad ?? (error ? `Camera unavailable — ${error} Enter the referee’s code or retry camera access.` : null)

  const submit = useCallback((token: string) => {
    // Preserve the case of signed payloads.
    const clean = token.trim()
    if (!clean) { setBad('Enter a code.'); return }
    if (expectedToken && clean !== expectedToken) {
      setBad('Code does not match the referee’s QR. Scan again.')
      return
    }
    setBad(null)
    onScanned(clean)
  }, [expectedToken, onScanned])

  const submitRef = useRef(submit)
  useEffect(() => { submitRef.current = submit }, [submit])
  useEffect(() => {
    if (!ready || pending || !videoRef.current) return
    let cancelled = false
    let controls: IScannerControls | undefined
    const video = videoRef.current
    void import('@zxing/browser').then(({ BrowserQRCodeReader }) => {
      if (cancelled) return
      return new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 200 }).decodeFromVideoElement(video, (result, decodeError, scanner) => {
        if (cancelled || delivered.current) return
        if (!result) {
          // ZXing retries these ordinary "no readable QR yet" outcomes. Other
          // errors stop its loop, even though the startup promise resolves.
          const name = typeof decodeError?.getKind === 'function' ? decodeError.getKind()
            : decodeError instanceof Error ? decodeError.name : ''
          if (decodeError && !['NotFoundException', 'ChecksumException', 'FormatException'].includes(name)) {
            setScanState('error')
            setBad('Scanner stopped. Scan again or enter the referee’s code.')
          } else setScanState('scanning')
          return
        }
        delivered.current = true
        setScanState('detected')
        scanner.stop()
        submitRef.current(result.getText())
      })
    }).then(value => {
      controls = value
      if (cancelled) value?.stop()
    }).catch(() => {
      if (!cancelled) {
        setScanState('error')
        setBad('Scanner could not start. Scan again or enter the referee’s code.')
      }
    })
    return () => { cancelled = true; controls?.stop() }
  }, [ready, pending, scanAttempt, videoRef])

  return (
    <>
      <div style={{ ...frameStyle, ...(failure ? { aspectRatio: 'auto', height: 96 } : {}) }}>
        <video ref={videoRef} style={videoStyle} muted playsInline />
        {/* กรอบเล็ง — บอกว่าต้องเอา QR มาไว้ตรงไหน */}
        <span aria-hidden style={{
          position: 'absolute', width: '58%', aspectRatio: '1', border: '3px solid var(--teal)',
          boxShadow: '0 0 0 9999px rgba(0,0,0,.45)',
        }} />
        {!ready && !failure ? (
          <span className="tag" style={{ position: 'absolute', bottom: 10 }}>
            {error ? 'Camera unavailable' : 'Starting camera…'}
          </span>
        ) : null}
      </div>

      {failure ? <div role="alert"><Banner kind="crit">{failure}</Banner></div> : <span role="status" className="sub">
        {pending ? 'QR detected. Checking in…'
          : scanState === 'detected' ? 'QR detected. Scan again if check-in fails.'
            : scanState === 'error' ? 'Scanner unavailable'
              : !ready ? 'Starting camera…' : 'Scanning QR. Keep the whole code and its border visible; avoid glare.'}
      </span>}

      <Field label="Referee’s code" htmlFor="qr-manual">
        <input id="qr-manual" autoComplete="off" placeholder="Enter the referee’s code"
          value={typed} onChange={e => setTyped(e.target.value)} />
      </Field>

      <div className="hstack">
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        {USE_MOCK ? <button className="btn" type="button" disabled={pending || !expectedToken}
          onClick={() => submit(expectedToken ?? '')}>Demo scan</button> : null}
        <button className="btn" type="button" disabled={pending || (!ready && !error)}
          onClick={() => { delivered.current = false; setBad(null); setScanState('starting'); if (error) setCameraAttempt(n => n + 1); else setScanAttempt(n => n + 1) }}>{error ? 'Retry camera' : 'Scan again'}</button>
        <button className="btn primary" type="button" disabled={pending}
          onClick={() => submit(typed)}>
          {pending ? 'Checking in…' : 'Check in'}
        </button>
      </div>
    </>
  )
}

// ══════════════ online — Take photoคู่บัตร ══════════════

/**
 * FR-PV-04 — รูปหน้าคู่Student ID ส่งแล้วยังไม่ผ่านทันที กรรมการต้องตรวจก่อน
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
    <Modal className="match-capture-dialog" open={props.open} onClose={props.onClose} label="Check in — online"
      title="Take an identity photo">
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
    if (!v || !v.videoWidth) { setBad('Camera is not ready.'); return }
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight))
    canvas.width = Math.round(v.videoWidth * scale)
    canvas.height = Math.round(v.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) { setBad('Could not capture the image.'); return }
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
    setBad(null)
    setShot(canvas.toDataURL('image/jpeg', 0.8))
  }

  return (
    <>
      <Banner kind="warn">
        <b>Keep your face and ID visible in one photo.</b>{' '}
        A referee reviews the photo. You are checked in only after approval.
      </Banner>

      <div style={frameStyle}>
        {shot
          ? <img src={shot} alt="Captured identity photo" style={videoStyle} />
          : <video ref={videoRef} style={videoStyle} muted playsInline />}
        {!shot ? (
          <span aria-hidden style={{
            position: 'absolute', width: '52%', height: '78%', borderRadius: '50%',
            border: '3px dashed var(--teal)', opacity: .8,
          }} />
        ) : null}
        {!shot && !ready ? (
          <span className="tag" style={{ position: 'absolute', bottom: 10 }}>
            {error ? 'Camera unavailable' : 'Starting camera…'}
          </span>
        ) : null}
      </div>

      {error && !shot ? (
        <Banner kind="crit">
          <b>Camera unavailable</b> — {error}{' '}
          File uploads are unavailable for this check. Ask a referee to verify your identity in person.
        </Banner>
      ) : null}
      {bad ? <Banner kind="crit">{bad}</Banner> : null}

      <Field label="ID type" htmlFor="doc-type">
        <select id="doc-type" value={docType}
          onChange={e => setDocType(e.target.value as 'student_id' | 'national_id')}>
          <option value="student_id">Student ID</option>
          <option value="national_id">National ID</option>
        </select>
      </Field>

      <label className="hstack" style={{ gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <span className="sub">
          I consent to storing this photo for identity verification and understand it will be deleted after the tournament.
          Only the match referees and administrators can view it.
        </span>
      </label>

      <div className="hstack">
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        {shot ? (
          <button className="btn" type="button" onClick={() => setShot(null)}>Retake</button>
        ) : (
          <button className="btn" type="button" disabled={!ready} onClick={() => void capture()}>Take photo</button>
        )}
        <button className="btn primary" type="button" disabled={!shot || !consent || pending}
          title={consent ? undefined : 'Consent is required before sending the photo.'}
          onClick={() => shot && onSubmit({ photo: shot, documentType: docType })}>
          {pending ? 'Sending…' : 'Send for review'}
        </button>
      </div>
    </>
  )
}

// ══════════════ ฝั่งกรรมการ — ดูรูปแล้วตัดสิน ══════════════

/** FR-PV-04 — กรรมการเปิดรูปที่ผู้เล่นส่ง แล้วApproveหรือRejectพร้อมเหตุผล */
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
    <Modal className="match-capture-dialog" open={props.open} onClose={props.onClose} label="Review identity" title={props.playerName}>
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
          ? <img src={photo} alt={`Identity photo for ${playerName}`} style={videoStyle} />
          : <span className="sub">No photo was attached.</span>}
      </div>
      <div className="hstack">
        <Badge kind="warn">Awaiting review</Badge>
        <span className="sub">Compare the face, ID and team roster.</span>
      </div>
      <Field label="Rejection reason" htmlFor="reject-why">
        <input id="reject-why" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g. The ID is unreadable" />
      </Field>
      <div className="hstack">
        <button className="btn" type="button" onClick={onClose}>ปิด</button>
        <button className="btn danger" type="button" disabled={pending || !reason.trim()}
          onClick={() => onDecide(false, reason.trim())}>
          Reject
        </button>
        <button className="btn primary" type="button" disabled={pending}
          onClick={() => onDecide(true)}>
          {pending ? 'Saving…' : 'Approve'}
        </button>
      </div>
    </>
  )
}

// ══════════════ M15 — เพิกถอนเช็คอินที่ผ่านไปแล้ว ══════════════

/**
 * OD-19 (มติ 21 ก.ย.) — `qr_onsite` กับ `manual_by_referee` ผ่านทันทีตอนกด ไม่มีใครตรวจก่อน
 * เพื่อนสแกนแทนคนที่ไม่มา หรือกรรมการกดผิดคน จึงต้องถอนได้ และแถวนั้นนับเข้า
 * `min_members` ที่ใช้ตัดสินแพ้บาย — ปล่อยไว้ไม่ได้
 *
 * `reason` เป็นช่องบังคับของ M15 มาตั้งแต่ต้น แต่หน้าจอเคยยัดค่าคงที่
 * "Rejected by the referee" ไปให้เอง ผู้เล่นจึงอ่านไม่ออกว่าถูกถอนเพราะอะไร
 */
interface RevokeProps {
  open: boolean
  onClose: () => void
  playerName: string
  /** วิธีที่เช็คอินนั้นผ่านมา — เขียนให้ตรงว่ากำลังถอนอะไร */
  method: string
  onConfirm: (reason: string) => void
  pending: boolean
}

export function RevokeCheckinModal(props: RevokeProps) {
  return (
    <Modal className="match-capture-dialog" open={props.open} onClose={props.onClose} label="Revoke check-in"
      title={props.playerName}>
      {props.open ? <RevokeCheckinBody {...props} /> : null}
    </Modal>
  )
}

function RevokeCheckinBody({ onClose, method, onConfirm, pending }: RevokeProps) {
  const [reason, setReason] = useState('')
  return (
    <>
      <Banner kind="warn">
        <b>This check-in is accepted ({method}).</b>{' '}
        Revoking removes this player from the verified count used for forfeits. The player can check in again
        or you can verify them again. Revoking after play starts does not reverse an existing decision.
      </Banner>
      <Field label="Reason shown to the player" htmlFor="revoke-why">
        <input id="revoke-why" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g. Another person scanned; the player is absent" />
      </Field>
      <div className="hstack">
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className="btn danger" type="button" disabled={pending || !reason.trim()}
          title={reason.trim() ? undefined : 'Enter a reason before revoking.'}
          onClick={() => onConfirm(reason.trim())}>
          {pending ? 'Revoking…' : 'Revoke check-in'}
        </button>
      </div>
    </>
  )
}

// ══════════════ UC-04 E2b — กรรมการVerify in person ══════════════

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
  /**
   * เหตุผลที่แถวนี้ถูกRejectไว้ก่อนหน้า — มีค่า = กำลังกดให้ใหม่หลังถูก reject
   * M19 เขียนทับแถวเดิมได้ตั้งแต่ 21 ก.ย. (OD-19 ข้อ 2) จึงเป็นทางกลับของ M15
   */
  afterReject?: string | null
}

export function ManualVerifyModal(props: ManualProps) {
  return (
    <Modal className="match-capture-dialog" open={props.open} onClose={props.onClose} label="Verify in person"
      title={props.playerName}>
      {props.open ? <ManualVerifyBody {...props} /> : null}
    </Modal>
  )
}

function ManualVerifyBody({ onClose, onConfirm, pending, afterReject }: ManualProps) {
  const [reason, setReason] = useState('')
  return (
    <>
      {afterReject != null ? (
        <Banner kind="warn">
          <b>This check-in was rejected.</b>
          {afterReject ? <> — “{afterReject}”</> : null}{' '}
          Verifying again replaces the existing check-in and clears its rejection reason.
          Explain what you checked before approving this time.
        </Banner>
      ) : (
        <Banner kind="warn">
          <b>Use only when camera or connection access fails.</b>{' '}
          You confirm that you inspected the player’s ID in person. This record can be
          audited; a reason is required.
        </Banner>
      )}
      <Field label="Reason" htmlFor="manual-why">
        <input id="manual-why" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g. Camera failed; physical ID inspected" />
      </Field>
      <div className="hstack">
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className="btn primary" type="button" disabled={pending || !reason.trim()}
          onClick={() => onConfirm(reason.trim())}>
          {pending ? 'Saving…' : 'Verify check-in'}
        </button>
      </div>
    </>
  )
}
