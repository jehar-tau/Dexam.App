// Local fictional rehearsal helper only. No scheduler or hosted entry point.
export async function reconcileAssignmentUploads(admin, uploadIds) {
  if (admin.supabaseUrl !== 'http://127.0.0.1:54321') throw new Error('Exact local client required')
  if (
    !Array.isArray(uploadIds) ||
    uploadIds.length < 1 ||
    uploadIds.length > 100 ||
    uploadIds.some(
      (id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id),
    )
  ) {
    throw new Error('Exact bounded fictional upload identities required')
  }
  const claimed = await admin.rpc('claim_assignment_upload_cleanup', {
    p_limit: 100,
    p_upload_ids: uploadIds,
  })
  if (claimed.error) throw new Error('Upload cleanup claim failed')
  let deleted = 0,
    failed = 0
  for (const candidate of claimed.data ?? []) {
    if (!uploadIds.includes(candidate.upload_id)) throw new Error('Cleanup scope mismatch')
    const lookup = await admin
      .from('assignment_upload_reservations')
      .select('object_path,state,cleanup_hold')
      .eq('id', candidate.upload_id)
      .single()
    if (
      lookup.error ||
      lookup.data.state !== 'deleting' ||
      lookup.data.cleanup_hold ||
      lookup.data.object_path !== candidate.object_path
    ) {
      failed++
      continue
    }
    const refs = await admin
      .from('assignment_materials')
      .select('id')
      .eq('object_path', candidate.object_path)
      .limit(1)
    if (refs.error || refs.data.length) {
      failed++
      continue
    }
    const removed = await admin.storage.from('assignment-materials').remove([candidate.object_path])
    if (removed.error) {
      failed++
      continue
    }
    const completed = await admin.rpc('complete_assignment_upload_cleanup', {
      p_upload_id: candidate.upload_id,
    })
    if (completed.error) {
      failed++
      continue
    }
    deleted++
  }
  return { examined: claimed.data?.length ?? 0, deleted, failed }
}
