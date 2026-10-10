import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DemoAuthProvider } from '@/hooks/useDemoAuth'
import { ToastProvider } from '@/components/feedback/Toast'
import type { ReactNode } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DemoAuthProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </DemoAuthProvider>
    </QueryClientProvider>
  )
}