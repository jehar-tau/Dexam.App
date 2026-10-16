// Fictional, exact-owned local fixtures; no hosted cleanup entry point.
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { reconcileAssignmentUploads } from './assignment-upload-cleanup.mjs'
let config
try {
  config = JSON.parse(
    execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  )
} catch {
  throw new Error('Local configuration unavailable; provider output withheld')
}
if (config.API_URL !== 'http://127.0.0.1:54321') throw new Error('Exact local API required')
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: {
    fetch: (url, init) => {
      if (new URL(url).origin !== config.API_URL) throw new Error('Local origin required')
      return fetch(url, { ...init, redirect: 'error' })
    },
  },
}
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options),
  editor = createClient(config.API_URL, config.ANON_KEY, options)
const template = readFileSync(
  'supabase/tests/00350_assignment_upload_reconciliation.test.sql',
  'utf8',
)
const mappings = new Map(
  [...template.matchAll(/d[0-9][0-9a-f]{6}-[0-9a-f-]{27}/g)].map((m) => [m[0], randomUUID()]),
)
const id = (kind, n = 1) => mappings.get(`d${kind}000000-0000-4000-8000-00000000000${n}`)
const users = [],
  emails = [],
  paths = [],
  reservations = [],
  people = [1, 2, 3, 4].map((n) => id(1, n))
let phase = 'fixtures',
  writer
const sql = (input) =>
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_dexam-platform',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim()
const must = async (result) => {
  const r = await result
  if (r.error) throw new Error('Fictional operation rejected')
  return r.data
}
const ensure = (value) => {
  if (!value) throw new Error('Fictional assertion failed')
}
const bytes = new TextEncoder().encode('%PDF-1.4 fictional assignment bytes')
async function reserve() {
  const request = randomUUID()
  const args = {
    p_request_id: request,
    p_version_id: id(8),
    p_file_name: 'drawing.pdf',
    p_mime_type: 'application/pdf',
    p_byte_size: bytes.length,
  }
  const r = (await must(editor.rpc('reserve_assignment_upload', args)))[0]
  reservations.push(r.upload_id)
  paths.push(r.object_path)
  ensure((await must(editor.rpc('reserve_assignment_upload', args)))[0].upload_id === r.upload_id)
  return r
}
async function upload(r, client = editor) {
  await must(
    client.storage
      .from('assignment-materials')
      .upload(r.object_path, bytes, { contentType: 'application/pdf', upsert: false }),
  )
}
async function lockVersion() {
  writer = spawn(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_dexam-platform',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  )
  let held = false
  writer.stdout.on('data', (data) => {
    if (String(data).includes('F030-held')) held = true
  })
  writer.stdin.write(
    `begin;select id from public.assignment_versions where id='${id(8)}' for update;select 'F030-held';\n`,
  )
  for (let i = 0; i < 100 && !held; i++) await new Promise((r) => setTimeout(r, 50))
  ensure(held)
}
async function release(sqlText = '') {
  const done = new Promise((resolve, reject) =>
    writer.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Lock release failed')),
    ),
  )
  writer.stdin.end(sqlText + 'commit;\n')
  await done
  writer = undefined
}
async function waitForLock() {
  for (let i = 0; i < 100; i++) {
    if (
      sql(
        `select count(distinct case when query ilike '%insert into%assignment_materials%' then 'insert' when query ilike '%delete from%assignment_materials%' then 'delete' end) from pg_stat_activity where wait_event_type='Lock' and pid in (select l.pid from pg_locks l where l.relation='public.assignment_versions'::regclass)`,
      ) === '2'
    )
      return
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error('Expected lock not observed')
}
try {
  for (let n = 1; n <= 4; n++) {
    const email = `upload-${randomUUID()}@fixture.invalid`,
      password = randomBytes(32).toString('base64url')
    emails.push(email)
    const created = await must(
      admin.auth.admin.createUser({ email, password, email_confirm: true }),
    )
    users.push(created.user.id)
    mappings.set(`d0000000-0000-4000-8000-00000000000${n}`, created.user.id)
    if (n === 1) await must(editor.auth.signInWithPassword({ email, password }))
  }
  let fixture =
    template.slice(
      template.indexOf('insert into public.people'),
      template.indexOf('insert into public.curriculum_versions'),
    ) +
    template.slice(
      template.indexOf('insert into public.assignment_definitions'),
      template.indexOf('insert into auth.sessions'),
    )
  for (const [before, after] of mappings) fixture = fixture.replaceAll(before, after)
  fixture = fixture
    .replaceAll(
      'DXM-DW3M9Q2RW5TY',
      'DXM-' + [...randomBytes(12)].map((v) => '23456789ABCDEFGHJKMNPQRSTUVWXYZ'[v % 30]).join(''),
    )
    .replaceAll('CONTENT_FOUNDATION', 'UF_' + randomBytes(5).toString('hex').toUpperCase())
    .replaceAll('CONTENT_OTHER', 'UO_' + randomBytes(5).toString('hex').toUpperCase())
  sql('begin;' + fixture + 'commit;')
  phase = 'real upload and retry'
  const attached = await reserve()
  await upload(attached)
  const material = await must(
    editor.rpc('attach_assignment_upload', { p_upload_id: attached.upload_id }),
  )
  ensure(
    (await must(editor.rpc('attach_assignment_upload', { p_upload_id: attached.upload_id }))) ===
      material,
  )
  ensure(
    (await must(editor.storage.from('assignment-materials').download(attached.object_path)))
      .size === bytes.length,
  )
  await editor.storage.from('assignment-materials').remove([attached.object_path])
  ensure(!(await editor.storage.from('assignment-materials').download(attached.object_path)).error)
  ensure(
    !!(
      await editor.storage
        .from('assignment-materials')
        .update(attached.object_path, bytes, { contentType: 'application/pdf' })
    ).error,
  )
  const orphan = await reserve()
  await upload(orphan)
  const held = await reserve()
  await upload(held)
  const legacy = `${id(2)}/${id(8)}/${randomUUID()}.pdf`
  paths.push(legacy)
  await upload({ object_path: legacy }, admin)
  ensure((await reconcileAssignmentUploads(admin, reservations)).examined === 0)
  sql(
    `update public.assignment_upload_reservations set created_at=now()-interval '31 days' where id in('${reservations.join("','")}');update public.assignment_upload_reservations set cleanup_hold=true where id='${held.upload_id}';`,
  )
  phase = 'cleanup failure and retry'
  const failing = {
    supabaseUrl: admin.supabaseUrl,
    rpc: admin.rpc.bind(admin),
    from: admin.from.bind(admin),
    storage: {
      from: () => ({ remove: async () => ({ error: { message: 'synthetic failure' } }) }),
    },
  }
  ensure((await reconcileAssignmentUploads(failing, reservations)).failed === 1)
  ensure(!(await admin.storage.from('assignment-materials').download(orphan.object_path)).error)
  ensure((await reconcileAssignmentUploads(admin, reservations)).deleted === 1)
  ensure(!!(await admin.storage.from('assignment-materials').download(orphan.object_path)).error)
  ensure(!(await admin.storage.from('assignment-materials').download(legacy)).error)
  ensure(!(await admin.storage.from('assignment-materials').download(held.object_path)).error)
  ensure(!!(await editor.rpc('attach_assignment_upload', { p_upload_id: orphan.upload_id })).error)
  phase = 'late upload marker replay'
  await upload(orphan, admin)
  ensure((await reconcileAssignmentUploads(admin, reservations)).deleted === 1)
  ensure(!!(await admin.storage.from('assignment-materials').download(orphan.object_path)).error)
  phase = 'direct metadata publication race'
  const pendingUpload = await reserve()
  await upload(pendingUpload)
  await lockVersion()
  const pendingInsert = editor
    .from('assignment_materials')
    .insert({
      assignment_version_id: id(8),
      object_path: pendingUpload.object_path,
      original_file_name: 'drawing.pdf',
      mime_type: 'application/pdf',
      byte_size: bytes.length,
      position: 2,
      created_by_person_id: id(1),
    })
    .then((r) => r)
  const pendingDelete = editor
    .from('assignment_materials')
    .delete()
    .eq('id', material)
    .then((r) => r)
  await waitForLock()
  // Privileged fictional publication fixture; this tests waiting mutations, not approval UI.
  await release(
    `update public.assignment_versions set status='published',published_by_person_id='${id(1, 2)}',published_at=now(),release_note='Fictional concurrent publication' where id='${id(8)}';`,
  )
  ensure(!!(await pendingInsert).error)
  ensure(!!(await pendingDelete).error)
  ensure(
    (await must(admin.from('assignment_materials').select('id').eq('id', material))).length === 1,
  )
  console.log(
    'F030 actual Storage acceptance passed: retries, reference/legacy/hold protection, failed deletion, late bytes and publication races.',
  )
} catch {
  console.error(
    `F030 acceptance failed during ${phase}; credentials and provider payloads withheld.`,
  )
  process.exitCode = 1
} finally {
  writer?.kill('SIGTERM')
  try {
    if (paths.length) await must(admin.storage.from('assignment-materials').remove(paths))
    const p = "('" + people.join("','") + "')",
      o = "('" + [id(2), id(2, 2)].join("','") + "')"
    const tables = [
      'assignment_materials',
      'assignment_upload_reservations',
      'assignment_versions',
      'assignment_definitions',
      'capability_grants',
      'role_assignments',
      'memberships',
      'auth_identities',
      'people',
      'offerings',
    ]
    const conditions = [
      `created_by_person_id in ${p}`,
      `creator_person_id in ${p}`,
      `assignment_definition_id='${id(7)}'`,
      `id='${id(7)}'`,
      ...Array(4).fill(`person_id in ${p}`),
      `id in ${p}`,
      `id in ${o}`,
    ]
    // Disable only custom domain triggers for exact-owned teardown, retaining FKs and original flags.
    sql(
      `begin;create temporary table fixture_trigger_flags on commit drop as select c.relname,t.tgname,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal and c.relname in ('${tables.join("','")}');do $$declare r record;begin for r in select * from fixture_trigger_flags loop execute format('alter table public.%I disable trigger %I',r.relname,r.tgname);end loop;end$$;delete from public.security_audit_events where subject_person_id in ${p};${tables.map((t, i) => 'delete from public.' + t + ' where ' + conditions[i] + ';').join('')}do $$declare r record;begin for r in select * from fixture_trigger_flags where tgenabled<>'D' loop execute format('alter table public.%I enable %s trigger %I',r.relname,case r.tgenabled when 'A' then 'always' when 'R' then 'replica' else '' end,r.tgname);end loop;end$$;commit;`,
    )
    // Creation may have committed even if its response was lost. Reconcile only
    // exact random fixture emails allocated before the call, never a broad prefix.
    for (let page = 1; ; page++) {
      const listed = await must(admin.auth.admin.listUsers({ page, perPage: 1000 }))
      for (const user of listed.users)
        if (emails.includes(user.email) && !users.includes(user.id)) users.push(user.id)
      if (listed.users.length < 1000) break
    }
    for (const user of users) await must(admin.auth.admin.deleteUser(user))
    console.log('F030 exact fictional files, accounts and domain fixtures cleaned.')
  } catch {
    console.error('F030 fixture cleanup requires inspection.')
    process.exitCode = 1
  }
}
