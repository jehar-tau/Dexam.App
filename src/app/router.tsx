import { createBrowserRouter } from 'react-router-dom'

import { AppShell } from './shell/AppShell'
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
import { StaffSecurityPage } from '../pages/StaffSecurityPage'
import { StaffRecoveryPage } from '../pages/StaffRecoveryPage'
import { StudentActivationPage } from '../pages/StudentActivationPage'
import { StudentAssignmentsPage } from '../pages/StudentAssignmentsPage'
import { StudentCourseworkPage } from '../pages/StudentCourseworkPage'
import { StudentSignInPage } from '../pages/StudentSignInPage'
import { StudentWorkspacePage } from '../pages/StudentWorkspacePage'
import { TeacherFeedbackPage } from '../pages/TeacherFeedbackPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <FoundationPage /> },
      { path: 'activate', element: <StudentActivationPage /> },
      { path: 'sign-in', element: <StudentSignInPage /> },
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
])
