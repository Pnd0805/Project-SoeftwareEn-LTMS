import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { MatchActivity } from '../match/MatchActivity'
import { MatchVideo } from './MatchVideo'
import { youtubeVideo } from './youtubeVideo'

const videoId = 'M7lc1UVf-VE'
const url = `https://www.youtube.com/watch?v=${videoId}`

it.each([
  url, `https://youtu.be/${videoId}?si=share`, `youtube.com/watch?v=${videoId}`,
  `https://m.youtube.com/watch?v=${videoId}`, `https://www.youtube.com/live/${videoId}`,
  `https://www.youtube.com/shorts/${videoId}`, `https://www.youtube.com/embed/${videoId}`,
])('turns a supported YouTube link into a trusted player URL: %s', source => {
  expect(youtubeVideo(source)?.embedUrl).toBe(`https://www.youtube.com/embed/${videoId}?playsinline=1`)
})

it.each([
  `https://youtube.com.evil.test/watch?v=${videoId}`, `https://youtube.com@evil.test/watch?v=${videoId}`,
  'javascript:alert(1)', 'data:text/html,hello', `https://www.youtube.com/watch?v=bad-id`,
  `https://example.test/embed/${videoId}`, `https://www.youtube.com/redirect?q=${videoId}`,
])('does not embed untrusted or invalid video URLs: %s', source => {
  expect(youtubeVideo(source)).toBeNull()
})

it('preserves a shared start time without forwarding arbitrary embed parameters', () => {
  const result = youtubeVideo(`${url}&t=1m30s&autoplay=1&origin=https://example.test`)
  expect(result?.embedUrl).toBe(`https://www.youtube.com/embed/${videoId}?playsinline=1&start=90`)
  expect(result?.originalUrl).toBe(`${url}&t=90s`)
})

it('opens and closes playback within the page without opening an external destination', () => {
  render(<MatchVideo url={url} />)
  const watch = screen.getByRole('button', { name: 'Watch the match' })
  expect(watch).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByTitle('Watch the match')).not.toBeInTheDocument()
  fireEvent.click(watch)
  const player = screen.getByTitle('Watch the match')
  expect(player.tagName).toBe('IFRAME')
  expect(player).toHaveAttribute('src', `https://www.youtube.com/embed/${videoId}?playsinline=1`)
  expect(player).toHaveAttribute('allowfullscreen')
  expect(player).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
  expect(screen.getByRole('link', { name: 'Open on YouTube' })).toHaveAttribute('href', url)
  fireEvent.click(screen.getByRole('button', { name: 'Hide match video' }))
  expect(screen.queryByTitle('Watch the match')).not.toBeInTheDocument()
})

it('unmounts a hidden match-section player and never keeps playing an old URL', () => {
  const view = render(<MatchActivity.Provider value={true}><MatchVideo url={url} /></MatchActivity.Provider>)
  fireEvent.click(screen.getByRole('button', { name: 'Watch the match' }))
  view.rerender(<MatchActivity.Provider value={false}><MatchVideo url={url} /></MatchActivity.Provider>)
  expect(screen.queryByTitle('Watch the match')).not.toBeInTheDocument()
  view.rerender(<MatchActivity.Provider value={true}><MatchVideo url="https://youtu.be/dQw4w9WgXcQ" /></MatchActivity.Provider>)
  expect(screen.queryByTitle('Watch the match')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Watch the match' }))
  expect(screen.getByTitle('Watch the match')).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1')
})

it('keeps unsupported providers truthful and does not offer unsafe links', () => {
  const view = render(<MatchVideo url="https://example.test/match" />)
  expect(screen.getByRole('link', { name: 'Open video link' })).toHaveAttribute('href', 'https://example.test/match')
  expect(screen.queryByRole('button', { name: 'Watch the match' })).not.toBeInTheDocument()
  view.rerender(<MatchVideo url="javascript:alert(1)" />)
  expect(screen.getByText('No video available')).toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})
