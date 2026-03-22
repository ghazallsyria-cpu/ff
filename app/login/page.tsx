'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, GraduationCap, Loader2, IdCard } from 'lucide-react'

const ROLE_REDIRECT: Record<string, string> = {
  admin:      '/dashboard',
  management: '/dashboard/management',
  teacher:    '/dashboard/teacher',
  student:    '/dashboard/student',
  parent:     '/dashboard/parent',
}

export default function LoginPage() {
  const router = useRouter()
  const [nationalId, setNationalId] = useState('')
  const [password, setPassword]     = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const email = `${nationalId.trim()}@alrefaa.edu`

    // ── 1. تسجيل الدخول بالرقم المدني ──────────────────────────
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password })

    if (authError || !authData.user) {
      setError('الرقم المدني أو كلمة المرور غير صحيحة')
      setLoading(false)
      return
    }

    // ── 2. انتظر اكتمال الـ session ─────────────────────────────
    await new Promise(r => setTimeout(r, 500))

    // ── 3. اقرأ الملف الشخصي مع إعادة المحاولة ──────────────────
    let profile: { role: string; must_reset_password: boolean } | null = null
    for (let i = 0; i < 4; i++) {
      const { data } = await supabase
        .from('users')
        .select('role, must_reset_password')
        .eq('id', authData.user.id)
        .maybeSingle()
      if (data) { profile = data; break }
      await new Promise(r => setTimeout(r, 600))
    }

    if (!profile) {
      setError('تعذّر تحميل بيانات المستخدم. أعد المحاولة.')
      setLoading(false)
      return
    }

    // ── 4. توجيه حسب الحالة ─────────────────────────────────────
    if (profile.must_reset_password) {
      // عرض صفحة خيار تغيير كلمة المرور
      router.push('/change-password')
      return
    }

    router.push(ROLE_REDIRECT[profile.role] ?? '/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">

        {/* الشعار */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur rounded-2xl mb-4 border border-white/20">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">مدرسة الرفعة النموذجية</h1>
          <p className="text-blue-200 mt-2">نظام إدارة المدرسة الإلكتروني</p>
        </div>

        {/* البطاقة */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">تسجيل الدخول</h2>
          <p className="text-gray-500 text-sm text-center mb-6">
            أدخل رقمك المدني وكلمة المرور
          </p>

          <form onSubmit={handleLogin} className="space-y-5">

            {/* الرقم المدني */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الرقم المدني
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={nationalId}
                  onChange={e => setNationalId(e.target.value.replace(/\D/g, ''))}
                  required
                  autoComplete="username"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-11 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent tracking-widest text-lg"
                  placeholder="أدخل رقمك المدني"
                  maxLength={16}
                />
                <IdCard className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>

            {/* كلمة المرور */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 pl-11 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="كلمة المرور الافتراضية: 123456"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* رسالة الخطأ */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm text-center">
                {error}
              </div>
            )}

            {/* زر الدخول */}
            <button
              type="submit"
              disabled={loading || nationalId.length < 6}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading
                ? <><Loader2 className="w-5 h-5 animate-spin" />جاري الدخول...</>
                : 'دخول'}
            </button>
          </form>

          {/* تلميح */}
          <div className="mt-6 bg-blue-50 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-700 text-center">
              كلمة المرور الافتراضية للجميع: <span className="font-bold tracking-widest">123456</span>
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              جميع الحقوق محفوظة © مدرسة الرفعة النموذجية 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}