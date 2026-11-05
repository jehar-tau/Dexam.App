const names = new WeakMap<Blob, string>()
let counter = 0

/** jsdom has no object URLs; each fictional private file gets a readable, predictable address. */
export function installObjectUrls() {
  URL.createObjectURL = (blob: Blob) => `blob:fictional/${names.get(blob) ?? `file-${++counter}`}`
  URL.revokeObjectURL = () => {}
}

/** A fictional private file whose object URL is `blob:fictional/<path>`. */
export function fictionalFile(path: string, type = '') {
  const blob = new Blob([path], { type })
  names.set(blob, path)
  return blob
}

/** A Storage `download` that serves every fictional path except the denied ones. */
export function fictionalDownload(denied: (path: string) => boolean = () => false) {
  return vi.fn((path: string) =>
    Promise.resolve(
      denied(path)
        ? { data: null, error: { message: 'Object not found' } }
        : { data: fictionalFile(path), error: null },
    ),
  )
}
