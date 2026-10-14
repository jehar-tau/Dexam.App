import { execFileSync } from 'node:child_process'
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
// Exact disposable local markers; refuse to replace any existing fixture or job.
if (
  sql("select count(*) from public.people where id='10000000-0000-4000-8000-000000000001'") !==
    '0' ||
  sql("select count(*) from public.offerings where id='20000000-0000-4000-8000-000000000001'") !==
    '0' ||
  sql("select count(*) from cron.job where jobname='dexam-fictional-inapp-delivery'") !== '0'
)
  throw new Error('Existing markers/job present; local acceptance refused.')
const health = sql("select to_jsonb(h) from public.inapp_worker_health h where name='inapp'")
let configured = false
async function cleanup() {
  if (!configured) return
  const job = sql("select jobid from cron.job where jobname='dexam-fictional-inapp-delivery'")
  if (!/^\d+$/.test(job)) throw new Error('Own native job identity unavailable.')
  sql(`select cron.unschedule(${job});`)
  for (let n = 0; n < 7; n++) {
    if (
      sql(`select count(*) from cron.job_run_details where jobid=${job} and status='running'`) ===
      '0'
    )
      break
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
  if (
    sql(`select count(*) from cron.job_run_details where jobid=${job} and status='running'`) !== '0'
  )
    throw new Error('Own tick still running; cleanup refused.')
  sql(
    `begin;delete from cron.job_run_details where jobid=${job};delete from public.offerings where id='20000000-0000-4000-8000-000000000001' and title='Disposable native worker marker';delete from public.people where id='10000000-0000-4000-8000-000000000001' and display_name='Disposable native worker marker';update public.inapp_worker_health h set (attempted_at,completed_at,last_success_at,succeeded,processed_count,failed_count,error_sqlstate)=(select r.attempted_at,r.completed_at,r.last_success_at,r.succeeded,r.processed_count,r.failed_count,r.error_sqlstate from jsonb_populate_record(null::public.inapp_worker_health,$fixture$${health}$fixture$::jsonb) r) where name='inapp';commit;`,
  )
  console.log(
    'Own local job, disposable markers and own test logs removed; original health restored.',
  )
}
try {
  sql(
    "begin;insert into public.people(id,member_id,display_name) values('10000000-0000-4000-8000-000000000001','DXM-STG22STUDENT','Disposable native worker marker');insert into public.offerings(id,code,title,status) values('20000000-0000-4000-8000-000000000001','STAGING_FOUNDATION','Disposable native worker marker','active');select public.configure_fictional_inapp_job('ienwcencjbgdsqxfyxmj');commit;",
  )
  configured = true
  let succeeded = false
  for (let n = 0; n < 18; n++) {
    await new Promise((resolve) => setTimeout(resolve, 5000))
    if (
      sql(
        "select count(*) from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname='dexam-fictional-inapp-delivery' and d.status='succeeded' and d.end_time is not null",
      ) !== '0' &&
      sql("select succeeded from public.inapp_worker_health where name='inapp'") === 't'
    ) {
      succeeded = true
      break
    }
  }
  if (!succeeded) throw new Error('Native scheduled tick did not complete.')
  console.log(
    'Local real native scheduled tick and private health passed; no manual tick invocation.',
  )
} finally {
  await cleanup()
}
