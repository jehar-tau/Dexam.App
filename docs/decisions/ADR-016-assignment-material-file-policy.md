# ADR-016 — Assignment Material File Policy

Status: Option B approved 2026-10-10

## Question

What file types and limits should authorized staff be able to attach to assignment definitions in the first release?

## Why this needs your decision

Uploads affect storage cost, security, portability, and what students can open on mobile devices. Student submission uploads are a separate later policy; this decision covers only staff-provided assignment sheets, references, and examples.

## Options

### A — Text instructions only

Assignments contain structured text and links but no uploaded files.

- **Impact:** Safest and cheapest, but existing PDF/image assignment material must be rewritten or hosted elsewhere.
- **Cost:** Minimal.
- **Risk:** Low technical risk; high operational inconvenience.
- **Reversibility:** High; uploads can be added later.

### B — Private PDF and common image files with conservative limits (recommended)

Allow PDF, JPEG, PNG, and WebP only; at most 5 files per assignment and 10 MB per file. Store them in a private Supabase bucket under opaque keys. Validate extension, declared MIME type, byte size, ownership, and draft assignment state. Serve files as downloads rather than executable inline content.

- **Impact:** Covers assignment sheets, visual references, and examples while remaining mobile-friendly.
- **Cost:** Uses the already approved Supabase stack and begins on its free allowance; no paid service is authorized.
- **Risk:** Moderate and bounded. Files remain untrusted, private, and inaccessible to Sales or unrelated learners/staff.
- **Reversibility:** High; limits can be raised later with evidence.

### C — Broad document and media uploads

Also allow editable office files, archives, audio, and video.

- **Impact:** Maximum flexibility.
- **Cost:** Higher storage, bandwidth, validation, preview, and support burden.
- **Risk:** Higher malware and compatibility exposure; video would quickly challenge a free-first architecture.
- **Reversibility:** Low once users depend on the broader formats.

## Recommendation

Approve Option B. Keep text instructions first-class so assignments remain searchable and portable. Files may be added, replaced, or removed only while an assignment version is a draft. Publishing pins the attachment records; later changes create a new version.

## Approval

The product owner approved Option B on 2026-10-10. The first release permits only private PDF, JPEG, PNG, and WebP assignment materials, limited to five files per assignment and 10 MB per file. No paid storage plan is authorized.
