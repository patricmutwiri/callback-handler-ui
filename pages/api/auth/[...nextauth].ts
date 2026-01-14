import { kv } from '@vercel/kv'
import NextAuth, { NextAuthOptions } from 'next-auth'
import FacebookProvider from 'next-auth/providers/facebook'
import GithubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Store user info in KV if needed
      if (user?.email) {
        const userKey = `user:${user.email}`
        await kv.set(userKey, {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          provider: account?.provider,
          createdAt: new Date().toISOString(),
        })
      }
      return true
    },
    async session({ session, token }) {
      if (session.user?.email) {
        const userKey = `user:${session.user.email}`
        const userData = await kv.get(userKey)
        if (userData && typeof userData === 'object') {
          session.user.id = (userData as any).id
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

export default NextAuth(authOptions)
