'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, KeyRound, Video, Save, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { ROLE_AR } from '@/lib/utils'

export default function ProfilePage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [teacher, setTeacher] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'info'|'password'|'zoom'>('info')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')

  // Info fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [zoomLink, setZoomLink] = useState('')

  // Password fields
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [passError, setPassError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('users').select('*').eq('id', user.id).single()
      setProfile(p)
      setFullName(p?.full_name || '')
      setPhone(p?.phone || '')
      if (p?.role === 'teacher') {
        const { data: t } = await supabase.from('teachers').select('*').eq('id', user.id).single()
        setTeacher(t)
        setZoomLink(t?.zoom_link || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function saveInfo() {
    if (!fullName.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('users').update({ full_name: fullName.trim(), phone: phone.trim() || null, updated_at: new Date().toISOString() }).eq('id', user!.id)
    setSaved('info'); setSaving(false)
    setTimeout(() => setSaved(''), 3000)
  }

  async function savePassword() {
    setPassError('')
    if (newPass.length < 8) { setPassError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return }
    if (newPass !== confirmPass) { setPassError('كلمتا المرور غير متطابقتين'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    if (error) { setPassError('حدث خطأ، تأكد من كلمة المرور الحالية'); setSaving(false); return }
    await supabase.from('users').update({ must_reset_password: false }).eq('id', profile.id)
    setCurrentPass(''); setNewPass(''); setConfirmPass('')
    setSaved('pass'); setSaving(false)
    setTimeout(() => setSaved(''), 3000)
  }

  async function saveZoom() {
    setSaving(true)
    await supabase.from('teachers').update({ zoom_link: zoomLink.trim() || null }).eq('id', profile.id)
    setSaved('zoom'); setSaving(false)
    setTimeout(() => setSaved(''), 3000)
  }

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>

  const isTeacher = profile?.role === 'teacher'
  const isStudent = profile?.role === 'student'

  const tabs = [
    ...(isTeacher ? [{ k:'info', l:'المعلومات الشخصية', i: User }] : []),
    { k:'password', l:'كلمة المرور', i: KeyRound },
    ...(isTeacher ? [{ k:'zoom', l:'رابط Zoom', i: Video }] : []),
  ]

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">ملفي الشخصي</h1>
        <p className="text-gray-500 text-sm mt-1">{ROLE_AR[profile?.role]}</p>
      </div>

      {/* Avatar Card */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 mb-6 text-white flex items-center gap-4">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-bold">
          {profile?.full_name?.charAt(0)}
        </div>
        <div>
          <p className="text-xl font-bold">{profile?.full_name}</p>
          <p className="text-blue-200">{profile?.email}</p>
          <p className="text-sm text-blue-300 mt-0.5">{ROLE_AR[profile?.role]}</p>
        </div>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="flex gap-2 mb-5">
          {tabs.map(t => (
            <button key={t.k} onClick={() => setTab(t.k as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${tab===t.k?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              <t.i size={16} />{t.l}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {/* INFO TAB (Teacher only) */}
        {tab==='info' && isTeacher && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><User className="w-5 h-5 text-blue-600"/>المعلومات الشخصية</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل *</label>
              <input value={fullName} onChange={e=>setFullName(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
              <input value={phone} onChange={e=>setPhone(e.target.value)} type="tel"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="05xxxxxxxx" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
              <input value={profile?.email} disabled className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-500" />
              <p className="text-xs text-gray-400 mt-1">لا يمكن تغيير البريد الإلكتروني</p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={saveInfo} disabled={saving || !fullName.trim()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60">
                {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}حفظ التغييرات
              </button>
              {saved==='info'&&<span className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><CheckCircle className="w-4 h-4"/>تم الحفظ!</span>}
            </div>
          </div>
        )}

        {/* PASSWORD TAB */}
        {tab==='password' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><KeyRound className="w-5 h-5 text-blue-600"/>تغيير كلمة المرور</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الجديدة *</label>
              <div className="relative">
                <input type={showPass?'text':'password'} value={newPass} onChange={e=>setNewPass(e.target.value)} minLength={8}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="8 أحرف على الأقل"/>
                <button type="button" onClick={()=>setShowPass(!showPass)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass?<EyeOff size={18}/>:<Eye size={18}/>}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">تأكيد كلمة المرور *</label>
              <input type={showPass?'text':'password'} value={confirmPass} onChange={e=>setConfirmPass(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أعد كتابة كلمة المرور"/>
            </div>
            {passError&&<div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{passError}</div>}
            <div className="flex items-center gap-3 pt-2">
              <button onClick={savePassword} disabled={saving||!newPass||!confirmPass}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60">
                {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}تغيير كلمة المرور
              </button>
              {saved==='pass'&&<span className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><CheckCircle className="w-4 h-4"/>تم التغيير!</span>}
            </div>
          </div>
        )}

        {/* ZOOM TAB (Teacher only) */}
        {tab==='zoom' && isTeacher && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Video className="w-5 h-5 text-blue-600"/>رابط Zoom الخاص بك</h2>
            <p className="text-sm text-gray-500">سيظهر هذا الرابط للطلاب وأولياء الأمور في الجدول الدراسي.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رابط غرفة Zoom</label>
              <input value={zoomLink} onChange={e=>setZoomLink(e.target.value)} type="url"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://zoom.us/j/xxxxxxxxx"/>
            </div>
            {zoomLink && (
              <a href={zoomLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
                <Video size={16}/>اختبار الرابط
              </a>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button onClick={saveZoom} disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60">
                {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}حفظ الرابط
              </button>
              {saved==='zoom'&&<span className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><CheckCircle className="w-4 h-4"/>تم الحفظ!</span>}
            </div>
          </div>
        )}

        {/* Student only sees password */}
        {isStudent && tab !== 'password' && (() => { setTab('password'); return null })()}
      </div>
    </div>
  )
}
