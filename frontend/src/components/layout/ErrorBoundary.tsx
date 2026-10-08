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

type Props = { children: ReactNode; label?: string; resetKey?: string }
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

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const chunkFailed = error.name === 'ChunkLoadError'
      || /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk .+ failed|Unable to preload CSS/i.test(error.message)

    return (
      <div className="panel" role="alert" style={{ display: 'grid', gap: 10, padding: 18 }}>
        <span className="tag"><em>//</em> {chunkFailed ? 'Page files are unavailable' : 'Something on this screen broke'}</span>
        <b>{this.props.label ?? 'This part'} could not {chunkFailed ? 'load' : 'be drawn'}.</b>
        <div className="sub">
          {chunkFailed ? 'Reload the page to try again, or return to tournaments.'
            : 'The rest of the app still works — this is a bug in the screen, not in your data.'}
        </div>
        {!chunkFailed ? <code className="sub" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error.message}</code> : null}
        <div className="hstack">
          {chunkFailed ? <button className="btn" type="button" onClick={() => window.location.reload()}>Reload page</button>
            : <button className="btn" type="button" onClick={() => this.setState({ error: null })}>Try again</button>}
          <a className="btn ghost" href="/">Back to tournaments</a>
        </div>
      </div>
    )
  }
}
