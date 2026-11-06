import { useId, useState } from 'react'
import { Icon } from '../../components/kit/Icon'
import { useMatchActive } from '../match/MatchActivity'
import { safeVideoLink, youtubeVideo } from './youtubeVideo'
import './match-video.css'

export function MatchVideo({ url }: { url?: string | null }) {
  const video = youtubeVideo(url)
  const external = safeVideoLink(url)
  const active = useMatchActive()
  const [openedUrl, setOpenedUrl] = useState<string | null>(null)
  const playerId = useId()
  const watching = !!video && active && openedUrl === url

  return <div className="match-video">
    <span className="tag"><em>//</em> Match video</span>
    {video ? <>
      <button className="btn primary" type="button" aria-expanded={watching} aria-controls={playerId}
        onClick={() => setOpenedUrl(watching ? null : url!)}>
        <Icon name="match" size={13} /> {watching ? 'Hide match video' : 'Watch the match'}
      </button>
      <div id={playerId} hidden={!watching}>
        {watching ? <div className="match-video-frame"><iframe title="Watch the match" src={video.embedUrl}
          allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin" /></div> : null}
      </div>
      {watching ? <a className="match-video-external" href={video.originalUrl} target="_blank" rel="noopener noreferrer">Open on YouTube</a> : null}
    </> : external ? <>
      <p className="sub">This video is available on the original provider.</p>
      <a href={external.href} target="_blank" rel="noopener noreferrer">Open video link</a>
    </> : <p className="sub">No video available</p>}
  </div>
}
