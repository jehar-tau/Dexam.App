import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Button } from '../components'
import { getAdmissionHistory } from '../features/enrolment/admissions'
import { formatPaise } from '../features/enrolment/payments'
import styles from './AdmissionsPage.module.css'

const changeLabels: Record<string, string> = {
  admitted: 'Admission recorded',
  details: 'Display name updated',
  dates: 'Access dates changed',
  renewal: 'Access renewed',
  suspension: 'Access suspended',
  revocation: 'Access revoked',
  batch_transfer: 'Batch transferred',
}
const snapshotFields = {
  name: 'Display name',
  startsAt: 'Access start',
  expiresAt: 'Access expiry',
  state: 'Access state',
  cohortId: 'Batch',
} as const
type Field = keyof typeof snapshotFields
const methods: Record<string, string> = {
  cash: 'Cash',
  online_transfer: 'Online transfer',
  card_machine: 'Card machine',
}

export function AdmissionHistory({
  accountId,
  enrollmentId,
  formatTime,
  batches,
}: {
  accountId: string
  enrollmentId: string
  formatTime: (value: string) => string
  batches: { id: string; name: string }[]
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [page, setPage] = useState(0)
  const history = useQuery({
    queryKey: ['admission-history', accountId, enrollmentId, page],
    queryFn: () => getAdmissionHistory(enrollmentId, page),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  function movePage(nextPage: number) {
    heading.current?.focus()
    setPage(nextPage)
  }
  function displayValue(field: Field, value: string | null | undefined) {
    if (value == null) return 'None'
    if (field === 'startsAt' || field === 'expiresAt') return formatTime(value)
    if (field === 'cohortId') return batches.find((batch) => batch.id === value)?.name ?? value
    return value
  }
  return (
    <section aria-label="Enrolment history" className={styles.history}>
      <h4 ref={heading} tabIndex={-1}>
        Enrolment history
      </h4>
      {history.isPending ? (
        <p role="status">Loading history…</p>
      ) : history.isError ? (
        <>
          <p role="alert">History could not be loaded. Check your admissions access.</p>
          <Button variant="secondary" onClick={() => void history.refetch()}>
            Retry history
          </Button>
        </>
      ) : (
        <>
          <h5>Access and record changes</h5>
          {history.data.changes.length === 0 && <p>No changes on this page.</p>}
          <ul className={styles.entries}>
            {history.data.changes.map((entry) => (
              <li key={entry.id}>
                <strong>{changeLabels[entry.action] ?? entry.action}</strong>
                <p>
                  {formatTime(entry.at)} · {entry.actorName ?? entry.actorId}
                </p>
                <p>Reason: {entry.reason}</p>
                <dl className={styles.values}>
                  {(Object.keys(snapshotFields) as Field[]).map((key) =>
                    entry.next[key] !== undefined && entry.next[key] !== entry.prior[key] ? (
                      <div key={key}>
                        <dt>{snapshotFields[key]}</dt>
                        <dd>
                          {entry.prior[key] !== undefined ? (
                            <>{displayValue(key, entry.prior[key])} → </>
                          ) : null}
                          {displayValue(key, entry.next[key])}
                        </dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              </li>
            ))}
          </ul>
          <h5>Manual admission receipts</h5>
          {history.data.receipts.length === 0 && <p>No admission receipts on this page.</p>}
          <ul className={styles.entries}>
            {history.data.receipts.map((receipt) => (
              <li key={receipt.id}>
                <strong>
                  {formatPaise(receipt.amountPaise)} · {methods[receipt.method] ?? receipt.method}
                </strong>
                <p>Reference: {receipt.reference}</p>
                <p>Received {formatTime(receipt.paidAt)}</p>
                <p>
                  Confirmed by {receipt.confirmedByName ?? receipt.confirmedBy} ·{' '}
                  {formatTime(receipt.confirmedAt)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
      {(page > 0 || history.data?.hasMore) && (
        <nav aria-label="History pages" className={styles.actions}>
          <Button variant="secondary" disabled={page === 0} onClick={() => movePage(page - 1)}>
            Previous history
          </Button>
          <span role="status">History page {page + 1}</span>
          <Button
            variant="secondary"
            disabled={!history.isSuccess || !history.data.hasMore}
            onClick={() => movePage(page + 1)}
          >
            Next history
          </Button>
        </nav>
      )}
    </section>
  )
}
