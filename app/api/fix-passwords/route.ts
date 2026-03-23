export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const offset = parseInt(searchParams.get('offset') || '0')
  const limit = 50

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service Role Key مفقود' }, { status: 500 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // اختبار الصلاحيات أولاً
  const { data: testUser, error: testError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 })
  if (testError) {
    return NextResponse.json({ 
      error: 'فشل Admin API',
      details: testError.message,
      hint: 'تحقق من صحة SUPABASE_SERVICE_ROLE_KEY'
    }, { status: 500 })
  }

  // جلب المستخدمين
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, email, role')
    .in('role', ['teacher', 'student', 'parent'])
    .range(offset, offset + limit - 1)

  if (usersError || !users || users.length === 0) {
    return NextResponse.json({ message: '✅ اكتمل', done: true })
  }

  let success = 0
  const errors: string[] = []

  for (const user of users) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { 
        password: '123456',
        email_confirm: true
      }
    )
    if (error) {
      errors.push(`${user.email}: ${error.message}`)
    } else {
      success++
    }
  }

  return NextResponse.json({
    offset,
    processed: users.length,
    success,
    failed: users.length - success,
    sample_error: errors[0] || null,
    next: users.length === limit 
      ? `/api/fix-passwords?offset=${offset + limit}` 
      : null,
    done: users.length < limit
  })
}