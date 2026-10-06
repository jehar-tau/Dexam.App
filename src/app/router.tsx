import { createBrowserRouter } from 'react-router-dom'

import { AppShell } from './shell/AppShell'
import { StaffAccessBoundary } from '../features/auth/StaffAccessBoundary'
import { FoundationPage } from '../pages/FoundationPage'
import { EnrolmentOperatorPage } from '../pages/EnrolmentOperatorPage'
import { HealthPage } from '../pages/HealthPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { StaffSignInPage } from '../pages/StaffSignInPage'
import { StudentActivationPage } from '../pages/StudentActivationPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <FoundationPage /> },
      { path: 'activate', element: <StudentActivationPage /> },
      { path: 'staff/sign-in', element: <StaffSignInPage /> },
      {
        path: 'staff/enrolments',
        element: (
          <StaffAccessBoundary capability="enrollment.operate">
            <EnrolmentOperatorPage />
          </StaffAccessBoundary>
        ),
      },
      { path: 'health', element: <HealthPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
