import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { USE_MOCK } from '../../api/client'
import { useCheckinFromQr, useMyMatches } from '../../hooks/useMatch'
import { Banner } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { checkinErrorMessage } from './checkinErrors'
import { QrScanModal } from './CaptureModals'
import { scanMatchId } from './scanMatchId'
import { scanQrPhoto } from './scanQrPhoto'

function useGlobalQrCheckin(onClose: () => void) {
  const navigate = useNavigate()
  const matches = useMyMatches(USE_MOCK)
  const checkin = useCheckinFromQr()
  const [invalidQr, setInvalidQr] = useState<string | null>(null)

  return {
    pending: checkin.isPending,
    error: invalidQr ?? (checkin.error ? checkinErrorMessage(checkin.error) : null),
    submit: (qrToken: string) => {
      const matchId = scanMatchId(qrToken, USE_MOCK ? matches.data?.items ?? [] : [])
      if (matchId === null) {
        setInvalidQr('This is not an LTMS Check-in QR. Scan again.')
        return
      }
      setInvalidQr(null)
      checkin.mutate({ matchId, qrToken }, {
        onSuccess: () => {
          onClose()
          navigate(`/checkin/${matchId}`)
        },
      })
    },
  }
}

export function GlobalScanDialog({ onClose }: { onClose: () => void }) {
  const checkin = useGlobalQrCheckin(onClose)
  return <QrScanModal open onClose={onClose} expectedToken={null} pending={checkin.pending}
    submissionError={checkin.error} onScanned={checkin.submit} />
}

export function GlobalScanPhoto({ file, onClose, onRetry }: {
  file: File; onClose: () => void; onRetry: () => void
}) {
  const checkin = useGlobalQrCheckin(onClose)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const scan = useRef<{ file: File; promise: Promise<string>; processed: boolean } | null>(null)

  useEffect(() => {
    if (!scan.current || scan.current.file !== file) {
      scan.current = { file, promise: scanQrPhoto(file), processed: false }
    }
    const current = scan.current
    let active = true
    void current.promise.then(token => {
      if (!active || current.processed) return
      current.processed = true
      checkin.submit(token)
    }).catch(() => {
      if (!active || current.processed) return
      current.processed = true
      setPhotoError('No QR found in the photo. Take another photo.')
    })
    return () => { active = false }
  }, [file, checkin])

  const error = photoError ?? checkin.error
  return <Modal open onClose={onClose} label="Check in — on-site" title="Scan check-in QR">
    <p role="status" className="sub">{checkin.pending ? 'Checking in…' : error ? 'Scan failed' : 'Reading QR…'}</p>
    {error ? <Banner kind="crit">{error}</Banner> : null}
    <div className="hstack">
      <button className="btn" type="button" onClick={onClose}>Cancel</button>
      {error ? <button className="btn primary" type="button" onClick={onRetry}>Take another photo</button> : null}
    </div>
  </Modal>
}
