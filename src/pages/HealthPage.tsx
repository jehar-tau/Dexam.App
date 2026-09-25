export function HealthPage() {
  return (
    <section aria-labelledby="health-title">
      <p className="eyebrow">System status</p>
      <h1 id="health-title">Application shell operational</h1>
      <p className="measure muted">
        The frontend router rendered successfully. Backend health checks will be added with the
        local Supabase environment.
      </p>
    </section>
  )
}
