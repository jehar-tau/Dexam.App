import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Avatar, Badge, Button, Callout, Card } from '../components'
import { type ActivationPack, issueActivationPack } from '../features/enrolment/issueActivationPack'
import styles from './EnrolmentOperatorPage.module.css'

const previewEnrollment = {
  id: '94000000-0000-4000-8000-000000000001',
  studentName: 'Aarohi Deshmukh',
  memberId: 'DXM-2K3M9Q2RW5TY',
  offering: 'Design Entrance Foundation',
  cohort: 'Studio Batch · Autumn 2026',
  requestedBy: 'Admissions desk',
} as const

const previewPack: ActivationPack = {
  memberId: previewEnrollment.memberId,
  activationUrl:
    'http://127.0.0.1:5173/activate?memberId=DXM-2K3M9Q2RW5TY&token=fictional-preview-token-not-valid',
  backupCode: '7K3M9Q2RW5',
  expiresAt: '2026-10-06T15:30:00.000Z',
  reissued: false,
}

type ViewState = 'queue' | 'review' | 'issuing' | 'issued'

async function copyText(value: string) {
  await navigator.clipboard.writeText(value)
}

export function EnrolmentOperatorPage() {
  const [searchParams] = useSearchParams()
  const previewEnabled =
    import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true' && searchParams.get('preview') === '1'
  const [view, setView] = useState<ViewState>('queue')
  const [pack, setPack] = useState<ActivationPack | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  if (!previewEnabled) {
    return (
      <section className={styles.locked} aria-labelledby="live-queue-title">
        <p className="eyebrow">Staff workspace</p>
        <h1 id="live-queue-title">The live enrolment queue is next.</h1>
        <p>
          Your employee access is verified. Live enrolment retrieval will be connected in the next
          delivery slice; no fictional student data is shown here.
        </p>
      </section>
    )
  }

  async function handleIssue() {
    setError('')
    setView('issuing')
    try {
      const issuedPack = previewEnabled
        ? await new Promise<ActivationPack>((resolve) =>
            window.setTimeout(() => resolve(previewPack), 450),
          )
        : await issueActivationPack(previewEnrollment.id, '')
      setPack(issuedPack)
      setView('issued')
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : 'The activation pack failed.')
      setView('review')
    }
  }

  async function handleCopy(label: string, value: string) {
    try {
      await copyText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1600)
    } catch {
      setError('Copy is unavailable. Select the value and copy it manually.')
    }
  }

  return (
    <section className={styles.workspace} aria-labelledby="operator-title">
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">Enrolment desk · Local preview</p>
          <h1 id="operator-title">Activation queue</h1>
          <p className={styles.lede}>
            Review approved enrolments and hand account activation directly to the student.
          </p>
        </div>
        <div className={styles.operator} aria-label="Current operator">
          <span>Enrolment Operator</span>
          <strong>Fictional staff account</strong>
        </div>
      </header>

      {view === 'queue' ? (
        <div className={styles.queue}>
          <div className={styles.queueHeader}>
            <div>
              <h2>Ready for activation</h2>
              <p>1 approved enrolment</p>
            </div>
            <Badge pill tone="success">
              Approved
            </Badge>
          </div>
          <Card className={styles.enrollmentCard}>
            <Avatar name={previewEnrollment.studentName} size="lg" />
            <div className={styles.student}>
              <h3>{previewEnrollment.studentName}</h3>
              <p>{previewEnrollment.memberId}</p>
            </div>
            <dl className={styles.summary}>
              <div>
                <dt>Offering</dt>
                <dd>{previewEnrollment.offering}</dd>
              </div>
              <div>
                <dt>Cohort</dt>
                <dd>{previewEnrollment.cohort}</dd>
              </div>
            </dl>
            <Button onClick={() => setView('review')}>Review enrolment</Button>
          </Card>
        </div>
      ) : null}

      {view === 'review' || view === 'issuing' ? (
        <div className={styles.reviewLayout}>
          <Button variant="link" onClick={() => setView('queue')}>
            ← Back to queue
          </Button>
          <Card className={styles.reviewCard}>
            <div className={styles.reviewHeading}>
              <Badge tone="accent">Final review</Badge>
              <h2>Issue activation pack?</h2>
              <p>Confirm the enrolment details before generating one-time credentials.</p>
            </div>
            <dl className={styles.details}>
              <div>
                <dt>Student</dt>
                <dd>{previewEnrollment.studentName}</dd>
              </div>
              <div>
                <dt>Member ID</dt>
                <dd className={styles.mono}>{previewEnrollment.memberId}</dd>
              </div>
              <div>
                <dt>Offering</dt>
                <dd>{previewEnrollment.offering}</dd>
              </div>
              <div>
                <dt>Cohort</dt>
                <dd>{previewEnrollment.cohort}</dd>
              </div>
              <div>
                <dt>Requested by</dt>
                <dd>{previewEnrollment.requestedBy}</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>48 hours after issue</dd>
              </div>
            </dl>
            <div className={styles.securityNote}>
              <Callout tone="warning" icon="warning">
                <strong>The student creates their own password.</strong>
                <span>Never ask them to share it with staff.</span>
              </Callout>
            </div>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.actions}>
              <Button variant="secondary" onClick={() => setView('queue')}>
                Cancel
              </Button>
              <Button disabled={view === 'issuing'} onClick={() => void handleIssue()}>
                {view === 'issuing' ? 'Issuing securely…' : 'Issue activation pack'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {view === 'issued' && pack ? (
        <Card className={styles.resultLayout}>
          <div className={styles.successMark} aria-hidden="true">
            ✓
          </div>
          <div className={styles.resultIntro}>
            <p className="eyebrow">Activation pack ready</p>
            <h2>Hand this directly to the student.</h2>
            <p>
              These one-time credentials are shown for this handoff. Reissuing the pack will
              invalidate them.
            </p>
          </div>
          <div className={styles.credentials}>
            <Credential
              label="Member ID"
              value={pack.memberId}
              copied={copied}
              onCopy={handleCopy}
            />
            <Credential
              label="Backup code"
              value={pack.backupCode}
              copied={copied}
              onCopy={handleCopy}
              prominent
            />
            <Credential
              label="Activation link"
              value={pack.activationUrl}
              copied={copied}
              onCopy={handleCopy}
              wrap
            />
          </div>
          <div className={styles.expiry}>
            <span>Expires</span>
            <strong>6 October 2026 · 9:00 PM</strong>
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <Button className={styles.doneAction} onClick={() => setView('queue')}>
            Done
          </Button>
        </Card>
      ) : null}

      {copied ? (
        <p className={styles.toast} role="status">
          {copied} copied
        </p>
      ) : null}
    </section>
  )
}

type CredentialProps = {
  label: string
  value: string
  copied: string
  onCopy: (label: string, value: string) => Promise<void>
  prominent?: boolean
  wrap?: boolean
}

function Credential({
  label,
  value,
  copied,
  onCopy,
  prominent = false,
  wrap = false,
}: CredentialProps) {
  return (
    <div className={`${styles.credential} ${prominent ? styles.prominent : ''}`}>
      <span>{label}</span>
      <code className={wrap ? styles.wrap : ''}>{value}</code>
      <Button size="sm" variant="secondary" onClick={() => void onCopy(label, value)}>
        {copied === label ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
