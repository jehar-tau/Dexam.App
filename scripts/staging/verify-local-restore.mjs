// Disposable fictional application-data restore, never a production/Auth backup tool.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { assertOwned, assertTarget, digest, verifyManifest } from './restore-safety.mjs'

const root = process.cwd(),
  run = randomBytes(6).toString('hex')
const directory = mkdtempSync(join(tmpdir(), 'dexam-restore-'))
const cli = join(root, 'node_modules/.bin/supabase')
const sides = [],
  objects = new Map(),
  started = Date.now()
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}
let phase = 'preflight',
  failed = false,
  cleanupFailed = false
function command(executable, args, input) {
  return execFileSync(executable, args, {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    timeout: 240000,
  })
}
function sql(side, query) {
  assertOwned(side.project, run)
  return command(
    'docker',
    [
      'exec',
      '-i',
      `supabase_db_${side.project}`,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
      '-v',
      'VERBOSITY=verbose',
    ],
    query,
  ).trim()
}
async function must(promise) {
  const result = await promise
  if (result.error) {
    const code = String(result.error.code ?? '')
    if (/^[A-Z0-9]{5,10}$/.test(code)) console.error(`Operation code: ${code}`)
    const constraint = String(result.error.message ?? '').match(
      /(?:constraint|column|relation) "([a-z_]+)"/,
    )
    if (constraint) console.error(`Schema diagnostic: ${constraint[1]}`)
    throw new Error('Fictional operation failed')
  }
  return result.data
}
function check(value) {
  if (!value) throw new Error('Acceptance failed')
}
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => server.close(resolve))
  })
}
function client(side, service = false) {
  return createClient(side.config.API_URL, side.config[service ? 'SERVICE_ROLE_KEY' : 'ANON_KEY'], {
    ...options,
    global: {
      fetch: (url, init) => {
        check(new URL(url).origin === new URL(side.config.API_URL).origin)
        return fetch(url, { ...init, redirect: 'error' })
      },
    },
  })
}
async function start(sideName, port) {
  const project = `restore-${run}-${sideName}`,
    workdir = join(directory, sideName)
  assertOwned(project, run)
  for (const p of [port, port + 1, port + 2, port + 3]) await freePort(p)
  check(!command('docker', ['ps', '-a', '--format', '{{.Names}}']).includes(project))
  check(!command('docker', ['volume', 'ls', '--format', '{{.Name}}']).includes(project))
  mkdirSync(join(workdir, 'supabase'), { recursive: true, mode: 0o700 })
  cpSync(join(root, 'supabase/migrations'), join(workdir, 'supabase/migrations'), {
    recursive: true,
  })
  writeFileSync(
    join(workdir, 'supabase/config.toml'),
    `project_id = "${project}"
[api]
port = ${port}
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
[db]
port = ${port + 1}
shadow_port = ${port + 2}
major_version = 17
[db.seed]
enabled = false
[studio]
enabled = false
[inbucket]
port = ${port + 3}
[auth]
site_url = "http://127.0.0.1:${port}"
enable_signup = false
[analytics]
enabled = false
`,
    { mode: 0o600 },
  )
  const side = { project, workdir, port }
  sides.push(side) // Own only this exact random project, including a partial startup.
  command(cli, [
    'start',
    '--workdir',
    workdir,
    '--exclude',
    'realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor',
  ])
  side.config = JSON.parse(command(cli, ['status', '--workdir', workdir, '--output', 'json']))
  assertTarget(side.config, port)
  // The copied migrations are the only schema source; no application fixture bootstrap.
  side.admin = client(side, true)
  check(sql(side, 'select count(*) from cron.job') === '0')
  return side
}
const accounts = Array.from({ length: 5 }, (_, n) => ({
  id: `f0000000-0000-4000-8000-00000000000${n + 1}`,
  email: `restore-${run}-${n}@fixture.invalid`,
  password: randomBytes(32).toString('base64url'),
}))
async function identities(side) {
  side.clients = []
  for (const account of accounts) {
    check(
      (await must(side.admin.auth.admin.createUser({ ...account, email_confirm: true }))).user
        .id === account.id,
    )
    const session = client(side)
    await must(
      session.auth.signInWithPassword({ email: account.email, password: account.password }),
    )
    side.clients.push(session)
  }
}
const instance = 'fb000000-0000-4000-8000-000000000001'
const lesson = 'a6000000-0000-4000-8000-000000000001'
let revision, privateRevision, erasureCase, enquiry
async function access(side, revoked = false) {
  const [teacher, student, other] = side.clients
  phase = 'access: teacher scope'
  const reviews = await must(teacher.rpc('list_feedback_review_queue'))
  check(revoked ? reviews.length === 0 : reviews.length > 0)
  phase = 'access: student isolation'
  const own = await must(
    student.from('student_assignment_instances').select('id').eq('id', instance),
  )
  const foreign = await must(
    other.from('student_assignment_instances').select('id').eq('id', instance),
  )
  check(own.length === 1 && foreign.length === 0)
  // Direct bucket reads must not become public on restore.
  for (const entry of manifest.entries) {
    phase = `access: private bucket ${entry.bucket}`
    check((await client(side).storage.from(entry.bucket).download(entry.path)).error)
    if (
      ['student-submissions', 'teacher-feedback-audio', 'assignment-materials'].includes(
        entry.bucket,
      )
    ) {
      const ownBytes = Buffer.from(
        await (await must(student.storage.from(entry.bucket).download(entry.path))).arrayBuffer(),
      )
      check(digest(ownBytes) === entry.sha256)
      if (entry.bucket !== 'assignment-materials')
        check((await other.storage.from(entry.bucket).download(entry.path)).error)
    }
  }
  phase = 'access: feedback visibility'
  check(
    (await must(student.from('feedback_revisions').select('id').eq('id', revision))).length === 1,
  )
  check(
    (await must(other.from('feedback_revisions').select('id').eq('id', privateRevision))).length ===
      0,
  )
  phase = 'access: lesson scope'
  check((await must(student.rpc('list_lesson_files', { p_lesson_id: lesson }))).length === 1)
  check((await must(other.rpc('list_lesson_files', { p_lesson_id: lesson }))).length === 0)
}
const version = command('git', ['rev-parse', 'HEAD']).trim()
check(command('git', ['status', '--porcelain', '--', 'supabase/migrations']).trim() === '')
const manifest = { version, entries: [] }
try {
  console.log('Restore rehearsal: creating isolated fictional source')
  const source = await start('source', 56321)
  phase = 'fixture setup'
  await identities(source)
  const template = readFileSync(
    join(root, 'supabase/tests/00120_teacher_feedback.test.sql'),
    'utf8',
  )
  const begin = template.indexOf('insert into public.people'),
    end = template.indexOf('-- Explicit owned provider sessions')
  check(begin > 0 && end > begin)
  sql(source, `begin;${template.slice(begin, end)}commit;`)
  const teacher = source.clients[0]
  const feedback = await must(
    teacher.rpc('start_feedback_draft', {
      p_submission_attempt_id: 'fc000000-0000-4000-8000-000000000001',
    }),
  )
  revision = typeof feedback === 'string' ? feedback : feedback?.[0]?.id
  check(revision)
  await must(
    teacher.rpc('save_feedback_draft', {
      p_feedback_revision_id: revision,
      p_written_text: 'Fictional restore feedback.',
      p_source_kind: 'human',
      p_voice_equivalent_confirmed: true,
    }),
  )
  // All migration-created buckets get byte coverage, including future buckets.
  const buckets = await must(source.admin.storage.listBuckets())
  check(buckets.length > 0)
  for (const bucket of buckets) {
    check(!bucket.public)
    const audio = bucket.id === 'teacher-feedback-audio'
    const mime = audio ? 'audio/webm' : 'application/pdf'
    const fileId = 'ab000000-0000-4000-8000-000000000001'
    const path = audio
      ? `${revision}/${fileId}.webm`
      : bucket.id === 'student-submissions'
        ? `${instance}/fc000000-0000-4000-8000-000000000001/${fileId}.pdf`
        : bucket.id === 'assignment-materials'
          ? `f2000000-0000-4000-8000-000000000001/f9000000-0000-4000-8000-000000000001/${fileId}.pdf`
          : `${lesson}/${fileId}.pdf`
    const bytes = Buffer.from(
      audio ? 'fictional audio bytes' : '%PDF-1.4\nfictional restore material\n',
    )
    await must(source.admin.storage.from(bucket.id).upload(path, bytes, { contentType: mime }))
    const captured = Buffer.from(
      await (await must(source.admin.storage.from(bucket.id).download(path))).arrayBuffer(),
    )
    objects.set(`${bucket.id}/${path}`, captured)
    manifest.entries.push({
      bucket: bucket.id,
      path,
      mime,
      size: captured.length,
      sha256: digest(captured),
    })
  }
  phase = 'linked academic fixture setup'
  const byBucket = (name) => manifest.entries.find((entry) => entry.bucket === name)
  const submission = byBucket('student-submissions'),
    audio = byBucket('teacher-feedback-audio'),
    material = byBucket('assignment-materials'),
    notes = byBucket('lesson-materials')
  check(submission && audio && material && notes)
  // Privileged construction of synthetic fixture history only, in this owned source.
  // Fixture FKs are explicitly revalidated below; this is not authoring UI coverage.
  sql(
    source,
    `begin;set local session_replication_role=replica;
    insert into public.submission_files(submission_attempt_id,object_path,original_file_name,mime_type,byte_size,original_byte_size,position,status,ready_at)
    values('fc000000-0000-4000-8000-000000000001','${submission.path}','work.pdf','application/pdf',${submission.size},${submission.size},1,'ready',now());
    insert into public.feedback_audio_files(feedback_revision_id,kind,object_path,original_file_name,mime_type,byte_size,duration_seconds,status,ready_at)
    values('${revision}','voice_note','${audio.path}','feedback.webm','audio/webm',${audio.size},1,'ready',now());
    insert into public.assignment_materials(assignment_version_id,object_path,original_file_name,mime_type,byte_size,position,created_by_person_id)
    values('f9000000-0000-4000-8000-000000000001','${material.path}','brief.pdf','application/pdf',${material.size},1,'f1000000-0000-4000-8000-000000000001');
    insert into public.curriculum_versions(id,offering_id,version_number,title,status,created_by_person_id,published_by_person_id,published_at,release_note)
    values('a3000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001',1,'Fictional recovered curriculum','published','f1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001',now(),'Fictional release');
    insert into public.curriculum_sections(id,curriculum_version_id,code,title,position) values('a4000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','DRAW','Drawing',1);
    insert into public.curriculum_topics(id,section_id,code,title,position) values('a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','TOPIC','Fictional topic',1);
    insert into public.curriculum_lessons(id,topic_id,code,title,body_markdown,position) values('${lesson}','a5000000-0000-4000-8000-000000000001','LESSON','Fictional lesson','Fictional notes',1);
    update public.enrollments set cohort_id=null,curriculum_version_id='a3000000-0000-4000-8000-000000000001' where id='f4000000-0000-4000-8000-000000000001';
    insert into public.lesson_file_assets(id,reserved_lesson_id,creator_person_id,object_path,file_name,mime_type,byte_size,state)
    values('a8000000-0000-4000-8000-000000000001','${lesson}','f1000000-0000-4000-8000-000000000001','${notes.path}','notes.pdf','application/pdf',${notes.size},'ready');
    insert into public.lesson_materials values('${lesson}','a8000000-0000-4000-8000-000000000001');
    commit;`,
  )
  phase = 'feedback publication'
  await must(
    teacher.rpc('publish_feedback_revision', {
      p_feedback_revision_id: revision,
      p_outcome: 'review_completed',
      p_correction_reason: null,
    }),
  )
  privateRevision = await must(
    teacher.rpc('start_feedback_draft', {
      p_submission_attempt_id: 'fc000000-0000-4000-8000-000000000002',
    }),
  )
  phase = 'source access checks'
  await access(source)
  phase = 'fictional erasure fixture'
  enquiry = (
    await must(
      source.clients[3].rpc('create_crm_enquiry', {
        p_subject_name: 'Fictional Restore Prospect',
        p_contact_name: 'Fictional Restore Prospect',
        p_contact_relationship: 'self',
        p_contact_kind: 'email',
        p_contact_value: `prospect-${run}@fixture.invalid`,
        p_interest_summary: 'Fictional erasure rehearsal',
        p_target_intake: '2027',
        p_source: 'manual',
        p_request_key: 'a9000000-0000-4000-8000-000000000001',
      }),
    )
  )[0].enquiry_id
  erasureCase = 'a9000000-0000-4000-8000-000000000002'
  // Pre-approved synthetic case: this tests the existing executor, not MFA approval UI.
  sql(
    source,
    `begin;
    insert into public.role_assignments(person_id,role_key,grant_reason) values
    ('f1000000-0000-4000-8000-000000000001','elevated_admin','Fictional restore privacy fixture'),
    ('f1000000-0000-4000-8000-000000000005','elevated_admin','Fictional restore privacy fixture');
    insert into public.capability_grants(person_id,capability_key,required_role_key,grant_reason) values
    ('f1000000-0000-4000-8000-000000000001','privacy.manage','elevated_admin','Fictional restore privacy fixture'),
    ('f1000000-0000-4000-8000-000000000005','privacy.erase_approve','elevated_admin','Fictional restore privacy fixture');
    insert into public.crm_privacy_cases(id,enquiry_id,kind,status,requester_relationship,verification_method,request_summary,created_by_person_id,verified_by_person_id,proposed_by_person_id,approved_by_person_id,proposed_at,approved_at,proposal_reason,approval_note)
    values('${erasureCase}','${enquiry}','erasure','approved','self','in_person','Fictional pre-approved restore fixture','f1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000005',now(),now(),'Fictional erasure request','Fictional independent approval');commit;`,
  )
  phase = 'capture'
  verifyManifest(manifest, objects, version)
  const dump = command('docker', [
    'exec',
    `supabase_db_${source.project}`,
    'pg_dump',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '--data-only',
    '--schema=public',
    '--no-owner',
    '--no-privileges',
  ])
  const dumpHash = digest(dump)
  const foreignKeys = sql(
    source,
    `select string_agg(format('alter table %s drop constraint %I; alter table %s add constraint %I %s NOT VALID; alter table %s validate constraint %I;',conrelid::regclass,conname,conrelid::regclass,conname,pg_get_constraintdef(oid),conrelid::regclass,conname),E'\n') from pg_constraint where contype='f' and connamespace='public'::regnamespace`,
  )
  check(foreignKeys.length > 0)
  sql(source, `begin;${foreignKeys}commit;`)
  writeFileSync(join(directory, 'application.sql'), dump, { mode: 0o600 })
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify(manifest), { mode: 0o600 })
  phase = 'post-backup erasure'
  await must(source.admin.rpc('execute_approved_crm_erasure', { p_case_id: erasureCase }))
  const tombstones = await must(
    source.admin
      .from('crm_privacy_erasure_tombstones')
      .select('case_id,enquiry_id,policy_version')
      .eq('case_id', erasureCase),
  )
  check(tombstones.length === 1 && tombstones[0].enquiry_id === enquiry)
  // Simulate an independently retained closeout newer than the backup. Date
  // adjustment is fixture construction, not a new production backdating power.
  const expiredEnrollment = 'f4000000-0000-4000-8000-000000000002'
  sql(
    source,
    `update public.enrollments set status='completed',requested_at=now()-interval '15 months',approved_at=now()-interval '15 months',activated_at=now()-interval '15 months',ended_at=now()-interval '13 months' where id='${expiredEnrollment}';`,
  )
  const expiry = await must(
    source.admin
      .from('enrollments')
      .select('id,status,requested_at,approved_at,activated_at,ended_at')
      .eq('id', expiredEnrollment)
      .single(),
  )
  check(expiry.status === 'completed' && expiry.ended_at)
  check((await must(source.clients[2].rpc('list_student_work_archive'))).length === 0)
  // Newer access revocation is separate from the stale application capture.
  await must(
    source.admin
      .from('memberships')
      .update({ status: 'suspended' })
      .eq('person_id', 'f1000000-0000-4000-8000-000000000001'),
  )
  const revocations = await must(
    source.admin
      .from('memberships')
      .select('id,status')
      .eq('person_id', 'f1000000-0000-4000-8000-000000000001'),
  )
  check(revocations.length === 1 && revocations[0].status === 'suspended')
  await access(source, true)
  console.log('Restore rehearsal: captured DB and private bytes; newer revocation recorded')
  phase = 'destination startup'
  const target = await start('target', 56421)
  check(source.project !== target.project && source.port !== target.port)
  await identities(target)
  phase = 'application restore'
  verifyManifest(manifest, objects, version)
  const tables = sql(
    target,
    "select string_agg(format('%I.%I',schemaname,tablename),',') from pg_tables where schemaname='public'",
  )
  check(tables.length > 0)
  // Only a newly created disposable target: avoid triggers fabricating duplicate audit rows.
  check(digest(readFileSync(join(directory, 'application.sql'))) === dumpHash)
  // Cyclic FKs require a data load followed by explicit validation before commit.
  const restore = `begin;set local session_replication_role=replica;truncate ${tables};${dump}\nset local search_path=public,pg_catalog;set local session_replication_role=origin;${foreignKeys}`
  let rejectedDangling = false
  try {
    sql(
      target,
      `${restore}set local session_replication_role=replica;update public.auth_identities set auth_user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' where auth_user_id='f0000000-0000-4000-8000-000000000001';set local session_replication_role=origin;${foreignKeys}commit;`,
    )
  } catch (error) {
    rejectedDangling = /23503/.test(String(error.stderr))
  }
  check(rejectedDangling)
  let interrupted = false
  try {
    sql(target, `${restore}select pg_terminate_backend(pg_backend_pid());commit;`)
  } catch (error) {
    interrupted = /57P01/.test(String(error.stderr))
  }
  check(interrupted && sql(target, 'select count(*) from public.people') === '0')
  sql(target, `${restore}commit;`)
  for (const entry of manifest.entries) {
    await must(
      target.admin.storage
        .from(entry.bucket)
        .upload(entry.path, objects.get(`${entry.bucket}/${entry.path}`), {
          contentType: entry.mime,
        }),
    )
    const restored = Buffer.from(
      await (
        await must(target.admin.storage.from(entry.bucket).download(entry.path))
      ).arrayBuffer(),
    )
    check(restored.length === entry.size && digest(restored) === entry.sha256)
  }
  phase = 'newer revocation reconciliation'
  check(tombstones.length === 1)
  await must(target.admin.rpc('execute_approved_crm_erasure', { p_case_id: tombstones[0].case_id }))
  const erased = await must(
    target.admin
      .from('crm_enquiries')
      .select('privacy_state,interest_summary')
      .eq('id', enquiry)
      .single(),
  )
  check(erased.privacy_state === 'minimized' && erased.interest_summary === 'Erased CRM record')
  await must(
    target.admin
      .from('enrollments')
      .update({
        status: expiry.status,
        requested_at: expiry.requested_at,
        approved_at: expiry.approved_at,
        activated_at: expiry.activated_at,
        ended_at: expiry.ended_at,
      })
      .eq('id', expiry.id),
  )
  check((await must(target.clients[2].rpc('list_student_work_archive'))).length === 0)
  check(
    (
      await must(
        target.clients[2]
          .from('student_assignment_instances')
          .select('id')
          .eq('id', 'fb000000-0000-4000-8000-000000000002'),
      )
    ).length === 0,
  )
  check(revocations.length > 0)
  for (const record of revocations)
    await must(
      target.admin.from('memberships').update({ status: record.status }).eq('id', record.id),
    )
  await access(target, true)
  console.log(
    `Restore rehearsal: application data and ${manifest.entries.length} private object copies verified; scope and draft privacy checks passed`,
  )
  console.log(
    'Verified: newer erasure/revocation/expiry evidence, dangling-FK rejection, interrupted transaction rollback and retry. NOT EXERCISED: Edge-mediated lesson/brief download, full Auth recovery, off-site durability and production RPO/RTO. Launch remains blocked.',
  )
} catch (error) {
  failed = true
  console.error(`Restore rehearsal failed at ${phase}; raw output withheld.`)
  const constraint = String(error.stderr ?? '').match(/(?:constraint|column|relation) "([a-z_]+)"/)
  if (constraint) console.error(`Schema diagnostic: ${constraint[1]}`)
} finally {
  for (const side of sides.reverse()) {
    try {
      assertOwned(side.project, run)
      command(cli, ['stop', '--workdir', side.workdir, '--no-backup'])
      check(!command('docker', ['ps', '-a', '--format', '{{.Names}}']).includes(side.project))
      check(!command('docker', ['volume', 'ls', '--format', '{{.Name}}']).includes(side.project))
    } catch {
      failed = true
      cleanupFailed = true
      console.error(
        'Owned rehearsal cleanup incomplete; inspect disposable resources without broad deletion.',
      )
    }
  }
  // The directory was created by mkdtemp in this invocation, never supplied by a caller.
  if (!cleanupFailed) rmSync(directory, { recursive: true, force: true })
  else console.error(`Restricted diagnostic directory retained: ${directory}`)
  console.log(
    `Restore rehearsal elapsed ${Math.round((Date.now() - started) / 1000)} seconds; ${failed ? 'incomplete' : 'limited evidence only; cleanup verified'}.`,
  )
}
process.exitCode = failed ? 1 : 0
