/**
 * src/components/layout/ErrorBoundary.tsx
 *
 * หน้าจอดับทั้งหน้าเพราะ component เดียวพัง — React ถอดทั้ง tree ทิ้งเมื่อไม่มีใครรับ error
 * (เจอจริงตอนต่อ backend: แท็บตารางแข่งอ่าน `m.viewer.can` ที่ backend ไม่ได้ส่งมา
 *  ผลคือทั้งแอปกลายเป็นหน้าว่าง ไม่มีข้อความบอกอะไรเลย)
 *
 * ตัวนี้กันไว้ให้เหลือแค่ส่วนที่พัง และบอกว่าพังที่ไหน — reset ได้โดยไม่ต้องรีเฟรช
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode; label?: string }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    /* ใน dev ให้เห็นใน console ด้วย จะได้ตามรอยต่อได้ว่าพังที่ component ไหน */
    console.error('[LTMS] render error', this.props.label ?? '', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="panel" style={{ display: 'grid', gap: 10, padding: 18 }}>
        <span className="tag"><em>//</em> Something on this screen broke</span>
        <b>{this.props.label ? `${this.props.label} could not be drawn.` : 'This part could not be drawn.'}</b>
        <div className="sub">
          The rest of the app still works — this is a bug in the screen, not in your data.
        </div>
        <code className="sub" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error.message}</code>
        <div className="hstack">
          <button className="btn" type="button" onClick={() => this.setState({ error: null })}>Try again</button>
          <button className="btn ghost" type="button" onClick={() => window.location.assign('/')}>Back to tournaments</button>
        </div>
      </div>
    )
  }
}
