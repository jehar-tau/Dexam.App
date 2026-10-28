import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { EmptyState } from '../components'
import { getSupabaseClient } from '../features/auth/supabaseClient'
import {
  cancelLiveEvent,
  createLiveEvent,
  fetchLiveEvents,
  formatWhen,
  publishLiveEvent,
  type NewLiveEvent,
} from '../features/testSeries/liveEvents'
import styles from './LiveEventsStaffPage.module.css'

/** `datetime-local` value (the organiser's local time) to an ISO instant, or null when empty. */
const toIso = (value: string) => (value ? new Date(value).toISOString() : null)

/** F050: organisers schedule, publish and cancel all-India live mocks. */
export function LiveEventsStaffPage() {
  const client = getSupabaseClient()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['live-events', 'staff'],
    queryFn: () => fetchLiveEvents(client!),
    enabled: Boolean(client),
  })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['live-events'] })

  const [form, setForm] = useState({
    key: '',
    title: '',
    blueprintKey: 'uceed-2026' as NewLiveEvent['blueprintKey'],
    startsAt: '',
    closesAt: '',
    breakMinutes: 15,
    seatLimit: 5000,
  })
  const create = useMutation({
    mutationFn: () =>
      createLiveEvent(client!, {
        key: form.key.trim().toLowerCase(),
        title: form.title.trim(),
        blueprintKey: form.blueprintKey,
        partAStartsAt: toIso(form.startsAt) ?? '',
        registrationClosesAt: toIso(form.closesAt),
        breakMinutes: form.breakMinutes,
        seatLimit: form.seatLimit,
      }),
    onSuccess: () => {
      setForm((value) => ({ ...value, key: '', title: '', startsAt: '', closesAt: '' }))
      refresh()
    },
  })
  const publish = useMutation({
    mutationFn: (eventId: string) => publishLiveEvent(client!, eventId),
    onSuccess: refresh,
  })
  const cancel = useMutation({
    mutationFn: (eventId: string) => cancelLiveEvent(client!, eventId),
    onSuccess: refresh,
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate()
  }

  return (
    <section className={styles.page} aria-labelledby="live-events-title">
      <p className="eyebrow">Test series</p>
      <h1 id="live-events-title">All-India live mocks</h1>
      <p className={styles.note}>
        Schedule an event, then publish it. Publishing pins one paper (and its Part B tasks) for
        every participant and opens registration.
      </p>

      <form className={styles.form} onSubmit={submit} aria-label="Schedule a live mock">
        <label>
          Event key
          <input
            required
            value={form.key}
            pattern="[a-z0-9][a-z0-9\-]{2,40}"
            placeholder="uceed-jan-2027"
            onChange={(event) => setForm({ ...form, key: event.target.value })}
          />
        </label>
        <label>
          Title
          <input
            required
            minLength={3}
            maxLength={120}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </label>
        <label>
          Pattern
          <select
            value={form.blueprintKey}
            onChange={(event) =>
              setForm({
                ...form,
                blueprintKey: event.target.value as NewLiveEvent['blueprintKey'],
              })
            }
          >
            <option value="uceed-2026">UCEED 2026 (Part A 120 min, Part B 60 min)</option>
            <option value="ceed-2026">CEED 2026 (Part A 60 min, Part B 120 min)</option>
          </select>
        </label>
        <label>
          Part A starts
          <input
            required
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
          />
        </label>
        <label>
          Registration closes (optional)
          <input
            type="datetime-local"
            value={form.closesAt}
            onChange={(event) => setForm({ ...form, closesAt: event.target.value })}
          />
        </label>
        <label>
          Break (minutes)
          <input
            required
            type="number"
            min={15}
            max={20}
            value={form.breakMinutes}
            onChange={(event) => setForm({ ...form, breakMinutes: Number(event.target.value) })}
          />
        </label>
        <label>
          Seats
          <input
            required
            type="number"
            min={1}
            max={100000}
            value={form.seatLimit}
            onChange={(event) => setForm({ ...form, seatLimit: Number(event.target.value) })}
          />
        </label>
        <button type="submit" className={styles.primary} disabled={create.isPending}>
          {create.isPending ? 'Scheduling…' : 'Schedule draft'}
        </button>
        {create.isError ? (
          <p className={styles.error} role="alert">
            {create.error.message}
          </p>
        ) : null}
      </form>

      {query.isError ? <p className={styles.error}>{query.error.message}</p> : null}
      {publish.isError ? (
        <p className={styles.error} role="alert">
          {publish.error.message}
        </p>
      ) : null}
      {cancel.isError ? (
        <p className={styles.error} role="alert">
          {cancel.error.message}
        </p>
      ) : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState title="No live mocks yet" description="Scheduled events appear here." />
      ) : null}
      {query.data?.length ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col">Part A</th>
              <th scope="col">Status</th>
              <th scope="col">Registered</th>
              <th scope="col">Paper</th>
              <th scope="col">
                <span className={styles.visuallyHidden}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((event) => {
              const started =
                event.schedule.phase !== 'registration' && event.schedule.phase !== 'waiting'
              return (
                <tr key={event.id}>
                  <th scope="row">
                    {event.title}
                    <span className={styles.key}>{event.key}</span>
                  </th>
                  <td>{formatWhen(event.schedule.partAStartsAt)}</td>
                  <td>{event.status === 'draft' ? 'Draft' : event.schedule.phase}</td>
                  <td>
                    {event.registered} / {event.seatLimit}
                  </td>
                  <td>
                    {event.status === 'draft'
                      ? '—'
                      : `${event.questionCount} questions · ${event.taskCount} tasks`}
                  </td>
                  <td className={styles.actions}>
                    {event.status === 'draft' ? (
                      <button
                        type="button"
                        className={styles.primary}
                        disabled={publish.isPending}
                        onClick={() => publish.mutate(event.id)}
                      >
                        Publish
                      </button>
                    ) : null}
                    {!started ? (
                      <button
                        type="button"
                        className={styles.secondary}
                        disabled={cancel.isPending}
                        onClick={() => {
                          if (window.confirm(`Cancel ${event.title}?`)) cancel.mutate(event.id)
                        }}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}
    </section>
  )
}
