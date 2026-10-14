import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Card, Callout } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import {
  getCurriculumImpact,
  getCurriculumPreviewContext,
} from '../features/content/curriculumPreview'
import styles from './SignInPage.module.css'
import fields from '../components/forms/Input.module.css'
import impactStyles from './CurriculumImpactPage.module.css'

export function CurriculumImpactPage() {
  const { session } = useAuth(),
    [offering, setOffering] = useState(''),
    [source, setSource] = useState(''),
    [target, setTarget] = useState(''),
    [selection, setSelection] = useState<{
      offering: string
      source: string
      target: string
    } | null>(null)
  const context = useQuery({
    queryKey: ['curriculum-preview-context', session?.user.id],
    queryFn: getCurriculumPreviewContext,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    enabled: Boolean(session),
    refetchInterval: 30_000,
  })
  const current = context.data?.find((item) => item.id === offering)
  const report = useQuery({
    queryKey: ['curriculum-impact', session?.user.id, selection],
    queryFn: () => getCurriculumImpact(selection!.offering, selection!.source, selection!.target),
    enabled: Boolean(selection && current && !context.isError),
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 30_000,
  })
  return (
    <section className={`${styles.layout} ${impactStyles.layout}`}>
      <div className={styles.intro}>
        <p className="eyebrow">Academic administration</p>
        <h1>Curriculum impact preview</h1>
        <p className={styles.lede}>
          Compare published versions before deciding how an upgrade should work.
        </p>
        <Callout>
          This is read-only. No students, coursework access, assignments or progress will be
          changed. No notices will be sent.
        </Callout>
      </div>
      <div>
        {context.isPending ? (
          <p role="status">Checking preview access…</p>
        ) : context.isError ? (
          <Callout tone="warning" icon="warning">
            Preview access could not be verified.{' '}
            <Button onClick={() => void context.refetch()}>Try again</Button>
          </Callout>
        ) : !context.data.length ? (
          <Callout>
            No offering is available for this preview. Both existing authorities and an explicit
            offering-scoped preview grant are required.
          </Callout>
        ) : (
          <Card>
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault()
                if (
                  selection?.offering === offering &&
                  selection.source === source &&
                  selection.target === target
                )
                  void report.refetch()
                else setSelection({ offering, source, target })
              }}
            >
              <label className={fields.field}>
                <span className={fields.label}>Offering</span>
                <select
                  className={fields.input}
                  aria-label="Offering"
                  value={offering}
                  required
                  onChange={(event) => {
                    setOffering(event.target.value)
                    setSource('')
                    setTarget('')
                    setSelection(null)
                  }}
                >
                  <option value="">Choose an offering</option>
                  {context.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              {(['source', 'target'] as const).map((kind) => (
                <label className={fields.field} key={kind}>
                  <span className={fields.label}>
                    {kind === 'source' ? 'Current version' : 'Compare with version'}
                  </span>
                  <select
                    className={fields.input}
                    aria-label={kind === 'source' ? 'Current version' : 'Compare with version'}
                    required
                    disabled={!current}
                    value={kind === 'source' ? source : target}
                    onChange={(event) => {
                      if (kind === 'source') setSource(event.target.value)
                      else setTarget(event.target.value)
                      setSelection(null)
                    }}
                  >
                    <option value="">Choose a published version</option>
                    {current?.versions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} · v{item.number}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <Button
                type="submit"
                disabled={!source || !target || source === target || report.isFetching}
              >
                Compare versions
              </Button>
            </form>
          </Card>
        )}
        {selection && current && report.isPending ? (
          <p role="status">Comparing published coursework…</p>
        ) : null}
        {selection && current && report.isError ? (
          <Callout tone="warning" icon="warning">
            The comparison could not be verified.{' '}
            <Button onClick={() => void report.refetch()}>Try again</Button>
          </Callout>
        ) : null}
        {selection && current && !context.isError && !report.isError && report.data ? (
          <Card>
            <h2>Read-only impact</h2>
            <p>
              Active enrolments pinned to the current version: {report.data.affected.total} (
              {report.data.affected.direct} direct, {report.data.affected.cohort} through active
              cohorts).
            </p>
            <p>
              Difference entries: {report.data.counts.added} added, {report.data.counts.removed}{' '}
              removed, {report.data.counts.changed} changed.
            </p>
            {report.data.truncated ? (
              <Callout>Showing the first 100 differences. Totals include all differences.</Callout>
            ) : null}
            {!report.data.differences.length ? (
              <p>No topic, lesson or material differences.</p>
            ) : (
              <ul>
                {report.data.differences.map((item) => (
                  <li key={item.kind + item.code}>
                    <strong>
                      {item.change} · {item.kind}
                    </strong>
                    : {item.title} ({item.code})
                  </li>
                ))}
              </ul>
            )}
            <p>No migration action is available.</p>
          </Card>
        ) : null}
      </div>
    </section>
  )
}
