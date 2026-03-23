import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ROLE_REDIRECT: Record<string, string> = {
  admin:      '/dashboard',
  management: '/dashboard/management',
  teacher:    '/dashboard/teacher',
  student:    '/dashboard/student',
  parent:     '/dashboard/parent',
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const path = request.nextUrl.pathname

  // المسارات العامة
  const publicPaths = ['/login', '/change-password', '/reset-password']
  if (publicPaths.some(p => path.startsWith(p))) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ── تحقق من Supabase session ─────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // مستخدم Supabase حقيقي
    const { data: profile } = await supabase
      .from('users')
      .select('role, must_reset_password')
      .eq('id', user.id)
      .single()

    if (!profile) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (profile.must_reset_password && !path.startsWith('/change-password')) {
      return NextResponse.redirect(new URL('/change-password', request.url))
    }

    const allowedPrefix = ROLE_REDIRECT[profile.role]

    if (path === '/' || path === '/dashboard' && profile.role !== 'admin') {
      return NextResponse.redirect(new URL(allowedPrefix, request.url))
    }

    if (path.startsWith('/dashboard')) {
      const isAllowed =
        profile.role === 'admin' ||
        (profile.role === 'management' && path.startsWith('/dashboard/management')) ||
        (profile.role === 'teacher'    && path.startsWith('/dashboard/teacher'))    ||
        (profile.role === 'student'    && path.startsWith('/dashboard/student'))    ||
        (profile.role === 'parent'     && path.startsWith('/dashboard/parent'))

      if (!isAllowed) {
        return NextResponse.redirect(new URL(allowedPrefix, request.url))
      }
    }

    return supabaseResponse
  }

  // ── تحقق من الجلسة اليدوية (cookie) ─────────────────────────
  const manualSession = request.cookies.get('manual_session')?.value

  if (manualSession) {
    try {
      const sessionUser = JSON.parse(decodeURIComponent(manualSession))
      const role = sessionUser.role as string
      const allowedPrefix = ROLE_REDIRECT[role]

      if (!allowedPrefix) {
        const response = NextResponse.redirect(new URL('/login', request.url))
        response.cookies.delete('manual_session')
        return response
      }

      // التحقق من الصلاحية
      if (path === '/' || path === '/dashboard') {
        return NextResponse.redirect(new URL(allowedPrefix, request.url))
      }

      if (path.startsWith('/dashboard')) {
        const isAllowed =
          role === 'admin' ||
          (role === 'management' && path.startsWith('/dashboard/management')) ||
          (role === 'teacher'    && path.startsWith('/dashboard/teacher'))    ||
          (role === 'student'    && path.startsWith('/dashboard/student'))    ||
          (role === 'parent'     && path.startsWith('/dashboard/parent'))

        if (!isAllowed) {
          return NextResponse.redirect(new URL(allowedPrefix, request.url))
        }
      }

      return supabaseResponse
    } catch {
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('manual_session')
      return response
    }
  }

  // لا يوجد session — وجّه لتسجيل الدخول
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}