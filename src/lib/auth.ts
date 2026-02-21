// ===========================================
// CONFIGURAÇÃO DE AUTENTICAÇÃO
// ===========================================
// Sistema de login com NextAuth.js
// Isolamento total por clientId

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Buscar usuário
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { client: true }
        })

        if (!user || !user.isActive) {
          return null
        }

        // Verificar senha
        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!passwordMatch) {
          return null
        }

        // Atualizar último login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() }
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clientId: user.clientId,
          clientName: user.client?.name,
          clientSlug: user.client?.slug,
          clientNiche: user.client?.niche
        }
      }
    })
  ],
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.clientId = user.clientId
        token.clientName = user.clientName
        token.clientSlug = user.clientSlug
        token.clientNiche = user.clientNiche
      }
      return token
    },
    
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.clientId = token.clientId as string | null
        session.user.clientName = token.clientName as string | null
        session.user.clientSlug = token.clientSlug as string | null
        session.user.clientNiche = token.clientNiche as string | null
      }
      return session
    }
  },
  
  pages: {
    signIn: '/login',
    error: '/login'
  },
  
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 dias
  },
  
  secret: process.env.NEXTAUTH_SECRET || 'botwhats-secret-key-change-in-production'
}

// Tipos para o NextAuth
declare module 'next-auth' {
  interface User {
    id: string
    role: string
    clientId: string | null
    clientName: string | null
    clientSlug: string | null
    clientNiche: string | null
  }
  
  interface Session {
    user: User & {
      email: string
      name: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    clientId: string | null
    clientName: string | null
    clientSlug: string | null
    clientNiche: string | null
  }
}
