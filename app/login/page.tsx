import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, GraduationCap, Loader2, CreditCard } from 'lucide-react'

const ROLE_REDIRECT: Record<string, string> = {
  admin:      '/dashboard',
  management: '/dashboard/management',
  teacher:    '/dashboard/teacher',
  student:    '/dashboard/student',
  parent:     '/dashboard/parent',
}

export default function LoginPage() {
  const router = useRouter()
  const [loginId, setLoginId]   = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const input = loginId.trim()
    const supabase = createClient()

    // ── المدير يدخل بالإيميل الكامل ──────────────────────────────
    if (input.includes('@')) {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: input,
        password,
      })
      if (authError || !data.user) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
        setLoading(false)
        return
      }
      const { data: profile } = await supabase
        .from('users')
        .select('role, must_reset_password')
        .eq('id', data.user.id)
        .maybeSingle()
      if (profile?.must_reset_password) { router.push('/change-password'); return }
      router.push(ROLE_REDIRECT[profile?.role ?? 'student'])
      router.refresh()
      return
    }

    // ── المعلمون والطلاب وأولياء الأمور ─────────────────────────
    // أولاً: جرب الطريقة العادية
    const email = `${input}@alrefaa.edu`
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password })

    if (!authError && authData.user) {
      // نجحت الطريقة العادية
      await new Promise(r => setTimeout(r, 400))
      const { data: profile } = await supabase
        .from('users')
        .select('role, must_reset_password')
        .eq('id', authData.user.id)
        .maybeSingle()
      if (profile?.must_reset_password) { router.push('/change-password'); return }
      router.push(ROLE_REDIRECT[profile?.role ?? 'student'])
      router.refresh()
      return
    }

    // ثانياً: جرب الـ API المخصص (للمستخدمين المنشأين بـ SQL)
    const res = await fetch('/api/auth-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nationalId: input, password }),
    })

    if (!res.ok) {
      setError('الرقم المدني أو كلمة المرور غير صحيحة')
      setLoading(false)
      return
    }

    const result = await res.json()
    if (!result.success) {
      setError('الرقم المدني أو كلمة المرور غير صحيحة')
      setLoading(false)
      return
    }

    // حفظ بيانات المستخدم في sessionStorage مؤقتاً
    sessionStorage.setItem('manual_user', JSON.stringify({
      id:   result.user.id,
      role: result.user.role,
      name: result.user.name,
      email: result.user.email,
    }))

    router.push(ROLE_REDIRECT[result.user.role] ?? '/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur rounded-2xl mb-4 border border-white/20">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">مدرسة الرفعة النموذجية</h1>
          <p className="text-blue-200 mt-2">نظام إدارة المدرسة الإلكتروني</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">تسجيل الدخول</h2>
          <p className="text-gray-500 text-sm text-center mb-6">أدخل رقمك المدني وكلمة المرور</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الرقم المدني</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={loginId}
                  onChange={e => setLoginId(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-11 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-lg"
                  placeholder="أدخل رقمك المدني"
                  maxLength={50}
                />
                <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 pl-11 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="كلمة المرور الافتراضية: 123456"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm text-center">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || loginId.length < 3}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />جاري الدخول...</> : 'دخول'}
            </button>
          </form>

          <div className="mt-6 bg-blue-50 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-700 text-center">
              كلمة المرور الافتراضية للجميع: <span className="font-bold tracking-widest">123456</span>
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">جميع الحقوق محفوظة © مدرسة الرفعة النموذجية 2026</p>
          </div>
        </div>
      </div>
    </div>
  )
}
