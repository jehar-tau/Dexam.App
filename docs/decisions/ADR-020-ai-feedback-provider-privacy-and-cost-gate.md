# ADR-020 — Transcription and AI Feedback Provider, Privacy, and Cost Gate

Status: Option B approved 2026-10-10
Date: 2026-10-10
Decision ID: D-020
Risk: Red — teacher audio, private student work, AI-assisted writing/evaluation, external processing, and variable cost

## Question

How much of the speech transcription, AI proofreading, and AI-assisted evaluation workflow should Dexam build now, and when may teacher audio, feedback writing, or student submissions be sent to an external provider?

## Why this needs your decision

D-014 permits AI to prepare rubric-grounded drafts only when a teacher manually starts a bounded batch and approves every student-visible result. The product owner also requires speech-to-text dictation and optional AI proofreading so teachers can prepare writing more quickly. These three capabilities process different data and may have different pricing: audio minutes for transcription, text tokens for proofreading, and text/image input for rubric-grounded evaluation. No earlier decision chose a vendor or authorized spending. A provider choice can change price, supported files, data region, retention, training terms, reliability, and privacy obligations. Building directly against one vendor now could create cost and lock-in before Dexam has measured real teacher value.

## Options

### A — Defer transcription and the entire AI workflow

Build only typed writing and playable human voice notes. Do not create speech-to-text, AI proofreading, AI batch records, queues, draft states, or interfaces yet.

- **Impact:** Fastest route to reliable human feedback, but does not satisfy the required dictation/proofreading workflows and makes later AI work a larger separate build.
- **Cost:** No AI usage or orchestration cost now.
- **Risk:** Lowest immediate privacy risk; highest risk of postponing the desired efficiency feature indefinitely.
- **Reversibility:** High.

### B — Build provider-neutral transcription and AI workflows; activate vendors later (recommended)

Build three provider-neutral services and their review interfaces now:

1. **Speech-to-text dictation:** the teacher explicitly records a short dictation, receives editable draft text, and accepts, changes, retries, or discards it. Dictation audio is temporary and is purged after acceptance/discard, with a maximum 24-hour cleanup window, unless the teacher separately chooses to retain it as a normal voice note.
2. **AI proofreading:** after typing or dictating, the teacher manually selects **Proofread**. The service may correct spelling, grammar, punctuation, and clarity, but must not invent observations, scores, evidence, or student facts. Show the original and suggestion as a comparison; preserve the original and require the teacher to accept, edit, or reject the suggestion.
3. **Rubric-grounded draft assistance:** a teacher manually selects one assignment and at most 25 submitted attempts, confirms the pinned rubric, creates an asynchronous batch, and receives one independent draft/failure result per submission.

Development and automated tests use deterministic fictional fixtures only. Production transcription and inference remain disabled and the authorized monthly external-processing spend remains **₹0** until a later provider-activation decision is approved.

Each capability has a replaceable provider boundary so transcription, proofreading, and evaluation may use different approved providers without changing feedback records. Before real audio, writing, or student work leaves Dexam, a later activation record must name the provider and model/configuration, authorized capability, supported input types, processing region, training-use policy, provider retention/deletion behavior, data-processing terms, per-minute/per-token pricing, request limits, monthly rupee ceiling, alert/stop thresholds, and an emergency kill switch. Rubric-grounded evaluation must first run in shadow mode against teacher-authored feedback. Transcription and proofreading must first be checked by staff using fictional or expressly approved test content.

When services are eventually activated, send only what that action requires: dictation audio for transcription; the teacher's current written draft for proofreading; or selected submission content, the exact immutable rubric version, and minimum assignment context for evaluation. Treat student content as untrusted data that cannot override system policy or the rubric. Do not request or store hidden reasoning. Preserve original teacher writing and store the output, evidence references where applicable, safety/failure state, provider/model identifier, usage estimate, timestamps, human edits, rejection reason when supplied, approver, and publication event. A failure never destroys the teacher's recording or writing. Retry only failed items and never silently reprocess a whole batch.

Every transcript, proofreading suggestion, or AI-generated result remains a private draft until a currently authorized teacher reviews it. Accepted AI-transformed text is marked in the audit trail. Published feedback containing AI-transformed or AI-generated writing shows the student a plain disclosure: **“Prepared with AI assistance and reviewed by [teacher name].”** The disclosure cannot be removed from an AI-assisted revision. AI may not assign grades, make admissions or disciplinary decisions, infer emotion or ability, or publish automatically.

- **Impact:** Delivers the complete dictation, proofreading, and teacher-review experience in a testable form now while postponing the irreversible vendor and spending decision until there is evidence.
- **Cost:** No external transcription or AI fee while disabled. The adapters, queues, audit model, and interfaces add engineering work, but prevent expensive provider lock-in. No paid service is authorized.
- **Risk:** Controls external-data and cost exposure; the remaining implementation must ensure fictional fixtures cannot accidentally call a provider.
- **Reversibility:** Highest practical reversibility because the provider adapter and activation policy are replaceable.

### C — Select and enable transcription and AI providers immediately

Choose provider configurations now, connect real teacher audio, written feedback, and student submissions in the first F007 release, and set an initial operating budget.

- **Impact:** Delivers live dictation, proofreading, and AI drafts sooner and produces real usage data.
- **Cost:** Introduces variable per-audio-minute and per-token processing cost and requires operational monitoring from launch.
- **Risk:** Highest near-term privacy, contractual, quality, and lock-in exposure before shadow evaluation.
- **Reversibility:** Moderate; the adapter can change, but already-transmitted data and incurred cost cannot be undone.

## Recommendation

Approve Option B. It honours the free-first requirement, preserves the required dictation/proofreading and desired bulk-review architecture, and separates safe engineering work from the later decision that transmits private teacher/student data or spends money.

## What approval authorizes

Option B would authorize local/provider-neutral transcription, proofreading, and evaluation schemas/adapters; deterministic fake workers; dictation and comparison interfaces; bounded batch and per-result states; teacher review/disclosure interfaces; audit evidence; failure handling; and automated tests. It would not authorize an external provider, production transcription/inference, paid usage, real teacher or student-data transmission, automated publication, or a production deployment.

## Approval

The product owner approved Option B on 2026-10-10. Dexam may build provider-neutral speech-to-text, AI proofreading, and bounded rubric-grounded draft workflows with deterministic fictional adapters. Production external processing remains disabled, the authorized monthly spend remains ₹0, and a later provider-activation decision is required before transmitting real teacher or student data or incurring usage charges.
