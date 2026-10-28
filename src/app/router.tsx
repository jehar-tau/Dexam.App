import { createBrowserRouter } from 'react-router-dom'

import { AppShell } from './shell/AppShell'
import { CurriculumImpactPage } from '../pages/CurriculumImpactPage'
import { StaffAccessBoundary } from '../features/auth/StaffAccessBoundary'
import { StudentAccessBoundary } from '../features/auth/StudentAccessBoundary'
import { FoundationPage } from '../pages/FoundationPage'
import { AssignmentDistributionPage } from '../pages/AssignmentDistributionPage'
import { ContentWorkspacePage } from '../pages/ContentWorkspacePage'
import { CrmAssignmentPage } from '../pages/CrmAssignmentPage'
import { CrmPrivacyPage } from '../pages/CrmPrivacyPage'
import { CrmWorkspacePage } from '../pages/CrmWorkspacePage'
import { EnrolmentOperatorPage } from '../pages/EnrolmentOperatorPage'
import { EnrolmentHandoffPage } from '../pages/EnrolmentHandoffPage'
import { HealthPage } from '../pages/HealthPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { NotificationCentrePage } from '../pages/NotificationCentrePage'
import { StaffSignInPage } from '../pages/StaffSignInPage'
import { EmployeeActivationPage } from '../pages/EmployeeActivationPage'
import { EmployeeInvitationsPage } from '../pages/EmployeeInvitationsPage'
import { EmployeePasswordRecoveryPage } from '../pages/EmployeePasswordRecoveryPage'
import { StudentPasswordRecoveryPage } from '../pages/StudentPasswordRecoveryPage'
import { StudentRecoveryAdminPage } from '../pages/StudentRecoveryAdminPage'
import { EnrollmentCloseoutPage } from '../pages/EnrollmentCloseoutPage'
import { StudentWorkArchivePage } from '../pages/StudentWorkArchivePage'
import { StudentStudyChecklistPage } from '../pages/StudentStudyChecklistPage'
import { ClassSchedulingPage, StudentAgendaPage } from '../pages/ClassSchedulePages'
import { StaffSecurityPage } from '../pages/StaffSecurityPage'
import { StaffRecoveryPage } from '../pages/StaffRecoveryPage'
import { RecoveryIncidentsPage } from '../pages/RecoveryIncidentsPage'
import { StudentActivationPage } from '../pages/StudentActivationPage'
import { StudentAssignmentsPage } from '../pages/StudentAssignmentsPage'
import { StudentCourseworkPage } from '../pages/StudentCourseworkPage'
import { StudentSignInPage } from '../pages/StudentSignInPage'
import { StudentWorkspacePage } from '../pages/StudentWorkspacePage'
import { TeacherFeedbackPage } from '../pages/TeacherFeedbackPage'
import { PortalHomePage } from '../pages/PortalHomePage'
import { PortalAccessBoundary } from '../features/auth/PortalAccessBoundary'
import { StudentShell } from './student/StudentShell'
import { LegacyStudentTestsRedirect, RetiredTestsSection } from '../pages/tests/TestsSectionPages'
import { ExamWindowPage } from '../pages/tests/exam/ExamWindowPage'
import { TestsResultPage } from '../pages/tests/TestsResultPage'
import { TestsPracticePage } from '../pages/tests/TestsPracticePage'
import { PracticeRunPage } from '../pages/tests/exam/PracticeRunPage'
import { TestsSignInPage, TestsWelcomePage } from '../pages/tests/TestsWelcomePages'
import { TestsLivePage } from '../pages/tests/TestsLivePage'
import { TestsHomePage } from '../pages/tests/TestsOverviewPage'
import { TestsMockTestPage } from '../pages/tests/TestsMockTestPage'
import { LiveEventsStaffPage } from '../pages/LiveEventsStaffPage'
import { TestsPlansPage } from '../pages/tests/TestsPlansPage'
import { PartBPage } from '../pages/tests/exam/PartBPage'
import { PartBEvaluationPage, PartBQueuePage } from '../pages/PartBEvaluationPage'
import { TestsAccessBoundary } from '../features/testSeries/TestsAccessBoundary'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        path: 'teacher/sign-in',
        element: <StaffSignInPage key="teacher-sign-in" portal="teacher" />,
      },
      { path: 'admin/sign-in', element: <StaffSignInPage key="admin-sign-in" portal="admin" /> },
      {
        path: 'staff',
        element: (
          <StaffAccessBoundary>
            <PortalAccessBoundary portal="staff" allowPreview>
              <PortalHomePage portal="staff" />
            </PortalAccessBoundary>
          </StaffAccessBoundary>
        ),
      },
      {
        // F048: anonymous Part B evaluation.
        path: 'staff/part-b',
        element: (
          <StaffAccessBoundary capability="assessment.part_b.evaluate" allowPreview={false}>
            <PartBQueuePage />
          </StaffAccessBoundary>
        ),
      },
      {
        // F050: organisers schedule all-India live mocks.
        path: 'staff/live-events',
        element: (
          <StaffAccessBoundary capability="assessment.live.manage" allowPreview={false}>
            <LiveEventsStaffPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/part-b/:attemptId',
        element: (
          <StaffAccessBoundary capability="assessment.part_b.evaluate" allowPreview={false}>
            <PartBEvaluationPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'teacher',
        element: (
          <StaffAccessBoundary>
            <PortalAccessBoundary portal="teacher" allowPreview>
              <PortalHomePage portal="teacher" />
            </PortalAccessBoundary>
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'admin',
        element: (
          <StaffAccessBoundary requireMfa allowPreview={false}>
            <PortalAccessBoundary portal="admin">
              <PortalHomePage portal="admin" />
            </PortalAccessBoundary>
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'teacher/reviews',
        element: (
          <StaffAccessBoundary capability="feedback.review">
            <PortalAccessBoundary portal="teacher" allowPreview>
              <TeacherFeedbackPage />
            </PortalAccessBoundary>
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'teacher/notifications',
        element: (
          <StaffAccessBoundary>
            <PortalAccessBoundary portal="teacher" allowPreview>
              <NotificationCentrePage />
            </PortalAccessBoundary>
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'teacher/security',
        element: (
          <StaffAccessBoundary skipMfa allowPreview={false}>
            <StaffSecurityPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'admin/security',
        element: (
          <StaffAccessBoundary skipMfa allowPreview={false}>
            <PortalAccessBoundary portal="admin">
              <StaffSecurityPage />
            </PortalAccessBoundary>
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'admin/notifications',
        element: (
          <StaffAccessBoundary requireMfa allowPreview={false}>
            <PortalAccessBoundary portal="admin">
              <NotificationCentrePage />
            </PortalAccessBoundary>
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'admin/employees',
        element: (
          <StaffAccessBoundary capability="staff_role.grant" requireMfa allowPreview={false}>
            <PortalAccessBoundary portal="admin">
              <EmployeeInvitationsPage />
            </PortalAccessBoundary>
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'admin/student-recovery',
        element: (
          <StaffAccessBoundary capability="student_recovery.assist" requireMfa allowPreview={false}>
            <PortalAccessBoundary portal="admin">
              <StudentRecoveryAdminPage />
            </PortalAccessBoundary>
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'admin/recovery',
        element: (
          <StaffAccessBoundary
            capability="security_controls.change"
            requireMfa
            allowPreview={false}
          >
            <PortalAccessBoundary portal="admin">
              <StaffRecoveryPage />
            </PortalAccessBoundary>
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'admin/incidents',
        element: (
          <StaffAccessBoundary
            capability="security_controls.change"
            requireMfa
            allowPreview={false}
          >
            <PortalAccessBoundary portal="admin">
              <RecoveryIncidentsPage />
            </PortalAccessBoundary>
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/curriculum-impact',
        element: (
          <StaffAccessBoundary allowPreview={false}>
            <CurriculumImpactPage />
          </StaffAccessBoundary>
        ),
      },
      { index: true, element: <FoundationPage /> },
      { path: 'activate', element: <StudentActivationPage /> },
      { path: 'sign-in', element: <StudentSignInPage /> },
      { path: 'student/recover', element: <StudentPasswordRecoveryPage /> },
      {
        path: 'staff/classes',
        element: (
          <StaffAccessBoundary allowPreview={false}>
            <ClassSchedulingPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/enrolment-closeout',
        element: (
          <StaffAccessBoundary allowPreview={false}>
            <EnrollmentCloseoutPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/student-recovery',
        element: (
          <StaffAccessBoundary capability="student_recovery.assist" requireMfa allowPreview={false}>
            <StudentRecoveryAdminPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'student/tests',
        element: <LegacyStudentTestsRedirect />,
      },
      { path: 'staff/sign-in', element: <StaffSignInPage /> },
      { path: 'staff/activate', element: <EmployeeActivationPage /> },
      { path: 'staff/recover', element: <EmployeePasswordRecoveryPage /> },
      {
        path: 'staff/employees',
        element: (
          <StaffAccessBoundary capability="staff_role.grant" requireMfa allowPreview={false}>
            <EmployeeInvitationsPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/security/recovery',
        element: (
          <StaffAccessBoundary capability="security_controls.change" requireMfa>
            <StaffRecoveryPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/security/incidents',
        element: (
          <StaffAccessBoundary
            capability="security_controls.change"
            requireMfa
            allowPreview={false}
          >
            <RecoveryIncidentsPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/security',
        element: (
          <StaffAccessBoundary skipMfa>
            <StaffSecurityPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/crm',
        element: (
          <StaffAccessBoundary capability="lead.manage_assigned">
            <CrmWorkspacePage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/crm/assignments',
        element: (
          <StaffAccessBoundary capability="lead.assign">
            <CrmAssignmentPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/crm/privacy',
        element: (
          <StaffAccessBoundary capability="privacy.manage" requireMfa>
            <CrmPrivacyPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/enrolment-handoffs',
        element: (
          <StaffAccessBoundary capability="enrollment.operate">
            <EnrolmentHandoffPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/enrolments',
        element: (
          <StaffAccessBoundary capability="enrollment.operate">
            <EnrolmentOperatorPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'teacher/content',
        element: (
          <StaffAccessBoundary capability="content.manage_drafts">
            <PortalAccessBoundary portal="teacher" allowPreview>
              <ContentWorkspacePage />
            </PortalAccessBoundary>
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/content',
        element: (
          <StaffAccessBoundary capability="content.manage_drafts">
            <ContentWorkspacePage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/assignments',
        element: (
          <StaffAccessBoundary capability="assignment.distribute">
            <AssignmentDistributionPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/reviews',
        element: (
          <StaffAccessBoundary capability="feedback.review">
            <TeacherFeedbackPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'staff/notifications',
        element: (
          <StaffAccessBoundary>
            <NotificationCentrePage />
          </StaffAccessBoundary>
        ),
      },
      { path: 'health', element: <HealthPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    // D-059: the student portal is one left-sidebar shell for coaching tools and the test series.
    path: '/student',
    element: (
      <StudentAccessBoundary>
        <StudentShell />
      </StudentAccessBoundary>
    ),
    children: [
      { index: true, element: <StudentWorkspacePage /> },
      { path: 'coursework', element: <StudentCourseworkPage /> },
      { path: 'assignments', element: <StudentAssignmentsPage /> },
      { path: 'notifications', element: <NotificationCentrePage /> },
      {
        path: 'study-checklist',
        element: (
          <StudentAccessBoundary allowPreview={false}>
            <StudentStudyChecklistPage />
          </StudentAccessBoundary>
        ),
      },
      {
        path: 'agenda',
        element: (
          <StudentAccessBoundary allowPreview={false}>
            <StudentAgendaPage />
          </StudentAccessBoundary>
        ),
      },
      {
        path: 'archive',
        element: (
          <StudentAccessBoundary allowPreview={false}>
            <StudentWorkArchivePage />
          </StudentAccessBoundary>
        ),
      },
    ],
  },
  // D-060: the owner's question review runs on the local dev server only (it reads the content
  // workstation's export through the dev-server plugin) and is never part of a build.
  ...(import.meta.env.DEV
    ? [
        {
          path: '/review/questions',
          lazy: async () => ({
            Component: (await import('../pages/review/QuestionReviewPage')).QuestionReviewPage,
          }),
        },
      ]
    : []),
  {
    // F040: mocks run in the full exam-centre window.
    path: '/tests/mock/run/:attemptId',
    element: (
      <TestsAccessBoundary>
        <PracticeRunPage variant="mock" />
      </TestsAccessBoundary>
    ),
  },
  {
    // F050: a live mock's Part A runs in the same exam-centre window on the event clock.
    path: '/tests/live/:key/run/:attemptId',
    element: (
      <TestsAccessBoundary>
        <PracticeRunPage variant="live" />
      </TestsAccessBoundary>
    ),
  },
  {
    // F043: Part B (drawing and uploads) runs full screen after Part A.
    path: '/tests/part-b/:attemptId',
    element: (
      <TestsAccessBoundary>
        <PartBPage />
      </TestsAccessBoundary>
    ),
  },
  // F039: test-series sign-in (Google for candidates, Member ID for coaching students) and setup.
  { path: '/tests/sign-in', element: <TestsSignInPage /> },
  { path: '/tests/welcome', element: <TestsWelcomePage /> },
  {
    // F047: practice sets run in the same full-screen exam window.
    path: '/tests/practice/run/:attemptId',
    element: (
      <TestsAccessBoundary>
        <PracticeRunPage />
      </TestsAccessBoundary>
    ),
  },
  {
    // F042: the exam window is full screen, outside the test-series shell.
    path: '/tests/exam/:paperId',
    element: (
      <TestsAccessBoundary>
        <ExamWindowPage />
      </TestsAccessBoundary>
    ),
  },
  {
    // D-057/D-059: the test series shares the student portal's sidebar shell.
    path: '/tests',
    element: (
      <TestsAccessBoundary>
        <StudentShell />
      </TestsAccessBoundary>
    ),
    children: [
      // D-062: candidates' home (coaching students' home is the portal Home), Practice and
      // Mock test; results and Part B open from them.
      { index: true, element: <TestsHomePage /> },
      { path: 'mock-test', element: <TestsMockTestPage /> },
      { path: 'results/:attemptId', element: <TestsResultPage /> },
      { path: 'practice', element: <TestsPracticePage /> },
      { path: 'live/:key', element: <TestsLivePage /> },
      { path: 'plans', element: <TestsPlansPage /> },
      // Retired sections keep their links: Papers, Mocks and Drawing became Mock test (D-062);
      // Analytics, Bookmarks and Sketches went to Home (D-059).
      ...['papers', 'papers/:paperId', 'mocks', 'drawing'].map((path) => ({
        path,
        element: <RetiredTestsSection to="/tests/mock-test" />,
      })),
      ...['analytics', 'bookmarks', 'sketches'].map((path) => ({
        path,
        element: <RetiredTestsSection />,
      })),
    ],
  },
])
