/**
 * ทางกลับเมื่อสิทธิ์กล้องถูกปฏิเสธไปแล้ว
 *
 * เว็บสั่งให้ browser ถามซ้ำไม่ได้ — getUserMedia ตอบ NotAllowedError ทันทีโดยไม่ขึ้นหน้าต่าง
 * ทางเดียวที่กู้ในหน้าได้คือ `<usermedia>` (Chrome 151+) เพราะ browser เป็นคนวาดปุ่มเอง
 * จึงรู้ว่าผู้ใช้ตั้งใจกดจริง · browser อื่นต้องบอกวิธีเปิดในตั้งค่าเว็บไซต์
 */
import { createElement, useEffect, useState } from 'react'
import { Banner } from '../../components/kit/primitives'

interface UserMediaElement extends HTMLElement {
  stream: MediaStream | null
  setConstraints(constraints: MediaStreamConstraints): void
}

const supportsUserMediaElement = () => 'HTMLUserMediaElement' in window

export function CameraBlocked({ video, onStream }: { video: MediaTrackConstraints; onStream: (stream: MediaStream) => void }) {
  const [element, setElement] = useState<UserMediaElement | null>(null)
  const [failed, setFailed] = useState(false)
  const recoverable = supportsUserMediaElement() && !failed

  useEffect(() => {
    if (!element || !recoverable) return
    element.setConstraints({ video })
    const stream = () => { if (element.stream) onStream(element.stream) }
    const error = () => setFailed(true)
    element.addEventListener('stream', stream)
    element.addEventListener('error', error)
    return () => {
      element.removeEventListener('stream', stream)
      element.removeEventListener('error', error)
    }
  }, [element, video, onStream, recoverable])

  return <div role="alert" className="vstack camera-blocked">
    <Banner kind="crit"><b>Camera access is blocked.</b> {recoverable
      /* Chrome เป็นคนเขียนคำบนปุ่มเอง และยังเขียนว่า microphone แม้ขอแค่ video — กันคนตกใจ */
      ? 'Use the button below to allow it again. Your browser words the button; check-in only uses the camera.'
      : 'Your browser will not ask again. Open the site settings from the icon beside the address, set Camera to Allow, then press Retry camera.'}</Banner>
    {recoverable ? createElement('usermedia', { ref: setElement, className: 'camera-permission-control' }) : null}
    <span className="sub">You can also enter the referee’s code or use a photo of the QR.</span>
  </div>
}
