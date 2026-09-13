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
import { useCreateTournamentAnnouncement, useTournamentAnnouncements } from '../../hooks/useTournament'
import { ApiError } from '../../api/client'
import { createTournamentAnnouncementSchema, type CreateTournamentAnnouncementInput } from '../../schemas/tournament.schema'
import type { Tournament } from '../../shared/types'

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.'

export function AnnouncementsTab({ t, org }: { t: Tournament; org: boolean }) {
  const [open, setOpen] = useState(false)
  const publish = useCreateTournamentAnnouncement(t.id)
  const announcements = useTournamentAnnouncements(t.id)
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<CreateTournamentAnnouncementInput>({ resolver: zodResolver(createTournamentAnnouncementSchema) })
  const list = [...(announcements.data?.items ?? [])].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const fieldErrors = !!(errors.title || errors.body)

  const post = async (input: CreateTournamentAnnouncementInput) => {
    try { await publish.mutateAsync(input); reset(); setOpen(false) }
    catch (error) { if (error instanceof ApiError && error.fields) Object.entries(error.fields).forEach(([field, message]) => setError(field as keyof CreateTournamentAnnouncementInput, { type: 'server', message })) }
  }

  return (
    <>
      {org ? (
        <div className="hstack" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary" type="button" onClick={() => { publish.reset(); setOpen(true) }}>
            <Icon name="bell" size={13} /> Post an announcement
          </button>
        </div>
      ) : null}

      {announcements.isPending ? <Panel quiet><span className="sub">Loading announcements…</span></Panel>
        : announcements.isError ? (
          <Banner kind="crit">
            <b>Couldn't load the announcements.</b> {errorMessage(announcements.error)}{' '}
            <button className="btn ghost" type="button" onClick={() => void announcements.refetch()}>Try again</button>
          </Banner>
        ) : list.length ? list.map(a => (
          <Panel quiet key={a.id}>
            <div className="spread">
              <span className="tag"><em>//</em> Organizer · {new Date(a.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="disp" style={{ fontSize: 19 }}>{a.title}</div>
            <div style={{ fontSize: 15, lineHeight: 1.55 }}>{a.body}</div>
          </Panel>
        )) : <Empty icon="bell" title="Nothing announced yet" />}

      <Modal open={open} onClose={() => setOpen(false)} label="Post an announcement" title={t.name}>
        <form onSubmit={handleSubmit(post)}>
        <Field label="Headline" htmlFor="an-title">
          <input id="an-title" {...register('title')} aria-invalid={!!errors.title}
            placeholder="Saturday kick-offs move 30 minutes later" />
          {errors.title?.message ? <span className="sub">{errors.title.message}</span> : null}
        </Field>
        <Field label="Message" htmlFor="an-body">
          <textarea id="an-body" rows={3} {...register('body')} aria-invalid={!!errors.body}
            placeholder="What changed, and what people should do about it." />
          {errors.body?.message ? <span className="sub">{errors.body.message}</span> : null}
        </Field>
        <Banner kind="warn">
          This appears on the public page immediately and notifies every approved team leader.
          Announcements can't be unsent.
        </Banner>
        {publish.isError && !fieldErrors ? <Banner kind="crit"><b>Couldn't post it.</b> {errorMessage(publish.error)}</Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn primary" type="submit" disabled={isSubmitting || publish.isPending}>
            {publish.isPending ? 'Posting…' : 'Post'}
          </button>
        </div>
        </form>
      </Modal>
    </>
  )
}
