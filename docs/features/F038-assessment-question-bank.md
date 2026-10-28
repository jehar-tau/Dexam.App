# F038 — Assessment question bank

Status: Implemented locally 2026-10-28 (redesign step 3, D-057) under D-053 B, D-054 A and D-055 A (Admin only, MFA for import and answer keys); in review. The real workstation bank (4,183 questions, 695 ready) is loaded into the local database only. No staging or production import, and no real content in this repository.

## Implementation (step 3)

- **Migration** `20261028010000_assessment_question_bank.sql`: the seven `assessment_*` tables, the private `assessment-media` bucket, both capabilities on `elevated_admin` (import requires MFA), staff-read policies, and no browser grant on `assessment_question_keys`.
- **Candidate view** (part of F042): `get_assessment_student_paper(paper_id)` returns a paper's ready objective questions in paper order (prompt, options, figure paths) for an active student, and `list_assessment_student_papers()` returns ready and objective counts per paper. Neither returns keys, key status, quarantine reasons, licences, external keys or provenance. A storage policy lets an active student read only figure and option images of ready questions; the browser opens them with short-lived signed links.
- **Importer**: `pnpm assessment:import` (`scripts/assessment/`): Zod export validation, the answer normaliser, a pure import planner and the CLI. Media is checked (inside the media root, no symlinks, at most 5 MB, SHA-256 match, PNG/JPEG/WebP by magic bytes) and stored content-addressed (`<sha[0:2]>/<sha>.<ext>`). Each question is written atomically by the service-role-only `assessment_import_question()`. Limited to a local stack until staging import is approved.
- **Workstation exporter**: `tools/export_platform_bank.py` in the content workstation writes the v1 export, carrying its own blockers as `holds`.

## Purpose and problem

Every later test-series slice (generation, exam interface, scoring, practice, results) needs one durable, versioned question bank in Postgres. Today the questions live outside this repository, in the content workstation's SQLite file.

The bank must meet four conditions:

- **No answer leaks:** students never receive answer keys before their result is released, so keys sit in a server-only table.
- **Provenance:** every question keeps its source paper, page, extraction method, answer-key source, licence and review state.
- **Safe imports:** imports are repeatable and idempotent, and they quarantine anything uncertain instead of publishing it.
- **Stable versions:** question versions never change underneath a submitted attempt.

## Users

- **Administrators and content staff:** import exports and inspect the bank, quarantine queue and provenance.
- **Students:** no direct access in F038. Questions reach students only through attempt-scoped operations added in F042/F047.

## User flow

1. The content workstation produces `dexam-bank-export.json` (schema v1, below) and a media folder.
2. An administrator runs `pnpm assessment:import --file <export> --media <dir> --dry-run` locally or against staging, then reads the report: new, unchanged, new versions, quarantined (with reasons) and missing media.
3. The administrator re-runs without `--dry-run`.
   - Media is uploaded to the private `assessment-media` bucket, checked by SHA-256.
   - Questions are matched by `external_key` and content hash. Uniqueness is `(external_key, version)`; at most one non-retired version per `external_key`.
   - An import run is recorded.
4. Staff can browse ready and quarantined questions with provenance (read-only in F038; editing stays in the workstation).

## In scope

- **Tables**, all prefixed `assessment_`:
  - `topics`: a topic and subtopic tree with a stable slug.
  - `questions`: `external_key`, `version`, `content_hash`, `question_type` (`nat`, `msq`, `mcq`, `descriptive`), `prompt`, `topic_id`, `subtopic_id`, `difficulty` (`easy`, `medium`, `hard`, `unassessed`), `estimated_seconds`, `visual_dependency`, `response_mode` (`auto`, `upload`), `publication_state` (`quarantined`, `ready`, `retired`), `quarantine_reasons`, `licence`, `source_kind` (`official`, `owner_authorized`, `original`), timestamps.
  - `question_options`: option key `A`–`F` (numeric keys `1`–`6` map to `A`–`F` in order), body, optional asset, position.
  - `question_assets`: role (`figure`, `option`, `source_page`), private storage path, SHA-256, width, height, MIME type, order.
  - `question_keys`, **server-only**: normalised answer (see business rules), `answer_status`, `explanation` (stored only when verified), `explanation_status`.
  - `question_provenance`, **staff-only**: source exam, year, paper ID, question number, page, source PDF SHA-256, extraction method, OCR flag, answer-key source, verification state and verifier, and a correction history.
  - `import_runs`: export digest, counts, report, actor, start and finish times.
- **Storage:** a private bucket `assessment-media` limited to PNG, JPEG and WebP, ≤ 5 MB each. No SVG until a sanitising pipeline is approved.
- **Import tooling:** an import command with schema validation (Zod), a dry-run mode, idempotency and quarantine.
- **Answer parsing:** a normaliser for official key strings, with golden tests.
- **Tests:** pgTAP tests for row-level security and grants.

## Out of scope

- Serving questions to students: F042 and F047.
- Generation and blueprints: F040.
- Scoring: F044.
- Editing questions in the platform: the workstation stays the editor in R1.
- SVG assets.
- Production import.

## Permissions

Proposed, pending decision:

| Capability               | Allows                                                             | MFA | Granted to |
| ------------------------ | ------------------------------------------------------------------ | --- | ---------- |
| `assessment.bank.read`   | Read questions, options, assets, quarantine reasons and provenance | No  | Admin role |
| `assessment.bank.import` | Run imports and read answer keys                                   | Yes | Admin role |

Students and anonymous users get no grants on any `assessment_*` table. The import command uses the service role only from a local or staging operator environment, never from the browser.

## Business rules

- **Identity and versioning:** `external_key` is the workstation's question ID, such as `ceed-2024-q12`. If the same key arrives with the same `content_hash`, nothing changes. A changed hash creates `version + 1` and moves the previous version to `retired`. Retired versions stay readable for attempts that reference them.
- **Ready versus quarantined.** A question is `ready` only when all of the following hold; otherwise it is `quarantined` with every failing reason listed:
  - It has a prompt, or an approved figure plus a prompt.
  - MCQ and MSQ questions have options (2–6).
  - Objective types have a parsable key whose status is `official-key`, `matched-source` or `matched-source-positional`, or `independently-solved` with a recorded blind second-pass verification. The export carries `answer.verification` (`second-pass-reproduced`), and without it an independently solved key is quarantined.
  - Every referenced media file exists and matches its SHA-256.
  - The candidate-facing text contains no source labels (exam name with year, page headers, roll or booklet codes).
  - `licence` is set.
- **Answer normalisation:**
  - MCQ `B` → `{kind: choice, correct: [B]}`.
  - MSQ `A,C` → `{kind: multi, correct: [A,C]}`.
  - MSQ `B OR B, C` → `{kind: multi, alternatives: [[B],[B,C]]}`.
  - NAT `7 OR 9` → `{kind: numeric, accepted: [{exact:7},{exact:9}]}`.
  - NAT `94.2 (92.9 - 94.6)` and the unspaced `2.25 (2.24-2.26)` → `{kind: numeric, accepted: [{range:[92.9,94.6]}]}` (whitespace and dash style, `-` or `–`, are ignored).
  - `DROPPED` → `{kind: dropped}`.
  - `FULL MARKS` → `{kind: full_marks}`.
  - Anything else → quarantine with reason `unparsed-key`.
- **Licence is carried per question** so paid products can exclude non-original content (D-054 decision 2).
- **Descriptive questions** import with response mode `upload`. A rubric is optional until F048.

## Export contract (schema v1)

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-10-28T00:00:00Z",
  "questions": [
    {
      "externalKey": "ceed-2024-q12",
      "type": "MSQ",
      "prompt": "Which option(s) is/are NOT a part of the image on the left?",
      "options": [{ "key": "A", "text": "…", "asset": null }],
      "assets": [
        { "role": "figure", "path": "ceed-2024/questions/ceed-2024-q12.png", "sha256": "…" }
      ],
      "answer": { "raw": "B OR B, C", "status": "official-key" },
      "explanation": null,
      "topic": "spatial-reasoning",
      "subtopic": null,
      "difficulty": "unassessed",
      "estimatedSeconds": null,
      "visualDependency": true,
      "licence": "official-unlicensed",
      "sourceKind": "official",
      "provenance": {
        "exam": "ceed",
        "year": 2024,
        "paperId": "ceed-2024",
        "questionNo": "12",
        "page": 9,
        "sourceSha256": "…",
        "extraction": "pdf-text",
        "answerKeySource": "CEED_2024_Answer_Key.pdf",
        "verification": "review"
      }
    }
  ]
}
```

The workstation owns producing this file. The platform validates it and rejects unknown `schemaVersion` values.

Optional fields added in step 3, all backwards compatible with v1:

- `assets[].width`, `assets[].height`, and `assets[].review` (`approved`, `pending` or `rejected`): the workstation crop review. A figure or option image must be `approved` to be served (`figure-not-approved` otherwise).
- `holds`: the workstation's own reasons a question cannot be served yet (for example `visual-crop-awaiting-review`, `structured-options-missing`). Every hold becomes a quarantine reason.
- `answer.verification`: `second-pass-reproduced` is required before an `independently-solved` key counts.

Further quarantine reasons the importer adds: `prompt-missing`, `options-missing`, `options-invalid`, `answer-key-missing`, `answer-key-unverified`, `unparsed-key`, `key-option-mismatch`, `media-missing`, `media-mismatch`, `media-too-large`, `media-type`, `figure-not-approved` and `source-label`.

MCQ keys with alternatives (`A or B`) normalise to `{kind: choice, correct: [A, B]}`: any listed option is accepted. Keys that say marks are awarded to all (`DROPPED (+3 marks awarded to all)`) normalise to `full_marks`. NAT ranges also accept `~` and `to` as separators.

## Interface states

F038 adds no student interface. The import report shows the counts and per-question reasons as a CLI table and as JSON. A staff read-only bank view is optional in F038; if it is built, it needs loading, empty, error and permission-denied states, plus a Storybook story.

## Data and privacy

- No personal data.
- Content is copyrighted official material, so the bucket is private and is never served through public URLs; signed URLs come later, scoped to an attempt.
- **Fixtures are fictional.** Real bank content and media are never committed to this repository.

## Analytics events

None.

## Security considerations

- Row-level security is on for every table, and `question_keys` has no `authenticated` grant at all.
- Provenance never reaches candidates.
- Import validation rejects path traversal in asset paths, oversized files and MIME mismatches.
- The service-role key stays in the operator's environment only.

## Relevant sources and ADRs

- D-053 / `ADR-053-assessment-source-and-first-slice.md`
- D-054 / `ADR-054-test-series-programme.md`
- `docs/assessment/TEST_SERIES_PROGRAMME.md`
- `docs/assessment/OFFICIAL_SOURCE_MANIFEST.md`
- Content workstation: `docs/PDF_QUESTION_REGENERATION.md` and `docs/OFFICIAL_BANK.md`

## Acceptance criteria

1. Migrations create the tables, bucket, capabilities and policies. pgTAP proves:
   - student and anonymous users cannot select or modify any `assessment_*` row or storage object;
   - `assessment.bank.read` cannot read `question_keys`;
   - `assessment.bank.import` requires MFA.
2. The answer normaliser passes golden tests for every key format above, using fictional question IDs.
3. A dry run on the fictional fixture export reports exact counts and quarantine reasons and writes nothing.
4. A real run is idempotent: a second identical run changes nothing. A changed fixture creates version 2 and retires version 1.
5. A fixture with a missing or SHA-mismatched asset is quarantined, not published.
6. `pnpm verify` and `pnpm db:test` pass.

## Verification plan

- Vitest: the normaliser and the export validator.
- pgTAP: grants and row-level security.
- Local Supabase integration test: import the fixture into an empty database and run it again.
- An independent security review of the grants before merge.

## Open decisions

- D-055 is decided (A). No open decisions for this slice.
- **Owner question:** which NIFT 2012 and 2013 written booklets are the B.Des and M.Des papers. Until answered, the catalogue papers `nift-bdes-2012`, `nift-bdes-2013` and `nift-mdes-2013` are not linked to bank papers.
