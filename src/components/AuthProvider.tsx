// ===========================================
// SESSION PROVIDER - NextAuth Session Wrapper
// ===========================================
'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
