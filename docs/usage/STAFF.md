# Staff guide

[Handbook home](README.md) · [Access and help](ACCESS_AND_TROUBLESHOOTING.md)

## Access and responsibilities

Open `/staff/sign-in` with your established employee email/password. Staff/teachers/admins currently share this entrance and shell. Your actual membership, capabilities, offering assignments and MFA determine which workspaces you can use. Sales, CRM Coordinator, Enrolment Operator, content editor/publisher, assignment distributor, class scheduler and privacy operator are distinct responsibilities—not powers every employee automatically has.

Use your permitted menu or a direct workspace path. If the generic sign-in default points to Enrolments and that is not your job, use the path for your own workspace; do not request unrelated access just to avoid a redirect/denial. Ask an authorized operator to check your existing scope if expected access is missing.

## 1. Sales: manage enquiries

Open **CRM** (`/staff/crm`).

1. Search your assigned enquiries or create a new enquiry with the prospect, relevant contact/guardian relationship, source, interests and intake context requested by the form. An enquiry contact is not automatically a student account or marketing consent.
2. Review possible existing-person matches. Shared names/phone/email evidence can indicate a guardian or a different person; never assume a duplicate should be merged automatically.
3. Select an enquiry, log the appropriate activity and record concise factual notes. Schedule/replace a follow-up with its intended due date/time. Avoid unnecessary sensitive information.
4. Use deliberate stage controls as the conversation progresses. Changing a CRM stage does not create course access.
5. To request admission, enter the **Handoff note** and choose **Request review**. Sales can request enrolment review, not issue a Member ID/activation pack or approve student access.
6. If an operator returns the handoff, read the reason, resolve the missing context and resubmit through the provided flow rather than opening duplicate enquiries.

### Dead enquiries

Enter the required reason and choose **Move to dead enquiries**. The enquiry leaves Active for **Recently dead**; after seven days it appears in **Dead archive** based on its timestamp. This is not permanent deletion or transfer to a different database. Obsolete follow-up/alert work is invalidated under the existing lifecycle rules.

To revive it, open the relevant dead area, enter a restoration reason and choose **Restore to active queue**. The same audited enquiry is restored; review its ownership and schedule any appropriate new follow-up. Do not recreate the person just because the enquiry was dead. CRM privacy erasure is a separate authorized workflow.

## 2. CRM Coordinator: allocate ownership

Open **CRM assignment** (`/staff/crm/assignments`) only with the separate allocation grant.

1. Review **Unassigned** or **Needs reassignment**. This queue shows minimum allocation information, not a new right to inspect every enquiry's private content.
2. Select the exact enquiry and an **Active Sales owner**.
3. Enter an **Assignment reason**, then confirm assignment.
4. Confirm the queue/result changed. Reassignment does not reactivate the previous employee's access.

There is no approved bulk/automatic routing or broad export workflow. A Sales role alone does not imply allocation authority.

## 3. Enrolment Operator: review a handoff

Open **Handoffs** (`/staff/enrolment-handoffs`).

1. Select the pending request and review the prospect/contact/intake context.
2. Decide deliberately between **Create a new student** and **Use an existing student**. For an existing person, search and select the canonical student/Member ID.
3. Classify every presented possible identity match as appropriate. Name or shared-contact similarity is not proof of identity. The form blocks unresolved candidates; do not select a disposition simply to dismiss the warning.
4. Select the approved **Course and cohort** and enter an **Approval reason**.
5. Choose **Approve enrolment** only when identity and course context are established. A new/unclaimed student enters the activation process; a claimed existing student reuses their account/Member ID and receives the eligible enrolment without a duplicate password pack.
6. If information is incomplete, enter a **Return reason** and choose **Return request**. No student access is created by returning it.

## 4. Issue an initial activation pack

Open **Enrolments** (`/staff/enrolments`) and search the activation queue. Review the exact student/course/request and confirm pack issuance using the provided controls. Deliver the Member ID, one-time activation link and backup entry privately to that student. Hide the pack when finished. Never put credentials in CRM notes, group chat, screenshots, public issues or this handbook.

If reissue is permitted, provide its required reason and understand that earlier credentials are invalidated. Do not issue another initial activation for an already claimed account. Forgotten passwords use the independently approved student recovery process, not duplicate identity creation.

## 5. Academic content staff: edit lessons and assignments

Open **Content** (`/staff/content`) with the appropriate offering-scoped authority.

1. Choose the curriculum/version and topic. Published content is immutable. Create an editable copy/new draft before changing published material; do not expect an in-place edit of existing students' version.
2. Edit topic/lesson titles and the text-first material in the draft. Add/remove permitted lesson files while the lesson is editable. Lesson attachment limits are five PDF/JPEG/PNG/WebP files, 10 MB each; inspect prepared images and confirm upload completion.
3. Use the assignment controls to create a private assignment draft or edit an editable version. Set its title/group/instructions, topic links and available evaluation guidance; manage permitted private reference attachments through those controls.
4. Review the intended lesson/assignment content and release note. Save changes and deliberately publish using the appropriate existing publication authority. Draft-editor access alone is not publication permission.
5. Publishing locks that version. Later changes use a new draft/version. Do not remove shared/published file bytes manually; private file-reference protection is part of the system.

Publication does not migrate existing students to a newer curriculum, and publishing an assignment does not distribute it. Imported Google Sheets are source planning material, not automatic synchronized content. No general video/ebook authoring, arbitrary rich-media hosting or live AI rubric evaluation is implied.

### Read-only curriculum impact

With both required existing authorities and an explicit offering-scoped preview grant, open `/staff/curriculum-impact`. Select the offering and two published versions to inspect topic/lesson/material differences and aggregate affected-enrolment counts. This preview does not expose individual progress or file URLs, move students, send notices or perform a migration. Do not interpret a successful preview as approval to upgrade a cohort.

## 6. Release assignments

Open **Distribution** (`/staff/assignments`) with explicit assignment-distribution scope.

1. Select the offering and a published assignment/version.
2. Choose **One cohort** or **Selected students**; inspect the exact target set.
3. Supply an optional due date/time and the required release context/note shown by the form.
4. Deliberately release and check **Recent releases** and the result before retrying an uncertain response.

Students must have eligible current enrolments. Publication and release are different steps. A release is not permission to modify their submitted attempts, and the due-date display is not an invented scoring/late-penalty policy.

## 7. Schedule one-off classes

Open **Classes** (`/staff/classes`) with the existing authorized scheduling scope. This is not automatically a Teacher capability.

Select the permitted course/cohort context; enter **Class title**, start/end with an explicit UTC offset, display timezone and a plain-text classroom/location. Review the audience/time, acknowledge the required confirmation and submit. For a change, edit the existing session; for cancellation, use its reason/confirmation controls. Check the updated schedule and in-app alerts.

There is no recurrence, attendance, conferencing integration, advance reminder or external messaging promise. Never put a credential-bearing meeting link into a field defined as plain text. Check timezone explicitly rather than assuming your browser timezone is the student's.

## 8. Close out an enrolment

Open **Course closeout** (`/staff/enrolment-closeout`) with existing enrolment-operation scope. Search the Member ID/name, select the exact course enrolment, choose **Completed** or **Withdrawn**, record the required reason and acknowledge the stated access change. Choose **Close this enrolment** only after review.

Closeout ends lessons/new submissions for that enrolment; eligible finalized own-work/published-feedback archive lasts 12 months after course end. It preserves the Member ID and other courses. This is not account deletion, lifetime lesson access, pause/resume, transfer, backdating, automatic expiry or an approved undo/reopen workflow. Treat mistakes as support incidents rather than editing database rows or silently creating another enrolment.

## 9. Privacy responsibilities

Only specifically authorized privacy operators/approvers use `/staff/crm/privacy`, with required recent MFA. Record a verified request, review protected-data boundaries, apply a permitted field-scoped correction or propose erasure after its impact review. Erasure approval must be independent; temporary holds require the proper reason/review deadline and separate release action.

Do not confuse approved erasure with completed physical execution or restore a minimized enquiry by recreating its old details. The privacy operation deliberately preserves protected canonical/academic records where required. No export or general student-data deletion authority is implied. See the [Admin guide](ADMINS.md) and approved privacy procedures; actual production processing still requires qualified review.

## Notifications, errors and security

Use `/staff/notifications` for current assigned work. Sales gets permitted assignment/follow-up alerts; other employee destinations depend on scope. In-app notices are not consent for marketing or a replacement for manual escalation.

Use `/staff/security` for your own MFA/session controls. On a shared device, sign out and protect any downloaded private files. After failed/uncertain writes, refresh current state before repeating. Never resolve denial by sharing another employee's account or asking engineering to bypass current-state authorization.
