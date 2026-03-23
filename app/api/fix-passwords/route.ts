export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const offset = parseInt(searchParams.get('offset') || '0')
  const limit = 50

  // تحقق من وجود الـ key
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ 
      error: 'SUPABASE_SERVICE_ROLE_KEY غير موجود في Environment Variables' 
    }, { status: 500 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // جلب دفعة واحدة فقط
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, email, role')
    .in('role', ['teacher', 'student', 'parent'])
    .range(offset, offset + limit - 1)

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 })
  }

  if (!users || users.length === 0) {
    return NextResponse.json({ message: '✅ اكتمل — لا يوجد المزيد', done: true })
  }

  let success = 0
  let failed = 0

  for (const user of users) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: '123456' }
    )
    if (error) failed++
    else success++
  }

  return NextResponse.json({
    offset,
    processed: users.length,
    success,
    failed,
    next: users.length === limit 
      ? `/api/fix-passwords?offset=${offset + limit}` 
      : null,
    done: users.length < limit
  })
}