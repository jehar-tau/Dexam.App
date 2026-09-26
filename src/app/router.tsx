import { createBrowserRouter } from 'react-router-dom'

import { AppShell } from './shell/AppShell'
import { FoundationPage } from '../pages/FoundationPage'
import { HealthPage } from '../pages/HealthPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { StudentActivationPage } from '../pages/StudentActivationPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <FoundationPage /> },
      { path: 'activate', element: <StudentActivationPage /> },
      { path: 'health', element: <HealthPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
