/**
 * Returns `?preview=1` only when the URL asks for preview AND this build enables the
 * fictional student preview; otherwise ''. Pages treat a non-empty result as "show
 * fictional data", so a real student adding `?preview=1` on a normal build sees real
 * (empty) data, never fixtures.
 */
export function previewSearch(search: string): string {
  return import.meta.env.VITE_ENABLE_STUDENT_PREVIEW === 'true' &&
    new URLSearchParams(search).get('preview') === '1'
    ? '?preview=1'
    : ''
}
