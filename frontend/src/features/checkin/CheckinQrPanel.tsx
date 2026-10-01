import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useCheckinQr } from '../../hooks/useMatch'
import { USE_MOCK } from '../../api/client'
import { Banner, Panel } from '../../components/kit/primitives'
import { checkinErrorMessage } from './checkinErrors'

export function CheckinQrPanel({ matchId, mockToken, done, total }: {
  matchId: number; mockToken: string | null; done: number; total: number
}) {
  const [now, setNow] = useState(() => Date.now())
  const query = useCheckinQr(matchId)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const expiry = Date.parse(query.data?.expiresAt ?? '')
  // Invalid or expired responses must never be offered as a usable code.
  const usable = Number.isFinite(expiry) && expiry > now
  const token = USE_MOCK ? mockToken : usable && !query.isError ? query.data?.qrPayload : null
  const seconds = Math.max(0, Math.floor((expiry - now) / 1000))

  return <Panel>
    <span className="tag"><em>//</em> Show this at the referee&apos;s table</span>
    {token ? <div className="hstack" style={{ gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <QRCodeSVG value={token} size={240} marginSize={4} level="M" title="Check-in QR code" />
      <div className="vstack" style={{ flex: 1, minWidth: 220, gap: 10 }}>
        <span className="tag">Code</span>
        <code style={{ wordBreak: 'break-all' }}>{token}</code>
        <span className="tag">Verified: {done} / {total}</span>
        <span>{USE_MOCK ? 'Demo QR' : `Expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · renews automatically before expiry`}</span>
      </div>
    </div> : <Banner kind={query.isPending ? 'warn' : 'crit'}>
      {query.isPending && !USE_MOCK ? 'Loading check-in QR…'
        : query.isError ? `QR unavailable. ${checkinErrorMessage(query.error)}`
          : 'No valid check-in QR. Request a new code.'}
    </Banner>}
    {!USE_MOCK ? <button className="btn" type="button" disabled={query.isFetching}
      onClick={() => { void query.refetch() }}>
      {query.isFetching ? 'Refreshing QR…' : 'Refresh QR'}
    </button> : null}
  </Panel>
}
