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
import { TestsShell } from './tests/TestsShell'
import { TestsPapersPage } from '../pages/tests/TestsPapersPage'
import {
  LegacyStudentTestsRedirect,
  TestsComingSoonPage,
  TestsPaperPage,
} from '../pages/tests/TestsSectionPages'
import { ExamWindowPage } from '../pages/tests/exam/ExamWindowPage'
import { TestsResultPage } from '../pages/tests/TestsResultPage'
import { TestsAnalyticsPage } from '../pages/tests/TestsAnalyticsPage'
import { TestsPracticePage } from '../pages/tests/TestsPracticePage'
import { PracticeRunPage } from '../pages/tests/exam/PracticeRunPage'

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
        path: 'student/agenda',
        element: (
          <StudentAccessBoundary allowPreview={false}>
            <StudentAgendaPage />
          </StudentAccessBoundary>
        ),
      },
      {
        path: 'staff/classes',
        element: (
          <StaffAccessBoundary allowPreview={false}>
            <ClassSchedulingPage />
          </StaffAccessBoundary>
        ),
      },
      {
        path: 'student/study-checklist',
        element: (
          <StudentAccessBoundary allowPreview={false}>
            <StudentStudyChecklistPage />
          </StudentAccessBoundary>
        ),
      },
      {
        path: 'student/archive',
        element: (
          <StudentAccessBoundary allowPreview={false}>
            <StudentWorkArchivePage />
          </StudentAccessBoundary>
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
        path: 'student',
        element: (
          <StudentAccessBoundary>
            <StudentWorkspacePage />
          </StudentAccessBoundary>
        ),
      },
      {
        path: 'student/coursework',
        element: (
          <StudentAccessBoundary>
            <StudentCourseworkPage />
          </StudentAccessBoundary>
        ),
      },
      {
        path: 'student/assignments',
        element: (
          <StudentAccessBoundary>
            <StudentAssignmentsPage />
          </StudentAccessBoundary>
        ),
      },
      {
        path: 'student/tests',
        element: <LegacyStudentTestsRedirect />,
      },
      {
        path: 'student/notifications',
        element: (
          <StudentAccessBoundary>
            <NotificationCentrePage />
          </StudentAccessBoundary>
        ),
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
    // F047: practice sets run in the same full-screen exam window.
    path: '/tests/practice/run/:attemptId',
    element: (
      <StudentAccessBoundary>
        <PracticeRunPage />
      </StudentAccessBoundary>
    ),
  },
  {
    // F042: the exam window is full screen, outside the test-series shell.
    path: '/tests/exam/:paperId',
    element: (
      <StudentAccessBoundary>
        <ExamWindowPage />
      </StudentAccessBoundary>
    ),
  },
  {
    // D-057: the test series has its own shell, separate from the coaching portal.
    path: '/tests',
    element: (
      <StudentAccessBoundary>
        <TestsShell />
      </StudentAccessBoundary>
    ),
    children: [
      {
        index: true,
        element: (
          <TestsComingSoonPage
            title="Overview"
            description="Your next paper, recent scores and streaks will appear here."
          />
        ),
      },
      { path: 'papers', element: <TestsPapersPage /> },
      { path: 'papers/:paperId', element: <TestsPaperPage /> },
      { path: 'results/:attemptId', element: <TestsResultPage /> },
      { path: 'analytics', element: <TestsAnalyticsPage /> },
      { path: 'practice', element: <TestsPracticePage /> },
      {
        path: 'mocks',
        element: (
          <TestsComingSoonPage
            title="Mocks"
            description="All-India timed mocks with Part A, a break and Part B."
          />
        ),
      },
      {
        path: 'bookmarks',
        element: (
          <TestsComingSoonPage
            title="Bookmarks"
            description="Questions you save while reviewing papers."
          />
        ),
      },
      {
        path: 'sketches',
        element: (
          <TestsComingSoonPage
            title="Sketches"
            description="Your Part B drawing uploads and their feedback."
          />
        ),
      },
    ],
  },
])
