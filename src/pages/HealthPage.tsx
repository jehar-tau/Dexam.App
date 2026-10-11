import { useQuery } from '@tanstack/react-query'

import { Badge, Button, Callout, Card } from '../components'
import { getBackendHealth } from '../features/platform/platformHealth'
import styles from './HealthPage.module.css'

export function HealthPage() {
  const isStaging = import.meta.env.VITE_APP_ENV === 'staging'
  const backendQuery = useQuery({
    queryKey: ['platform-health'],
    queryFn: getBackendHealth,
    retry: false,
  })

  return (
    <section className={styles.page} aria-labelledby="health-title">
      <div>
        <p className="eyebrow">System status</p>
        <h1 id="health-title">Application shell operational</h1>
        <p className="measure muted">
          This page confirms the deployed interface and its safe connection to the configured Dexam
          backend.
        </p>
      </div>

      {isStaging ? (
        <Callout icon="warning" tone="warning">
          <strong>Non-production environment</strong>
          <br />
          This staging site is for fictional test data and product review only.
        </Callout>
      ) : null}

      <div className={styles.statusGrid}>
        <Card>
          <div className={styles.statusHeading}>
            <h2>Frontend</h2>
            <Badge tone="success">Operational</Badge>
          </div>
          <p className="muted">The application assets and client-side router loaded correctly.</p>
        </Card>

        <Card>
          <div className={styles.statusHeading}>
            <h2>Backend</h2>
            {backendQuery.isPending ? <Badge>Checking</Badge> : null}
            {backendQuery.data === 'operational' ? <Badge tone="success">Operational</Badge> : null}
            {backendQuery.data === 'not-configured' ? (
              <Badge tone="warning">Not configured</Badge>
            ) : null}
            {backendQuery.isError ? <Badge tone="danger">Unavailable</Badge> : null}
          </div>
          {backendQuery.isPending ? (
            <p className="muted">Checking the configured backend…</p>
          ) : null}
          {backendQuery.data === 'operational' ? (
            <p className="muted">The public health operation responded without exposing data.</p>
          ) : null}
          {backendQuery.data === 'not-configured' ? (
            <p className="muted">No hosted backend is configured for this build.</p>
          ) : null}
          {backendQuery.isError ? (
            <div>
              <p className="muted">
                The backend could not confirm its status. No private details were returned.
              </p>
              <Button size="sm" variant="secondary" onClick={() => void backendQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
    </section>
  )
}
