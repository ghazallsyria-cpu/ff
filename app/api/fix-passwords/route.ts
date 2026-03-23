export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const offset = parseInt(searchParams.get('offset') || '0')
  const limit = 20

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // جلب المستخدمين
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, role')
    .in('role', ['teacher', 'student', 'parent'])
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!users || users.length === 0) {
    return NextResponse.json({ message: '✅ اكتمل', done: true })
  }

  let success = 0
  const errors: string[] = []

  for (const user of users) {
    // استخدام REST API مباشرة بدلاً من Admin SDK
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${user.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          password: '123456',
          email_confirm: true,
        }),
      }
    )

    if (res.ok) {
      success++
    } else {
      const body = await res.json().catch(() => ({}))
      errors.push(`${user.email}: ${body?.msg || body?.message || res.status}`)
    }
  }

  return NextResponse.json({
    offset,
    processed: users.length,
    success,
    failed: users.length - success,
    first_error: errors[0] || null,
    next: users.length === limit
      ? `/api/fix-passwords?offset=${offset + limit}`
      : null,
    done: users.length < limit,
  })
}