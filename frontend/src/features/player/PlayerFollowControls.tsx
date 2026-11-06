import { useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/kit/Icon'
import { useFollow } from '../../hooks/useUser'

/** Following and match notifications are separate choices; the bell starts off. */
export function PlayerFollowControls({ viewerId, playerId }: { viewerId: number; playerId: string }) {
  const follow = useFollow(viewerId, `player:${playerId}`)
  const writing = useRef(false)
  const hintId = useId()
  const busy = follow.isLoading || follow.toggle.isPending || follow.notifications.isPending
  const available = typeof follow.notifyEnabled === 'boolean'
  const failure = follow.error ?? follow.toggle.error ?? follow.notifications.error
  const act = async (action: 'follow' | 'bell') => {
    if (writing.current || busy || follow.error || (action === 'bell' && !available)) return
    writing.current = true
    follow.toggle.reset(); follow.notifications.reset()
    try {
      if (action === 'follow') await follow.toggle.mutateAsync()
      else await follow.notifications.mutateAsync(!follow.notifyEnabled)
    } catch { /* mutation เก็บข้อผิดพลาดไว้แสดง โดยไม่เปลี่ยนป้ายสำเร็จก่อน server ยืนยัน */ }
    finally { writing.current = false }
  }

  return <div className="vstack" role="group" style={{ maxWidth: 340, alignItems: 'flex-start' }} aria-label="Player following">
    <div className="hstack" style={{ flexWrap: 'wrap' }}>
      <button className={`btn ${follow.isFollowing ? 'ghost' : 'primary'}`} type="button"
        disabled={busy || !!follow.error} onClick={() => void act('follow')}>
        {follow.toggle.isPending ? 'Saving…' : follow.isFollowing ? 'Following' : 'Follow player'}
      </button>
      {follow.isFollowing ? <button className={`btn ${follow.notifyEnabled ? 'primary' : 'ghost'}`} type="button"
        aria-label="Player notifications" aria-pressed={available ? follow.notifyEnabled : undefined}
        disabled={busy || !!follow.error || !available} aria-describedby={hintId}
        onClick={() => void act('bell')}>
        <Icon name="bell" size={15} /> {follow.notifications.isPending ? 'Saving…' : !available ? 'Notifications unavailable' : follow.notifyEnabled ? 'Notifications on' : 'Notifications off'}
      </button> : null}
    </div>
    {follow.isFollowing ? <p className="sub" id={hintId} role="status">
      {!available ? 'Player notifications are not available on this server yet.'
        : follow.notifyEnabled ? <>Match notifications are on. The Community category in <Link to="/me">notification settings</Link> must also be on.</>
          : 'Following — turn on the bell for notifications when this player starts a match and when results are verified.'}
    </p> : null}
    {failure ? <p className="sub" role="alert">{failure instanceof Error ? failure.message : 'Could not save following preferences.'}
      {follow.error ? <button className="btn ghost" type="button" onClick={() => void follow.refetch()}>Retry following</button> : null}
    </p> : null}
  </div>
}
