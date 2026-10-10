import { createBrowserRouter } from 'react-router-dom'

import { AppShell } from './shell/AppShell'
import { StaffAccessBoundary } from '../features/auth/StaffAccessBoundary'
import { StudentAccessBoundary } from '../features/auth/StudentAccessBoundary'
import { FoundationPage } from '../pages/FoundationPage'
import { AssignmentDistributionPage } from '../pages/AssignmentDistributionPage'
import { ContentWorkspacePage } from '../pages/ContentWorkspacePage'
import { EnrolmentOperatorPage } from '../pages/EnrolmentOperatorPage'
import { HealthPage } from '../pages/HealthPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { NotificationCentrePage } from '../pages/NotificationCentrePage'
import { StaffSignInPage } from '../pages/StaffSignInPage'
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
