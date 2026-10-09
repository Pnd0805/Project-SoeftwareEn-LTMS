import { useState } from 'react'
import { Banner, Facts, Field, Panel } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { useUpdateMe } from '../../hooks/useAuth'
import { useNotificationPreferences } from '../../hooks/useQaFeatures'
import type { MeDto } from '../../types/dto'
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export function ProfileSettings({ user }: { user: MeDto }) {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  return <Panel quiet><div className="profile-settings">
    <div className="spread"><h3>Profile settings</h3>
      <button className="btn" type="button" aria-haspopup="dialog" onClick={() => { setSaved(false); setEditing(true) }}>Settings</button>
    </div>
    <Facts rows={[
      ['Contact information', user.contactInfo?.trim() ? user.contactInfo : 'Not set'],
      ['Address', user.address?.trim() ? user.address : 'Not set'],
      ['Public career and match statistics', user.showProfileStats !== false ? 'Visible' : 'Hidden'],
    ]} />
    {saved ? <p role="status">Profile saved.</p> : null}
    {editing ? <ProfileSettingsEditor user={user} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setSaved(true) }} /> : null}
  </div></Panel>
}

function ProfileSettingsEditor({ user, onClose, onSaved }: { user: MeDto; onClose: () => void; onSaved: () => void }) {
  const save = useUpdateMe()
  const [contact, setContact] = useState(user.contactInfo ?? '')
  const [address, setAddress] = useState(user.address ?? '')
  const [showStats, setShowStats] = useState(user.showProfileStats !== false)
  const valid = contact.length <= 255 && address.length <= 2000
  return <Modal open title="Edit profile settings" className="profile-settings-dialog" onClose={() => { if (!save.isPending) onClose() }}><form className="vstack" onSubmit={e => { e.preventDefault(); if (valid && !save.isPending) save.mutate({ contactInfo: contact.trim() ? contact : null, address: address.trim() ? address : null, showProfileStats: showStats }, { onSuccess: onSaved }) }}>
    <Field label="Contact information" htmlFor="profile-contact"><input id="profile-contact" maxLength={255} value={contact} onChange={e => setContact(e.target.value)} disabled={save.isPending} /></Field>
    <Field label="Address" htmlFor="profile-address"><textarea id="profile-address" maxLength={2000} value={address} onChange={e => setAddress(e.target.value)} disabled={save.isPending} /></Field>
    {!valid ? <Banner kind="crit">Contact information allows 255 characters; address allows 2,000. Shorten the saved text before submitting.</Banner> : null}
    <label className="profile-checkbox"><input type="checkbox" checked={showStats} onChange={e => setShowStats(e.target.checked)} disabled={save.isPending} /> <span>Show career and match statistics on my public profile</span></label>
    <p className="sub">Competition results and leaderboards stay visible. You can still see your own statistics.</p>
    {save.isError ? <div role="alert"><Banner kind="crit">{save.error.message}</Banner></div> : null}
    <div className="hstack">
      <button className="btn" type="button" disabled={save.isPending} onClick={onClose}>Cancel</button>
      <button className="btn primary" type="submit" disabled={!valid || save.isPending}>{save.isPending ? 'Saving…' : 'Save profile settings'}</button>
    </div>
  </form></Modal>
}
export function NotificationSettings() {
  const { query, save } = useNotificationPreferences()
  return <Panel quiet><h3>Notification preferences</h3><p className="sub">Critical updates have deadlines and stay enabled.</p>
    {query.isPending ? <p>Loading preferences…</p> : null}
    {query.isError ? <Banner kind="crit">{query.error instanceof Error ? query.error.message : 'Request failed.'} <button className="btn" onClick={() => void query.refetch()}>Retry</button></Banner> : null}
    {save.isError ? <Banner kind="crit">{save.error.message}</Banner> : null}
    {save.isSuccess ? <p role="status">Preference saved.</p> : null}
    {query.data?.categories.map(c => <label className="profile-checkbox profile-preference" key={c.key}><span>{label(c.key)}{c.locked ? ' — always on' : ''}</span><input type="checkbox" aria-label={`${label(c.key)} notifications`} checked={c.enabled} disabled={c.locked || c.key === 'critical' || save.isPending} onChange={e => { if (c.key !== 'critical' && !c.locked) save.mutate({ key: c.key, enabled: e.target.checked }) }} /></label>)}
  </Panel>
}
