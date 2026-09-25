import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section aria-labelledby="not-found-title">
      <p className="eyebrow">404</p>
      <h1 id="not-found-title">This page does not exist.</h1>
      <p className="measure muted">The address may be incomplete or the page may have moved.</p>
      <Link className="text-link" to="/">
        Return to the foundation
      </Link>
    </section>
  )
}
