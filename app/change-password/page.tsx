'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  KeyRound, CheckCircle, ArrowLeft,
  Eye, EyeOff, Loader2, ShieldCheck, SkipForward
} from 'lucide-react'

const ROLE_REDIRECT: Record<string, string> = {
  admin:      '/dashboard',
  management: '/dashboard/management',
  teacher:    '/dashboard/teacher',
  student:    '/dashboard/student',
  parent:     '/dashboard/parent',
}

type Step = 'choice' | 'change' | 'done'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [step, setStep]           = useState<Step>('choice')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [showConf, setShowConf]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  // ── تخطي تغيير كلمة المرور ──────────────────────────────────
  async function handleSkip() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    await supabase
      .from('users')
      .update({ must_reset_password: false })
      .eq('id', user.id)

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    router.push(ROLE_REDIRECT[profile?.role ?? 'student'])
    router.refresh()
  }

  // ── حفظ كلمة المرور الجديدة ─────────────────────────────────
  async function handleChange(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('يجب أن تكون كلمة المرور 6 أحرف على الأقل')
      return
    }
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }
    if (password === '123456') {
      setError('يُرجى اختيار كلمة مرور مختلفة عن الافتراضية')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) {
      setError('حدث خطأ أثناء الحفظ، حاول مجدداً')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    await supabase
      .from('users')
      .update({ must_reset_password: false })
      .eq('id', user.id)

    setStep('done')
    setLoading(false)

    // انتقل للداشبورد بعد ثانيتين
    setTimeout(async () => {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      router.push(ROLE_REDIRECT[profile?.role ?? 'student'])
      router.refresh()
    }, 2000)
  }

  // ── شاشة الاختيار ───────────────────────────────────────────
  if (step === 'choice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md">

          {/* الترحيب */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur rounded-2xl mb-4 border border-white/20">
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">مرحباً بك!</h1>
            <p className="text-blue-200 mt-2 text-sm">
              هذه أول مرة تدخل فيها للنظام
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-lg font-bold text-gray-800 text-center mb-2">
              هل تريد تغيير كلمة المرور؟
            </h2>
            <p className="text-gray-500 text-sm text-center mb-7">
              يمكنك الاحتفاظ بكلمة المرور الافتراضية{' '}
              <span className="font-bold text-gray-700">123456</span>{' '}
              أو تعيين كلمة مرور خاصة بك
            </p>

            <div className="space-y-3">
              {/* زر التغيير */}
              <button
                onClick={() => setStep('change')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-3 text-base"
              >
                <KeyRound className="w-5 h-5" />
                نعم، أريد تغيير كلمة المرور
              </button>

              {/* زر التخطي */}
              <button
                onClick={handleSkip}
                disabled={loading}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-3 text-base disabled:opacity-60"
              >
                {loading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <SkipForward className="w-5 h-5" />
                }
                لا، سأبقي كلمة المرور كما هي
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center mt-5">
              يمكنك تغيير كلمة المرور لاحقاً من إعدادات الحساب
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── شاشة تغيير كلمة المرور ──────────────────────────────────
  if (step === 'change') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md">

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur rounded-2xl mb-4 border border-white/20">
              <KeyRound className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">تعيين كلمة مرور جديدة</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">

            <form onSubmit={handleChange} className="space-y-5">

              {/* كلمة المرور الجديدة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 pl-11 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="6 أحرف على الأقل"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* تأكيد كلمة المرور */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  تأكيد كلمة المرور
                </label>
                <div className="relative">
                  <input
                    type={showConf ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 pl-11 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="أعد كتابة كلمة المرور"
                  />
                  <button type="button" onClick={() => setShowConf(!showConf)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConf ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* مؤشر قوة كلمة المرور */}
              {password && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                        password.length >= i * 3
                          ? i <= 1 ? 'bg-red-400'
                          : i <= 2 ? 'bg-yellow-400'
                          : i <= 3 ? 'bg-blue-400'
                          : 'bg-green-500'
                          : 'bg-gray-200'
                      }`} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    {password.length < 6 ? 'ضعيفة جداً'
                     : password.length < 9 ? 'مقبولة'
                     : password.length < 12 ? 'جيدة'
                     : 'قوية جداً ✓'}
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || password.length < 6}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading
                  ? <><Loader2 className="w-5 h-5 animate-spin" />جاري الحفظ...</>
                  : 'حفظ كلمة المرور والمتابعة'}
              </button>

              {/* الرجوع للخيار */}
              <button
                type="button"
                onClick={() => { setStep('choice'); setError(''); setPassword(''); setConfirm('') }}
                className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 text-sm py-2"
              >
                <ArrowLeft className="w-4 h-4" />
                رجوع
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ── شاشة النجاح ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-emerald-900 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-5">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">تم بنجاح!</h2>
        <p className="text-gray-500">
          تم حفظ كلمة المرور الجديدة بنجاح.
          <br />جاري تحويلك إلى لوحة التحكم...
        </p>
        <div className="mt-5 flex justify-center">
          <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
        </div>
      </div>
    </div>
  )
}
