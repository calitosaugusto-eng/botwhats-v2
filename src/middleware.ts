// ===========================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ===========================================
// Protege rotas e redireciona usuários não autenticados

import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // Se chegou aqui, usuário está autenticado
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Rotas que precisam de autenticação
        const protectedPaths = ['/', '/api']
        const { pathname } = req.nextUrl
        
        // Páginas públicas
        const publicPaths = ['/login', '/register', '/api/auth', '/api/webhook', '/api/setup', '/api/cron']
        
        // Se é rota pública, permite
        if (publicPaths.some(path => pathname.startsWith(path))) {
          return true
        }
        
        // Se é rota protegida, precisa de token
        return !!token
      }
    },
    pages: {
      signIn: '/login'
    }
  }
)

export const config = {
  matcher: [
    /*
     * Protege todas as rotas exceto:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
