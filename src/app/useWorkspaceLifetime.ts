import { useEffect, useRef } from 'react'

/** Stop retired workspace continuations before they start another protected operation. */
export function useWorkspaceLifetime() {
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  return {
    assertActive() {
      if (!active.current) throw new Error('Your workspace changed. Start the operation again.')
    },
  }
}
