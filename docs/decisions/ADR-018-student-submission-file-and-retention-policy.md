# ADR-018 — Student Submission File and Retention Policy

Status: Option B approved 2026-10-10

## Question

Which files may students submit, how should images be compressed, what limits apply, and how long should Dexam retain their private work?

## Why this needs your decision

Student drawings and documents are private educational data. File formats and limits affect whether phone uploads work reliably, how quickly free storage is consumed, and how much untrusted content the application must handle. Retention determines both student access and Dexam's ongoing privacy and storage burden.

## Options

### A — Minimal files with short retention

Allow up to 3 JPEG, PNG, or PDF files of 5 MB each. Delete finalized files 90 days after the related enrolment ends.

- **Impact:** Cheapest and simplest, but multi-page drawing assignments may need compression or combining files.
- **Cost:** Lowest storage and bandwidth use.
- **Risk:** Low technical exposure; higher chance of frustrating students or losing useful work too soon.
- **Reversibility:** Moderate because already-deleted files cannot be restored.

### B — Private common-format submissions with bounded retention (recommended)

Allow PDF, JPEG, PNG, and WebP files only. Permit up to 10 files per attempt, no more than 10 MB per file and 50 MB total per attempt. Video, audio, archives, editable office documents, and design-source files are excluded from the first release. If a phone produces an unsupported format such as HEIC, the interface explains how to export or share it as JPEG or PDF rather than accepting a file teachers may not be able to preview.

Optimize compatible images in the student's browser before upload, so the original large file never consumes network bandwidth or private storage. Correct orientation first, remove embedded metadata such as location data, never upscale, and reduce dimensions only when the longest edge exceeds 3,200 pixels. Use a visually conservative quality setting of at least 85%, compare the result with the original, and upload whichever is smaller. Show the student a preview plus the original and final sizes before submission, with a **Keep original quality** choice when fine drawing detail is visibly affected and the original remains within the normal limits. Do not recompress PDFs in the first release because reliable browser-side PDF optimization can damage text or pages and adds disproportionate complexity.

Store files in a private Supabase bucket under opaque object keys. Validate extension, declared MIME type, detected file signature, byte size, attempt ownership, and draft state on the trusted backend. Serve files with short-lived access and a safe download/preview posture. Students may replace or delete their own draft files; finalized files are immutable.

Keep finalized submission files while the related enrolment is active and for 12 months after it ends. Give the student a visible download opportunity before expiry. Purge abandoned, unsubmitted draft files 30 days after their last activity. Keep only the minimum non-file audit metadata needed to explain that an attempt existed; future portfolio use requires a separate opt-in decision rather than silently retaining work forever. Exceptional early deletion must be an authorized, audited administrative action.

- **Impact:** Supports photographed multi-page work on mobile while reducing upload time and storage without hiding quality loss from the student.
- **Cost:** Browser-side image optimization has no processing-service fee and avoids storing a second original copy. The approved Supabase stack can start within its free allowance; compression, per-attempt limits, and retention bound growth. No paid service is authorized.
- **Risk:** Moderate but controlled through private storage, current-state authorization, server validation, and immutable finalized records.
- **Reversibility:** High for future limits and formats; retention changes apply prospectively because deleted files cannot be recovered.

### C — Broad media support with indefinite retention

Allow images, documents, archives, audio, video, and design-source files with much larger limits, and keep them for the lifetime of the member account.

- **Impact:** Most flexible for students and future portfolio ideas.
- **Cost:** Storage, bandwidth, scanning, preview generation, and support costs can grow quickly and may require paid infrastructure.
- **Risk:** Highest security, privacy, compatibility, and vendor-cost exposure.
- **Reversibility:** Low once users expect every file to remain available indefinitely.

## Recommendation

Approve Option B. It covers the current drawing and written-assignment workflow, uses built-in browser compression to protect the free-first cost envelope, and avoids treating private coursework as a permanent portfolio without explicit consent. The compression settings and limits can be revisited using real submission data.

## Approval

The product owner approved Option B on 2026-10-10, including built-in browser-side image compression. The first release will use private PDF/JPEG/PNG/WebP submissions, the documented 10-file/10-MB/50-MB limits, draft-only replacement, immutable finalized files, 30-day abandoned-draft cleanup, and retention through 12 months after the related enrolment ends. No paid storage or compression service is authorized.
