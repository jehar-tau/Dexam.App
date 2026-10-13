// A network failure or 5xx is not proof that a remote password mutation stopped.
export function employeePasswordUpdateOutcome(result, expectedAuthId) {
  if (!result?.error && result?.data?.user?.id === expectedAuthId) return 'succeeded'
  const status = result?.error?.status
  if (typeof status === 'number' && status >= 400 && status < 500 && status !== 408)
    return 'rejected'
  return 'uncertain'
}
