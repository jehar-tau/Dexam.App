create type public.account_action_kind as enum ('activation', 'recovery');

alter table public.people
  drop constraint people_member_id_format,
  add constraint people_member_id_format check (
    member_id is null or member_id ~ '^DXM-[2-9A-HJKMNP-Z]{12}$'
  );

create or replace function public.prevent_member_id_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.member_id is distinct from new.member_id and old.member_id is not null then
    raise exception 'Dexam Member IDs are immutable' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger people_prevent_member_id_change
before update of member_id on public.people
for each row
execute function public.prevent_member_id_change();

create table public.account_action_tokens (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  kind public.account_action_kind not null,
  link_token_hash text not null,
  backup_code_hash text not null,
  expires_at timestamptz not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 8,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  created_by_person_id uuid references public.people (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint account_action_link_hash_format check (
    link_token_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint account_action_backup_hash_format check (
    backup_code_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint account_action_hashes_differ check (
    link_token_hash <> backup_code_hash
  ),
  constraint account_action_attempts_valid check (
    attempt_count >= 0 and max_attempts between 1 and 20 and attempt_count <= max_attempts
  ),
  constraint account_action_expiry_valid check (
    expires_at > created_at and expires_at <= created_at + interval '48 hours'
  ),
  constraint account_action_one_terminal_state check (
    consumed_at is null or invalidated_at is null
  ),
  constraint account_action_consumed_after_creation check (
    consumed_at is null or consumed_at >= created_at
  ),
  constraint account_action_invalidated_after_creation check (
    invalidated_at is null or invalidated_at >= created_at
  ),
  constraint account_action_link_hash_unique unique (link_token_hash),
  constraint account_action_backup_hash_unique unique (backup_code_hash)
);

create index account_action_tokens_person_idx
  on public.account_action_tokens (person_id, kind, created_at desc);

create unique index account_action_tokens_one_pending_per_kind
  on public.account_action_tokens (person_id, kind)
  where consumed_at is null and invalidated_at is null;

create table public.security_audit_events (
  id bigint generated always as identity primary key,
  subject_person_id uuid not null references public.people (id) on delete restrict,
  actor_person_id uuid references public.people (id) on delete restrict,
  event_type text not null,
  outcome text not null,
  reason_code text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint security_audit_event_type_format check (
    event_type ~ '^[a-z][a-z0-9_]{2,79}$'
  ),
  constraint security_audit_outcome_allowed check (
    outcome in ('succeeded', 'failed', 'denied', 'expired', 'invalidated')
  ),
  constraint security_audit_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index security_audit_events_subject_idx
  on public.security_audit_events (subject_person_id, occurred_at desc);

alter table public.account_action_tokens enable row level security;
alter table public.security_audit_events enable row level security;

revoke all on table public.account_action_tokens from anon, authenticated;
revoke all on table public.security_audit_events from anon, authenticated;
revoke all on sequence public.security_audit_events_id_seq from anon, authenticated;

grant select, insert, update on table public.account_action_tokens to service_role;
grant select, insert on table public.security_audit_events to service_role;
grant usage, select on sequence public.security_audit_events_id_seq to service_role;

comment on table public.account_action_tokens is
  'Server-only, single-use activation and recovery records. Hashes must be created with a server-held pepper; raw secrets must never be persisted.';
comment on column public.account_action_tokens.link_token_hash is
  'Lowercase SHA-256/HMAC-style digest produced by the trusted server; never the raw token.';
comment on table public.security_audit_events is
  'Append-only security event evidence. Metadata must exclude credentials, raw tokens, passwords, and unnecessary identity evidence.';

