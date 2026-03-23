export const dynamic = 'force-dynamic'
export const maxDuration = 15

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { nationalId, password } = await request.json()

    if (!nationalId || !password) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // التحقق من كلمة المرور عبر الدالة
    const { data, error } = await supabase.rpc('verify_password', {
      p_national_id: nationalId.trim(),
      p_password:    password,
    })

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'الرقم المدني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      )
    }

    const user = data[0]

    return NextResponse.json({
      success: true,
      user: {
        id:    user.user_id,
        email: user.user_email,
        role:  user.user_role,
        name:  user.user_name,
      },
    })

  } catch {
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}