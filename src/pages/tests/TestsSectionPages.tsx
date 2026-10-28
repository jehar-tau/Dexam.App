import { Navigate, useLocation } from 'react-router-dom'

import { previewSearch } from '../../features/testSeries/previewSearch'

/**
 * Retired sections keep their old links working: Analytics, Bookmarks and Sketches (D-059) land
 * on Home; Papers, Mocks and Drawing (D-062) on Mock test.
 */
export function RetiredTestsSection({ to = '/tests' }: { to?: string }) {
  return <Navigate replace to={`${to}${previewSearch(useLocation().search)}`} />
}

/** The old F037 demo URL now opens Mock test, keeping preview mode. */
export function LegacyStudentTestsRedirect() {
  return <RetiredTestsSection to="/tests/mock-test" />
}
