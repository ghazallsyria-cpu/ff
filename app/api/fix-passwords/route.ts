import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// هذا الـ route يستخدم Service Role Key لتحديث كلمات المرور
// شغّله مرة واحدة فقط ثم احذفه

export async function GET() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // جلب كل المستخدمين من public.users
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, email, role')
    .in('role', ['teacher', 'student', 'parent'])

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 })
  }

  let success = 0
  let failed = 0
  const errors: string[] = []

  // تحديث كلمة المرور لكل مستخدم عبر Admin API
  for (const user of users || []) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: '123456' }
    )

    if (error) {
      failed++
      errors.push(`${user.email}: ${error.message}`)
    } else {
      success++
    }
  }

  return NextResponse.json({
    message: 'تم الانتهاء',
    total: users?.length,
    success,
    failed,
    errors: errors.slice(0, 10), // أول 10 أخطاء فقط
  })
}