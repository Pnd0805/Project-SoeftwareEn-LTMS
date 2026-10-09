/**
 * src/features/tournament/AnnouncementsTab.tsx
 *
 * An Announcement is written by the Organizer, published here and pushed to
 * every approved leader's inbox at once. Posting is a modal, not an inline form:
 * the compose box appears only when somebody means to write one.
 *
 * ส่ง id ที่หน้าถืออยู่ตรงๆ — เดิมแปลงด้วย Number() ซึ่งได้ NaN กับ id ของ store
 * ประกาศที่โพสต์จึงไม่เคยโผล่ และประกาศที่มีอยู่แล้วใน seed ก็ไม่ขึ้นเลย
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Banner, Empty, Field, Panel } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { Modal } from '../../components/kit/Modal'
import { useCreateTournamentAnnouncement, useTournamentAnnouncements, useEditAnnouncement, useDeleteAnnouncement } from '../../hooks/useTournament'
import { ApiError, USE_MOCK } from '../../api/client'
import { createTournamentAnnouncementSchema, type CreateTournamentAnnouncementInput } from '../../schemas/tournament.schema'
import type { Tournament } from '../../shared/types'
import { fmtDateTime } from '../../shared/dateFormat'

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.'

export function AnnouncementsTab({ t, org }: { t: Tournament; org: boolean }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const edit = useEditAnnouncement(t.id)
  const remove = useDeleteAnnouncement(t.id)
  const publish = useCreateTournamentAnnouncement(t.id)
  const announcements = useTournamentAnnouncements(t.id)
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<CreateTournamentAnnouncementInput>({ resolver: zodResolver(createTournamentAnnouncementSchema) })
  const list = [...(announcements.data?.items ?? [])].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const fieldErrors = !!(errors.title || errors.body)

  const post = async (input: CreateTournamentAnnouncementInput) => {
    try { if (editing !== null) await edit.mutateAsync({ id: editing, input }); else await publish.mutateAsync(input); reset(); setOpen(false); setEditing(null) }
    catch (error) { if (error instanceof ApiError && error.fields) Object.entries(error.fields).forEach(([field, message]) => setError(field as keyof CreateTournamentAnnouncementInput, { type: 'server', message })) }
  }

  return (
    <>
      <div className="spread"><h2 className="journey-heading">Announcements</h2>
      {org ? (
        <div className="hstack" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary" type="button" onClick={() => { publish.reset(); edit.reset(); setEditing(null); reset({ title: '', body: '', type: 'general' }); setOpen(true) }}>
            <Icon name="bell" size={13} /> Post an announcement
          </button>
        </div>
      ) : null}</div>

      {announcements.isPending ? <Panel quiet><span className="sub">Loading announcements…</span></Panel>
        : announcements.isError ? (
          <Banner kind="crit">
            <b>Couldn't load the announcements.</b> {errorMessage(announcements.error)}{' '}
            <button className="btn ghost" type="button" onClick={() => void announcements.refetch()}>Try again</button>
          </Banner>
        ) : list.length ? list.map(a => (
          <Panel quiet key={a.id}>
            <div className="spread">
              <span className="tag"><em>//</em> Organizer · {fmtDateTime(a.createdAt)}</span>
            </div>
            <h3 className="journey-heading">{a.title}</h3>
            <div className="tour-announcement-body">{a.body}</div>
            {!a.title.trim() && !a.body.trim() ? <p className="sub">This announcement has no content.</p> : null}
            <span className="tag">{(a.type ?? 'general').replaceAll('_', ' ')}</span>
            {org && !USE_MOCK ? <div className="hstack"><button className="btn" onClick={() => { edit.reset(); setEditing(a.id); reset({ title: a.title, body: a.body, type: a.type ?? 'general' }); setOpen(true) }}>Edit announcement</button><button className="btn danger" onClick={() => { remove.reset(); setDeleting(a.id) }}>Delete announcement</button></div> : null}
          </Panel>
        )) : <Empty icon="bell" title="Nothing announced yet" />}

      <Modal open={open} onClose={() => !publish.isPending && !edit.isPending && setOpen(false)} label={editing === null ? 'Post an announcement' : 'Edit announcement'} title={t.name}>
        <form onSubmit={handleSubmit(post)}>
        <Field label="Announcement type" htmlFor="an-type"><select id="an-type" {...register('type')}>{['general', 'schedule_change', 'venue_change', 'result', 'livestream'].map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></Field>
        <Field label="Headline" htmlFor="an-title">
          <input id="an-title" maxLength={255} {...register('title')} aria-invalid={!!errors.title} aria-describedby={errors.title ? "an-title-error" : undefined}
            placeholder="Saturday kick-offs move 30 minutes later" />
          {errors.title?.message ? <span className="sub" id="an-title-error">{errors.title.message}</span> : null}
        </Field>
        <Field label="Message" htmlFor="an-body">
          <textarea id="an-body" rows={3} maxLength={5000} {...register('body')} aria-invalid={!!errors.body} aria-describedby={errors.body ? "an-body-error" : undefined}
            placeholder="What changed, and what people should do about it." />
          {errors.body?.message ? <span className="sub" id="an-body-error">{errors.body.message}</span> : null}
        </Field>
        <Banner kind="warn">
          This appears on the tournament page immediately for people who can access it and notifies approved team leaders.
          You can edit or remove it later; notifications already delivered may have been read.
        </Banner>
        {publish.isError && !fieldErrors ? <Banner kind="crit"><b>Couldn't post it.</b> {errorMessage(publish.error)}</Banner> : null}
        {edit.isError ? <Banner kind="crit">{errorMessage(edit.error)}</Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" disabled={publish.isPending || edit.isPending} onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn primary" type="submit" disabled={isSubmitting || publish.isPending || edit.isPending}>
            {publish.isPending || edit.isPending ? 'Saving…' : editing === null ? 'Post' : 'Save announcement'}
          </button>
        </div>
        </form>
      </Modal>
      <Modal open={deleting !== null} title="Delete announcement?" onClose={() => !remove.isPending && setDeleting(null)}><p>The announcement will be removed. Notifications already delivered may have been read.</p>{remove.isError ? <Banner kind="crit">{remove.error.message}</Banner> : null}<button className="btn" disabled={remove.isPending} onClick={() => setDeleting(null)}>Cancel</button>{' '}<button className="btn danger" disabled={remove.isPending} onClick={() => deleting !== null && remove.mutate(deleting, { onSuccess: () => setDeleting(null) })}>Confirm deletion</button></Modal>
    </>
  )
}
