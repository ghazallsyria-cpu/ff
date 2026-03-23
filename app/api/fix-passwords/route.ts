export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const offset = parseInt(searchParams.get('offset') || '0')
  const limit  = 10

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // جلب المستخدمين من public.users
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .in('role', ['teacher', 'student', 'parent'])
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!users || users.length === 0) {
    return NextResponse.json({ message: '✅ اكتمل', done: true })
  }

  let success = 0
  const errors: string[] = []

  for (const user of users) {
    try {
      // 1. احذف المستخدم من auth.users
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      })

      // 2. أعد إنشاءه بشكل صحيح عبر Admin API
      const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          email: user.email,
          password: '123456',
          email_confirm: true,
          user_metadata: { full_name: user.full_name },
          app_metadata:  { provider: 'email', providers: ['email'] },
        }),
      })

      const created = await createRes.json()

      if (!createRes.ok) {
        errors.push(`${user.email}: ${created?.msg || created?.message || createRes.status}`)
        continue
      }

      const newId = created.id

      // 3. حدّث public.users بالـ ID الجديد
      if (newId && newId !== user.id) {
        await supabase
          .from('users')
          .update({ id: newId })
          .eq('id', user.id)
      }

      success++
    } catch (e: unknown) {
      errors.push(`${user.email}: ${e instanceof Error ? e.message : 'unknown'}`)
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