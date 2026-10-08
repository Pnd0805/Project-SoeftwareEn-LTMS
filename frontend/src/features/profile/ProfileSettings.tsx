import { useState } from 'react'
import { Banner, Field, Panel } from '../../components/kit/primitives'
import { useUpdateMe } from '../../hooks/useAuth'
import { useNotificationPreferences, useEmailNotificationPreferences } from '../../hooks/useQaFeatures'
import type { MeDto } from '../../types/dto'
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export function ProfileSettings({ user }: { user: MeDto }) {
  const save = useUpdateMe()
  const [contact, setContact] = useState(user.contactInfo ?? '')
  const [address, setAddress] = useState(user.address ?? '')
  const [showStats, setShowStats] = useState(user.showProfileStats !== false)
  const valid = contact.length <= 255 && address.length <= 2000
  return <Panel quiet><h3>Profile settings</h3><form className="vstack" onSubmit={e => { e.preventDefault(); if (valid && !save.isPending) save.mutate({ contactInfo: contact.trim() ? contact : null, address: address.trim() ? address : null, showProfileStats: showStats }) }}>
    <Field label="Contact information" htmlFor="profile-contact"><input id="profile-contact" maxLength={255} value={contact} onChange={e => setContact(e.target.value)} disabled={save.isPending} /></Field>
    <Field label="Address" htmlFor="profile-address"><textarea id="profile-address" maxLength={2000} value={address} onChange={e => setAddress(e.target.value)} disabled={save.isPending} /></Field>
    {!valid ? <Banner kind="crit">Contact information allows 255 characters; address allows 2,000. Shorten the saved text before submitting.</Banner> : null}
    <label className="profile-checkbox"><input type="checkbox" checked={showStats} onChange={e => setShowStats(e.target.checked)} disabled={save.isPending} /> <span>Show career and match statistics on my public profile</span></label>
    <p className="sub">Competition results and leaderboards stay visible. You can still see your own statistics.</p>
    {save.isError ? <Banner kind="crit">{save.error.message}</Banner> : null}{save.isSuccess ? <p role="status">Profile saved.</p> : null}
    <button className="btn primary" disabled={!valid || save.isPending}>{save.isPending ? 'Saving…' : 'Save profile settings'}</button>
  </form></Panel>
}
export function NotificationSettings() {
  const { query, save } = useNotificationPreferences()
  const email = useEmailNotificationPreferences()
  return <Panel quiet><h3>Notification preferences</h3><p className="sub">Critical updates have deadlines and stay enabled.</p>
    {query.isPending ? <p>Loading preferences…</p> : null}
    {query.isError ? <Banner kind="crit">{query.error instanceof Error ? query.error.message : 'Request failed.'} <button className="btn" onClick={() => void query.refetch()}>Retry</button></Banner> : null}
    {save.isError ? <Banner kind="crit">{save.error.message}</Banner> : null}
    {save.isSuccess ? <p role="status">Preference saved.</p> : null}
    {query.data?.categories.map(c => <label className="profile-checkbox profile-preference" key={c.key}><span>{label(c.key)}{c.locked ? ' — always on' : ''}</span><input type="checkbox" aria-label={`${label(c.key)} notifications`} checked={c.enabled} disabled={c.locked || c.key === 'critical' || save.isPending} onChange={e => { if (c.key !== 'critical' && !c.locked) save.mutate({ key: c.key, enabled: e.target.checked }) }} /></label>)}
    <h3>Email notifications</h3>
    <p className="sub">Email settings are independent of in-app notifications. Critical emails are sent immediately; other enabled categories are grouped into a daily digest at 08:00 (Thailand time). Only verified email addresses receive messages.</p>
    {email.query.isPending ? <p>Loading email preferences…</p> : null}
    {email.query.isError ? <Banner kind="crit">Could not load email preferences. <button className="btn" onClick={() => void email.query.refetch()}>Retry</button></Banner> : null}
    {email.save.isError ? <Banner kind="crit">{email.save.error.message}</Banner> : null}
    {email.save.isSuccess ? <p role="status">Email preference saved.</p> : null}
    {email.query.data?.categories.map(c => <label className="profile-checkbox profile-preference" key={`email-${c.key}`}><span>{label(c.key)} email</span><input type="checkbox" aria-label={`${label(c.key)} email notifications`} checked={c.enabled} disabled={c.locked || email.save.isPending} onChange={e => email.save.mutate({ key: c.key, enabled: e.target.checked })} /></label>)}
  </Panel>
}
