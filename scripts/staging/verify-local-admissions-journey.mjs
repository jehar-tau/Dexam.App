// Composed LOCAL fictional Sales -> operator -> student acceptance. Never log credentials.
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { chromium, expect } from '@playwright/test'
let config
try {
  config = JSON.parse(
    execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  )
  if (!['127.0.0.1', 'localhost'].includes(new URL(config.API_URL).hostname))
    throw new Error('Local API required')
} catch {
  console.error('Local admissions configuration rejected; provider output withheld.')
  process.exit(1)
}
const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  },
  admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options),
  sales = createClient(config.API_URL, config.ANON_KEY, options),
  operator = createClient(config.API_URL, config.ANON_KEY, options),
  teacher = createClient(config.API_URL, config.ANON_KEY, options),
  student = createClient(config.API_URL, config.ANON_KEY, options),
  salesPerson = randomUUID(),
  operatorPerson = randomUUID(),
  teacherPerson = randomUUID(),
  offering = randomUUID(),
  cohort = randomUUID(),
  curriculum = randomUUID(),
  section = randomUUID(),
  topic = randomUUID(),
  lesson = randomUUID(),
  requestKey = randomUUID(),
  users = [],
  accountEmails = []
let enquiry,
  studentPerson,
  studentAuth,
  enrollment,
  frontend,
  browser,
  phase = 'disposable staff setup'
async function must(result) {
  if (result.error) throw new Error('Fictional operation rejected')
  return result.data
}
async function denied(result) {
  if (!result.error) throw new Error('Cross-role authority bypass')
}
function sql(query) {
  return execFileSync(
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
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim()
}
try {
  for (const [person, client, role] of [
    [salesPerson, sales, 'sales'],
    [operatorPerson, operator, 'ordinary_admin'],
    [teacherPerson, teacher, 'teacher'],
  ]) {
    const email = `admissions-${randomUUID()}@fixture.invalid`,
      password = randomBytes(32).toString('base64url')
    accountEmails.push(email)
    const created = await must(
      await admin.auth.admin.createUser({ email, password, email_confirm: true }),
    )
    users.push(created.user.id)
    await must(
      await admin
        .from('people')
        .insert({ id: person, display_name: 'Disposable admissions ' + role }),
    )
    await must(
      await admin
        .from('auth_identities')
        .insert({ person_id: person, auth_user_id: created.user.id, kind: 'employee_email' }),
    )
    await must(
      await admin
        .from('memberships')
        .insert({ person_id: person, kind: 'employee', status: 'active' }),
    )
    await must(
      await admin.from('role_assignments').insert({
        person_id: person,
        role_key: role,
        grant_reason: 'Disposable composed admissions acceptance',
      }),
    )
    await must(await client.auth.signInWithPassword({ email, password }))
  }
  await must(
    await admin.from('capability_grants').insert({
      person_id: operatorPerson,
      capability_key: 'enrollment.operate',
      required_role_key: 'ordinary_admin',
      grant_reason: 'Disposable operator acceptance only',
    }),
  )
  await must(
    await admin.from('offerings').insert({
      id: offering,
      code: 'PILOT_' + randomBytes(5).toString('hex').toUpperCase(),
      title: 'Disposable admissions foundation',
      status: 'active',
    }),
  )
  phase = 'actual scoped academic authoring and publication'
  await must(
    await admin.from('role_assignments').insert([
      {
        person_id: operatorPerson,
        role_key: 'ordinary_admin',
        scope_type: 'offering',
        scope_id: offering,
        grant_reason: 'Disposable content author scope',
      },
      {
        person_id: teacherPerson,
        role_key: 'teacher',
        scope_type: 'offering',
        scope_id: offering,
        grant_reason: 'Disposable review scope',
      },
    ]),
  )
  await must(
    await admin.from('capability_grants').insert([
      ...['content.manage_drafts', 'content.publish', 'assignment.distribute'].map(
        (capability_key) => ({
          person_id: operatorPerson,
          capability_key,
          required_role_key: 'ordinary_admin',
          scope_type: 'offering',
          scope_id: offering,
          grant_reason: 'Disposable academic scope only',
        }),
      ),
      {
        person_id: teacherPerson,
        capability_key: 'feedback.review',
        required_role_key: 'teacher',
        scope_type: 'offering',
        scope_id: offering,
        grant_reason: 'Disposable reviewer scope only',
      },
    ]),
  )
  await must(
    await operator.from('curriculum_versions').insert({
      id: curriculum,
      offering_id: offering,
      version_number: 1,
      title: 'Disposable pilot curriculum',
      created_by_person_id: operatorPerson,
    }),
  )
  await must(
    await operator.from('curriculum_sections').insert({
      id: section,
      curriculum_version_id: curriculum,
      code: 'DRAWING',
      title: 'Drawing',
      position: 1,
    }),
  )
  await must(
    await operator.from('curriculum_topics').insert({
      id: topic,
      section_id: section,
      code: 'PERSPECTIVE',
      title: 'Perspective',
      summary: 'Disposable topic explanation',
      position: 1,
    }),
  )
  await must(
    await operator.from('curriculum_lessons').insert({
      id: lesson,
      topic_id: topic,
      code: 'ONE_POINT',
      title: 'Disposable perspective lesson',
      body_markdown: 'Disposable authored lesson instructions.',
      position: 1,
    }),
  )
  await denied(
    await sales.rpc('publish_curriculum_version', {
      p_curriculum_version_id: curriculum,
      p_release_note: 'Unauthorized publication',
    }),
  )
  await must(
    await operator.rpc('publish_curriculum_version', {
      p_curriculum_version_id: curriculum,
      p_release_note: 'Deliberate fictional curriculum release',
    }),
  )
  // Initial offering/cohort provisioning is setup, not a new staff administration workflow.
  await must(
    await admin.from('cohorts').insert({
      id: cohort,
      offering_id: offering,
      code: 'PILOT_COHORT',
      name: 'Disposable pilot cohort',
      status: 'active',
      curriculum_version_id: curriculum,
    }),
  )
  const assignmentVersion = await must(
    await operator.rpc('create_assignment_draft', {
      p_offering_id: offering,
      p_topic_id: topic,
      p_code: 'PILOT_DRAWING',
      p_group_name: 'Drawing',
      p_title: 'Disposable pilot drawing task',
      p_instructions: 'Draw a fictional one-point room.',
      p_evaluation_rubric: 'Review perspective and line confidence.',
    }),
  )
  await must(
    await operator.rpc('publish_assignment_version', {
      p_assignment_version_id: assignmentVersion,
      p_release_note: 'Deliberate fictional assignment release',
    }),
  )
  phase = 'actual Sales intake and retry-safe creation'
  const args = {
    p_subject_name: 'Disposable admissions prospect',
    p_contact_name: 'Disposable admissions prospect',
    p_contact_relationship: 'self',
    p_contact_kind: 'email',
    p_contact_value: `prospect-${randomUUID()}@fixture.invalid`,
    p_interest_summary: 'Fictional design preparation',
    p_target_intake: 'Fictional intake',
    p_source: 'manual',
    p_request_key: requestKey,
  }
  const created = await must(await sales.rpc('create_crm_enquiry', args))
  enquiry = created[0]?.enquiry_id
  if (!enquiry || created[0].possible_identity_match)
    throw new Error('Unexpected intake identity result')
  if ((await must(await sales.rpc('create_crm_enquiry', args)))[0]?.enquiry_id !== enquiry)
    throw new Error('Intake duplicated on retry')
  const prospect = await must(
    await admin
      .from('crm_enquiries')
      .select('subject_person_id,owner_person_id')
      .eq('id', enquiry)
      .single(),
  )
  studentPerson = prospect.subject_person_id
  if (prospect.owner_person_id !== salesPerson) throw new Error('Wrong initial owner')
  await denied(await sales.rpc('list_enrolment_handoffs', { p_limit: 25, p_search: null }))
  for (const stage of ['contact_in_progress', 'engaged', 'qualified'])
    await must(
      await sales.rpc('update_crm_enquiry_stage', {
        p_enquiry_id: enquiry,
        p_to_stage: stage,
        p_reason_code: 'fictional_evidence',
        p_note: 'Disposable progression evidence',
      }),
    )
  const request = await must(
    await sales.rpc('request_crm_enrolment_review', {
      p_enquiry_id: enquiry,
      p_request_note: 'Fictional identity and intended course checked',
    }),
  )
  phase = 'operator identity review and approval'
  const inbox = await must(
    await operator.rpc('list_enrolment_handoffs', {
      p_limit: 25,
      p_search: 'Disposable admissions prospect',
    }),
  )
  if (!inbox.some((row) => row.request_id === request)) throw new Error('Handoff missing')
  const candidates = await must(
    await operator.rpc('list_enrolment_identity_candidates', { p_request_id: request }),
  )
  if (candidates.length) throw new Error('Unexpected identity candidates')
  const approvalArgs = {
    p_request_id: request,
    p_resolution_mode: 'new',
    p_existing_person_id: null,
    p_offering_id: offering,
    p_cohort_id: cohort,
    p_reason: 'Disposable identity and offering verified',
    p_candidate_ids: [],
    p_candidate_decisions: [],
  }
  await denied(await sales.rpc('approve_crm_enrolment_review', approvalArgs))
  const approval = (await must(await operator.rpc('approve_crm_enrolment_review', approvalArgs)))[0]
  enrollment = approval.enrollment_id
  const member = approval.member_id
  if (
    !enrollment ||
    approval.person_id !== studentPerson ||
    !member ||
    approval.enrollment_status !== 'approved'
  )
    throw new Error('Wrong approved identity/enrolment')
  await denied(await operator.rpc('approve_crm_enrolment_review', approvalArgs))
  await denied(
    await sales.functions.invoke('staff-issue-activation', {
      body: { enrollmentId: enrollment, reasonCode: 'initial_activation_pack' },
    }),
  )
  phase = 'operator private one-time pack'
  const pack = await must(
    await operator.functions.invoke('staff-issue-activation', {
      body: { enrollmentId: enrollment, reasonCode: 'initial_activation_pack' },
    }),
  )
  const callback = new URL(pack.activationUrl)
  if (
    callback.origin !== 'http://127.0.0.1:5173' ||
    callback.pathname !== '/activate' ||
    callback.search
  )
    throw new Error('Unsafe callback')
  frontend = spawn(
    'pnpm',
    ['exec', 'vite', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    {
      env: {
        ...process.env,
        VITE_SUPABASE_URL: config.API_URL,
        VITE_SUPABASE_ANON_KEY: config.ANON_KEY,
        VITE_ENABLE_OPERATOR_PREVIEW: 'false',
        VITE_ENABLE_STUDENT_PREVIEW: 'false',
      },
      stdio: 'ignore',
      detached: true,
    },
  )
  let ready = false
  for (let n = 0; n < 50; n++) {
    if (frontend.exitCode !== null) throw new Error('Own frontend startup failed')
    try {
      ready = (await fetch('http://127.0.0.1:5173')).ok
    } catch {
      /* Starting. */
    }
    if (ready) break
    await new Promise((r) => setTimeout(r, 100))
  }
  if (!ready) throw new Error('Own frontend unavailable')
  phase = 'actual browser activation and Member ID sign-in'
  browser = await chromium.launch()
  const page = await browser.newPage(),
    password = randomBytes(32).toString('base64url')
  await page.goto(callback.toString())
  await page.getByText('One-time activation link loaded securely', { exact: false }).waitFor()
  if (new URL(page.url()).hash || new URL(page.url()).search)
    throw new Error('Credential URL retained')
  await page.getByLabel('Create password').fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: 'Activate account', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Your Dexam account is ready.' }).waitFor()
  await page.goto('http://127.0.0.1:5173/student')
  await page.getByLabel('Dexam Member ID').fill(member)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText(member, { exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Disposable admissions foundation' }),
  ).toBeVisible()
  phase = 'deliberate distribution, student upload and independent teacher publication'
  await expect(page.getByRole('link', { name: 'Coursework', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Work archive', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'CRM', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Staff security', exact: true })).toHaveCount(0)
  await page.goto('http://127.0.0.1:5173/student/coursework')
  await expect(
    page.getByText('Disposable authored lesson instructions.', { exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: 'test-results/f025-composed/coursework-desktop.png',
    fullPage: true,
  })
  const releaseArgs = {
    p_assignment_version_id: assignmentVersion,
    p_cohort_id: null,
    p_enrollment_ids: [enrollment],
    p_due_at: null,
    p_release_note: 'Deliberate selected fictional release',
    p_request_key: randomUUID(),
  }
  await denied(await sales.rpc('distribute_assignment_version', releaseArgs))
  phase = 'actual staff distribution form to the activated student'
  const distributionContext = await browser.newContext()
  await distributionContext.addInitScript(
    ({ session, key }) => localStorage.setItem(key, JSON.stringify(session)),
    {
      session: (await operator.auth.getSession()).data.session,
      key: 'sb-' + new URL(config.API_URL).hostname.split('.')[0] + '-auth-token',
    },
  )
  const distributionPage = await distributionContext.newPage()
  await distributionPage.goto('http://127.0.0.1:5173/staff/assignments')
  await expect(
    distributionPage.getByRole('heading', { name: 'Assignment distribution.' }),
  ).toBeVisible()
  await distributionPage.getByLabel('Programme', { exact: true }).selectOption(offering)
  await distributionPage
    .getByLabel('Published assignment', { exact: true })
    .selectOption(assignmentVersion)
  await distributionPage.getByRole('radio', { name: 'Selected students', exact: true }).check()
  await distributionPage.getByRole('checkbox', { name: new RegExp(member) }).check()
  await distributionPage
    .getByLabel('Release note', { exact: true })
    .fill(releaseArgs.p_release_note)
  await distributionPage.getByRole('button', { name: 'Release assignment', exact: true }).click()
  await expect(
    distributionPage.getByText('Assignment released to 1 selected students.', { exact: true }),
  ).toBeVisible()
  // Read only this disposable actor/version to verify the form's persisted request and retry it.
  const persistedRelease = await must(
    await admin
      .from('assignment_releases')
      .select('id,request_key')
      .eq('released_by_person_id', operatorPerson)
      .eq('assignment_version_id', assignmentVersion)
      .single(),
  )
  const release = persistedRelease.id
  releaseArgs.p_request_key = persistedRelease.request_key
  if ((await must(await operator.rpc('distribute_assignment_version', releaseArgs))) !== release)
    throw new Error('Assignment retry duplicated release')
  await distributionContext.close()
  phase = 'student upload and independent teacher publication'
  await must(
    await student.auth.signInWithPassword({
      email: member.toLowerCase() + '@members.dexam.invalid',
      password,
    }),
  )
  const instances = await must(
    await student.from('student_assignment_instances').select('id').eq('enrollment_id', enrollment),
  )
  if (instances.length !== 1) throw new Error('Wrong student assignment snapshot')
  const attempt = await must(
      await student.rpc('start_assignment_attempt', { p_assignment_instance_id: instances[0].id }),
    ),
    bytes = new TextEncoder().encode('%PDF-1.4\nDisposable pilot drawing\n'),
    form = new FormData()
  form.set('attemptId', attempt)
  form.set('originalFileName', 'fictional.pdf')
  form.set('originalByteSize', String(bytes.length))
  form.set('wasCompressed', 'false')
  form.set('file', new File([bytes], 'fictional.pdf', { type: 'application/pdf' }))
  await must(await student.functions.invoke('student-submission-file', { body: form }))
  await must(await student.rpc('finalize_submission_attempt', { p_submission_attempt_id: attempt }))
  await denied(await sales.rpc('start_feedback_draft', { p_submission_attempt_id: attempt }))
  const reviews = await must(await teacher.rpc('list_feedback_review_queue'))
  if (!reviews.some((row) => row.submission_attempt_id === attempt))
    throw new Error('Submitted work missing for assigned teacher')
  const revision = await must(
    await teacher.rpc('start_feedback_draft', { p_submission_attempt_id: attempt }),
  )
  await must(
    await teacher.rpc('save_feedback_draft', {
      p_feedback_revision_id: revision,
      p_written_text: 'Your fictional perspective is clear. Keep the lines consistent.',
      p_source_kind: 'human',
      p_voice_equivalent_confirmed: false,
    }),
  )
  await must(
    await teacher.rpc('publish_feedback_revision', {
      p_feedback_revision_id: revision,
      p_outcome: 'review_completed',
      p_correction_reason: null,
    }),
  )
  await page.goto('http://127.0.0.1:5173/student/assignments')
  await expect(page.getByRole('heading', { name: 'Disposable pilot drawing task' })).toBeVisible()
  await expect(
    page.getByText('Your fictional perspective is clear. Keep the lines consistent.', {
      exact: true,
    }),
  ).toBeVisible()
  await page.screenshot({ path: 'test-results/f025-composed/feedback-desktop.png', fullPage: true })
  const linked = await must(
    await admin
      .from('auth_identities')
      .select('auth_user_id')
      .eq('person_id', studentPerson)
      .single(),
  )
  studentAuth = linked.auth_user_id
  const enrolments = await must(
    await admin.from('enrollments').select('id,person_id,status').eq('offering_id', offering),
  )
  if (
    enrolments.length !== 1 ||
    enrolments[0].person_id !== studentPerson ||
    enrolments[0].status !== 'active'
  )
    throw new Error('Canonical enrolment/identity drift')
  await page.setViewportSize({ width: 390, height: 844 })
  if (!(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)))
    throw new Error('Student mobile overflow')
  await page.screenshot({ path: 'test-results/f025-composed/feedback-mobile.png', fullPage: true })
  phase = 'actual authorized staff navigation and revocation'
  for (const [client, visible, hidden] of [
    [sales, 'CRM', 'Distribution'],
    [operator, 'Distribution', 'Classes'],
    [teacher, 'Reviews', 'Content'],
  ]) {
    const context = await browser.newContext()
    const session = (await client.auth.getSession()).data.session
    await context.addInitScript(
      ({ session, key }) => localStorage.setItem(key, JSON.stringify(session)),
      { session, key: 'sb-' + new URL(config.API_URL).hostname.split('.')[0] + '-auth-token' },
    )
    const staffPage = await context.newPage()
    await staffPage.goto('http://127.0.0.1:5173/health')
    await expect(staffPage.getByRole('link', { name: visible, exact: true })).toBeVisible()
    await expect(staffPage.getByRole('link', { name: hidden, exact: true })).toHaveCount(0)
    await expect(staffPage.getByRole('link', { name: 'Staff security', exact: true })).toBeVisible()
    await expect(
      staffPage.getByRole('link', { name: 'Curriculum preview', exact: true }),
    ).toHaveCount(0)
    if (client === teacher) {
      await staffPage.getByRole('link', { name: 'Reviews', exact: true }).click()
      await expect(staffPage.getByRole('heading', { name: 'Feedback review.' })).toBeVisible()
      await must(
        await admin
          .from('capability_grants')
          .delete()
          .eq('person_id', teacherPerson)
          .eq('capability_key', 'feedback.review'),
      )
      await expect(staffPage.getByRole('link', { name: 'Reviews', exact: true })).toHaveCount(0, {
        timeout: 40_000,
      })
      await expect(
        staffPage.getByRole('link', { name: 'Staff security', exact: true }),
      ).toBeVisible()
      await expect(
        staffPage.getByRole('heading', { name: 'You do not have access to this workspace.' }),
      ).toBeVisible({ timeout: 40_000 })
    } else {
      await staffPage.goto('http://127.0.0.1:5173/staff/assignments')
      await expect(
        staffPage.getByRole('heading', {
          name:
            client === operator
              ? 'Assignment distribution.'
              : 'You do not have access to this workspace.',
        }),
      ).toBeVisible()
    }
    await context.close()
  }
  console.log(
    'F025 composed actual pilot passed: scoped author/publication, retry-safe Sales intake, operator identity/activation, deliberate assignment distribution, student upload/finalize, independent teacher publication and browser coursework/feedback. Cross-role denials, identity invariance and responsive UI passed; no preview bypass.',
  )
} catch {
  console.error('F025 admissions acceptance failed during', phase)
  process.exitCode = 1
} finally {
  await cleanup()
}

async function cleanup() {
  let cleanupFailed = false
  try {
    await browser?.close()
  } catch {
    cleanupFailed = true
  }
  if (frontend?.pid) {
    try {
      process.kill(-frontend.pid, 'SIGTERM')
    } catch {
      /* Own process ended. */
    }
  }
  try {
    // Recover only this run's exact request-key subject if creation committed before a lost response.
    const own = await must(
      await admin
        .from('crm_enquiries')
        .select('id,subject_person_id,owner_person_id')
        .eq('request_key', requestKey)
        .maybeSingle(),
    )
    if (own) {
      if (own.owner_person_id !== salesPerson) throw new Error('Cleanup scope changed')
      enquiry = own.id
      studentPerson = own.subject_person_id
    }
    if (studentPerson) {
      const linked = await must(
        await admin
          .from('auth_identities')
          .select('auth_user_id')
          .eq('person_id', studentPerson)
          .maybeSingle(),
      )
      studentAuth ??= linked?.auth_user_id
      const ownPerson = await must(
        await admin.from('people').select('member_id').eq('id', studentPerson).maybeSingle(),
      )
      if (ownPerson?.member_id)
        accountEmails.push(ownPerson.member_id.toLowerCase() + '@members.dexam.invalid')
    }
    // Reconcile only exact fictional addresses allocated by this run, including lost responses.
    if (accountEmails.some((email) => !/^[a-z0-9@._+-]+$/i.test(email)))
      throw new Error('Invalid own email marker')
    if (accountEmails.length) {
      const recovered = sql(
        `select id from auth.users where email in ('${accountEmails.join("','")}');`,
      )
        .split('\n')
        .filter(Boolean)
      if (recovered.some((id) => !/^[a-f0-9-]{36}$/.test(id)))
        throw new Error('Invalid own Auth marker')
      for (const id of recovered) if (!users.includes(id)) users.push(id)
    }
    const people = `('${[salesPerson, operatorPerson, teacherPerson, studentPerson].filter(Boolean).join("','")}')`,
      enq = enquiry ? `'${enquiry}'` : 'null'
    const instances = `select id from public.student_assignment_instances where enrollment_id in (select id from public.enrollments where offering_id='${offering}')`,
      attempts = `select id from public.submission_attempts where assignment_instance_id in (${instances})`,
      definitions = `select id from public.assignment_definitions where offering_id='${offering}'`,
      versions = `select id from public.assignment_versions where assignment_definition_id in (${definitions})`
    const paths = JSON.parse(
      sql(
        `select coalesce(jsonb_agg(object_path),'[]') from public.submission_files where submission_attempt_id in (${attempts});`,
      ),
    )
    if (paths.length) await must(await admin.storage.from('student-submissions').remove(paths))
    const statements = [
      ['notifications', `crm_enquiry_id=${enq} or recipient_person_id in ${people}`],
      ['domain_events', `aggregate_id=${enq} or actor_person_id in ${people}`],
      ['feedback_revisions', `submission_attempt_id in (${attempts})`],
      ['submission_files', `submission_attempt_id in (${attempts})`],
      ['submission_attempts', `assignment_instance_id in (${instances})`],
      ['student_assignment_transitions', `assignment_instance_id in (${instances})`],
      ['student_assignment_instances', `id in (${instances})`],
      ['assignment_releases', `offering_id='${offering}'`],
      ['assignment_topic_links', `assignment_version_id in (${versions})`],
      ['assignment_versions', `assignment_definition_id in (${definitions})`],
      ['assignment_definitions', `offering_id='${offering}'`],
      ['crm_enrolment_review_requests', `enquiry_id=${enq}`],
      ['account_action_tokens', `person_id in ${people}`],
      ['security_audit_events', `subject_person_id in ${people} or actor_person_id in ${people}`],
      [
        'enrollment_transitions',
        `enrollment_id in (select id from public.enrollments where offering_id='${offering}')`,
      ],
      ['enrollments', `offering_id='${offering}'`],
      ['cohorts', `offering_id='${offering}'`],
      [
        'curriculum_lessons',
        `topic_id in (select id from public.curriculum_topics where section_id in (select id from public.curriculum_sections where curriculum_version_id='${curriculum}'))`,
      ],
      [
        'curriculum_topics',
        `section_id in (select id from public.curriculum_sections where curriculum_version_id='${curriculum}')`,
      ],
      ['curriculum_sections', `curriculum_version_id='${curriculum}'`],
      ['curriculum_versions', `offering_id='${offering}'`],
      ...[
        'crm_identity_candidates',
        'crm_enquiry_ownership_history',
        'crm_enquiry_transitions',
        'crm_activities',
        'crm_follow_ups',
      ].map((table) => [table, `enquiry_id=${enq}`]),
      ['crm_enquiries', `id=${enq}`],
      ['crm_person_relationships', `subject_person_id in ${people}`],
      ['crm_contact_points', `person_id in ${people}`],
      ...['capability_grants', 'role_assignments', 'memberships', 'auth_identities'].map(
        (table) => [table, `person_id in ${people}`],
      ),
      ['people', `id in ${people}`],
      ['offerings', `id='${offering}'`],
    ]
    // Local exact-fixture cleanup only. Preserve FK/RLS and restore every original USER trigger flag.
    sql(
      `begin;create temporary table own_trigger_flags on commit drop as select c.relname,t.tgname,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal and c.relname in ('${statements.map(([table]) => table).join("','")}');do $$declare r record;begin for r in select * from own_trigger_flags loop execute format('alter table public.%I disable trigger %I',r.relname,r.tgname);end loop;end$$;${statements.map(([table, where]) => `delete from public.${table} where ${where};`).join('')}do $$declare r record;begin for r in select * from own_trigger_flags where tgenabled<>'D' loop execute format('alter table public.%I enable %s trigger %I',r.relname,case r.tgenabled when 'A' then 'always' when 'R' then 'replica' else '' end,r.tgname);end loop;end$$;commit;`,
    )
    for (const id of [...new Set([...users, studentAuth].filter(Boolean))])
      await must(await admin.auth.admin.deleteUser(id))
    if (cleanupFailed) throw new Error('Browser cleanup failed')
    console.log(
      'F025 exact admissions fixtures/accounts/audit/events removed; original trigger flags restored. No external email sent.',
    )
  } catch {
    console.error('F025 exact admissions cleanup requires inspection')
    process.exitCode = 1
  }
}
