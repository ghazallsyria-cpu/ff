export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { nationalId, password } = await request.json()

  if (!nationalId || !password) {
    return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // تحقق من كلمة المرور يدوياً عبر الدالة
  const { data: users, error } = await supabaseAdmin
    .rpc('verify_password', {
      p_national_id: nationalId.trim(),
      p_password: password,
    })

  if (error || !users || users.length === 0) {
    return NextResponse.json(
      { error: 'الرقم المدني أو كلمة المرور غير صحيحة' },
      { status: 401 }
    )
  }

  const user = users[0]

  // أنشئ session عبر magic link (يتجاوز GoTrue lookup)
  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.user_email,
      options: { redirectTo: '/' },
    })

  if (linkError || !linkData) {
    // fallback: أرجع بيانات المستخدم فقط بدون session
    return NextResponse.json({
      success: true,
      user: {
        id: user.user_id,
        email: user.user_email,
        role: user.user_role,
        name: user.user_name,
      },
      method: 'manual',
    })
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.user_id,
      email: user.user_email,
      role: user.user_role,
      name: user.user_name,
    },
    token: linkData.properties?.hashed_token,
    method: 'magic',
  })
}
