import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
      provider?: string | null
      createdAt?: string | null
      updatedAt?: string | null
      lastLoginAt?: string | null
      lastLoginIP?: string | null
      lastLoginUserAgent?: string | null
      lastLoginReferer?: string | null
      lastLoginLocation?: string | null
      lastLoginDevice?: string | null
      lastLoginBrowser?: string | null
      lastLoginOS?: string | null
      lastLoginDeviceType?: string | null
    }
  }
}
