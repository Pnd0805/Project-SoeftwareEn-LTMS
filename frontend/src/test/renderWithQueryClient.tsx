import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as renderReact, type RenderOptions } from '@testing-library/react'
import type { ReactElement, PropsWithChildren } from 'react'

/** Mirror App's query provider for page tests that mock only their own data sources. */
export function render(ui: ReactElement, options?: RenderOptions) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return renderReact(ui, { wrapper, ...options })
}
