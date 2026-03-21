import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ROLE_REDIRECT } from '@/lib/utils'

type CookieToSet = {
  name: string
  value: string
  options?: any
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )

          supabaseResponse = NextResponse.next({ request })

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  const publicPaths = ['/login', '/reset-password']

  if (publicPaths.some((p) => path.startsWith(p))) {
    if (user && !error) {
      const { data: profile } = await supabase
        .from('users')
        .select('role, must_reset_password')
        .eq('id', user.id)
        .single()

      if (profile && !profile.must_reset_password) {
        const redirect =
          ROLE_REDIRECT[profile.role] || '/dashboard'

        return NextResponse.redirect(new URL(redirect, request.url))
      }
    }

    return supabaseResponse
  }

  if (!user || error) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, must_reset_password')
    .eq('id', user.id)
    .single()

  if (!profile) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (
    profile.must_reset_password &&
    !path.startsWith('/reset-password')
  ) {
    return NextResponse.redirect(
      new URL('/reset-password', request.url)
    )
  }

  const roleRedirectMap: Record<string, string> = {
    admin: '/dashboard',
    management: '/dashboard/management',
    teacher: '/dashboard/teacher',
    student: '/dashboard/student',
    parent: '/dashboard/parent',
  }

  const allowedPrefix = roleRedirectMap[profile.role]

  if (
    path === '/' ||
    (path === '/dashboard' && profile.role !== 'admin')
  ) {
    return NextResponse.redirect(
      new URL(allowedPrefix, request.url)
    )
  }

  if (path.startsWith('/dashboard')) {
    const isAllowed =
      profile.role === 'admin' ||
      (profile.role === 'management' &&
        path.startsWith('/dashboard/management')) ||
      (profile.role === 'teacher' &&
        path.startsWith('/dashboard/teacher')) ||
      (profile.role === 'student' &&
        path.startsWith('/dashboard/student')) ||
      (profile.role === 'parent' &&
        path.startsWith('/dashboard/parent'))

    if (!isAllowed) {
      return NextResponse.redirect(
        new URL(allowedPrefix, request.url)
      )
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
