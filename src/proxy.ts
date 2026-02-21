// ===========================================
// PROXY DE AUTENTICACAO (Next.js 16)
// ===========================================
// Protege rotas e redireciona usuarios nao autenticados
// Nota: No Next.js 16, middleware.ts foi renomeado para proxy.ts
// e agora roda em Node.js runtime em vez de Edge

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simulacao de verificacao de sessao (NextAuth compativel)
async function getSessionFromRequest(req: NextRequest): Promise<{ user?: { id: string; role: string } } | null> {
  try {
    // Tenta obter o token de sessao do cookie
    const sessionToken = req.cookies.get('next-auth.session-token')?.value ||
                         req.cookies.get('__Secure-next-auth.session-token')?.value

    if (!sessionToken) {
      return null
    }

    // Em Node.js runtime, podemos usar APIs completas
    // Por enquanto, retorna um placeholder que sera validado nas paginas
    return { user: { id: 'session-active', role: 'user' } }
  } catch {
    return null
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Paginas publicas (nao precisam de autenticacao)
  const publicPaths = ['/login', '/register', '/api/auth', '/api/webhook', '/api/setup', '/api/cron']

  // Se e rota publica, permite
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Arquivos estaticos e internos do Next.js
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // arquivos estaticos
  ) {
    return NextResponse.next()
  }

  // Verifica sessao
  const session = await getSessionFromRequest(req)

  // Se nao tem sessao e esta em rota protegida, redireciona para login
  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Usuario autenticado, permite acesso
  return NextResponse.next()
}

// Configuração do matcher
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
