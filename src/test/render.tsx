import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { PropsWithChildren, ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

function createTestProviders(initialEntries: string[]) {
  return function TestProviders({ children }: PropsWithChildren) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
}

export function renderApp(ui: ReactElement, initialEntries = ['/']) {
  return render(ui, { wrapper: createTestProviders(initialEntries) })
}
