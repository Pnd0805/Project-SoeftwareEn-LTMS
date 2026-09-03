/**
 * src/features/tournament/AnnouncementsTab.tsx
 *
 * An Announcement is written by the Organizer, published here and pushed to
 * every approved leader's inbox at once. Posting is a modal, not an inline form:
 * the compose box appears only when somebody means to write one.
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

export function AnnouncementsTab({ t, org }: { t: Tournament; org: boolean }) {
  const [open, setOpen] = useState(false)
  const tournamentId = Number(t.id)
  const publish = useCreateTournamentAnnouncement(tournamentId)
  const announcements = useTournamentAnnouncements(tournamentId)
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<CreateTournamentAnnouncementInput>({ resolver: zodResolver(createTournamentAnnouncementSchema) })
  const list = [...(announcements.data?.items ?? [])].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const post = async (input: CreateTournamentAnnouncementInput) => {
    try { await publish.mutateAsync(input); reset(); setOpen(false) }
    catch (error) { if (error instanceof ApiError && error.fields) Object.entries(error.fields).forEach(([field, message]) => setError(field as keyof CreateTournamentAnnouncementInput, { type: 'server', message })) }
  }

  return (
    <>
      {org ? (
        <div className="hstack" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary" type="button" onClick={() => setOpen(true)}>
            <Icon name="bell" size={13} /> Post an announcement
          </button>
        </div>
      ) : null}

      {list.length ? list.map(a => (
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
        <div className="hstack">
          <button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn primary" type="submit" disabled={isSubmitting || publish.isPending}>Post</button>
        </div>
        </form>
      </Modal>
    </>
  )
}
