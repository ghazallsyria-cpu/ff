'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Heart, MessageSquare, BookOpen, Send, CheckCircle, Loader2, TrendingUp } from 'lucide-react'

const MOODS = [
  { score: 1, emoji: '😢', label: 'سيء جداً',  color: '#dc2626', bg: '#fef2f2' },
  { score: 2, emoji: '😕', label: 'سيء',        color: '#f97316', bg: '#fff7ed' },
  { score: 3, emoji: '😐', label: 'عادي',       color: '#eab308', bg: '#fefce8' },
  { score: 4, emoji: '🙂', label: 'جيد',        color: '#22c55e', bg: '#f0fdf4' },
  { score: 5, emoji: '😄', label: 'ممتاز!',     color: '#3b82f6', bg: '#eff6ff' },
]

const REQUEST_TYPES = [
  { value: 'academic',   label: '📚 مشكلة أكاديمية',    desc: 'صعوبة في مادة أو واجب' },
  { value: 'emotional',  label: '💙 دعم نفسي',          desc: 'تحتاج أحداً يسمعك' },
  { value: 'family',     label: '👨‍👩‍👧 مشكلة أسرية',       desc: 'ظروف تؤثر على دراستك' },
  { value: 'bullying',   label: '🛡️ تنمر أو مضايقة',    desc: 'شيء يزعجك من زملائك' },
  { value: 'other',      label: '💬 أخرى',               desc: 'أي شيء تريد مشاركته' },
]

export default function StudentWellbeingPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'checkin' | 'journal' | 'request' | 'history'>('checkin')
  const [todayCheckin, setTodayCheckin] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [journalEntries, setJournalEntries] = useState<any[]>([])
  const [myRequests, setMyRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  // Check-in form
  const [selectedMood, setSelectedMood] = useState<number | null>(null)
  const [studentNote, setStudentNote] = useState('')

  // Journal form
  const [journalContent, setJournalContent] = useState('')
  const [journalMood, setJournalMood] = useState<number | null>(null)

  // Request form
  const [reqType, setReqType] = useState('')
  const [reqMessage, setReqMessage] = useState('')
  const [reqUrgency, setReqUrgency] = useState('normal')
  const [reqAnonymous, setReqAnonymous] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const today = new Date().toISOString().split('T')[0]
    const [{ data: ci }, { data: hist }, { data: journal }, { data: reqs }] = await Promise.all([
      supabase.from('wellbeing_checkins').select('*').eq('checkin_date', today).maybeSingle(),
      supabase.from('wellbeing_checkins').select('*').order('checkin_date', { ascending: false }).limit(14),
      supabase.from('student_journal').select('*').order('entry_date', { ascending: false }).limit(10),
      supabase.from('support_requests').select('*').order('created_at', { ascending: false }).limit(5),
    ])
    setTodayCheckin(ci)
    if (ci) { setSelectedMood(ci.mood_score); setStudentNote(ci.student_note || '') }
    setHistory(hist || [])
    setJournalEntries(journal || [])
    setMyRequests(reqs || [])
    setLoading(false)
  }

  async function saveCheckin() {
    if (!selectedMood) return
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('wellbeing_checkins').upsert({
      student_id: user.id, checkin_date: today,
      mood_score: selectedMood,
      mood_emoji: MOODS[selectedMood - 1].emoji,
      student_note: studentNote.trim() || null,
    }, { onConflict: 'student_id,checkin_date' })
    setSavedMsg('تم حفظ حالتك اليوم ✅')
    setTimeout(() => setSavedMsg(''), 3000)
    setSaving(false)
    load()
  }

  async function saveJournal() {
    if (!journalContent.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('student_journal').insert({
      student_id: user.id, content: journalContent.trim(),
      mood_score: journalMood, is_private: true,
    })
    setJournalContent('')
    setJournalMood(null)
    setSavedMsg('تم حفظ ملاحظتك 🔒')
    setTimeout(() => setSavedMsg(''), 3000)
    setSaving(false)
    load()
  }

  async function sendRequest() {
    if (!reqType || !reqMessage.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('support_requests').insert({
      student_id: user.id, request_type: reqType,
      message: reqMessage.trim(), urgency: reqUrgency,
      is_anonymous: reqAnonymous,
    })
    setReqType(''); setReqMessage(''); setReqUrgency('normal'); setReqAnonymous(false)
    setSavedMsg('تم إرسال طلب الدعم ✅ سيتواصل معك أحد المسؤولين قريباً')
    setTimeout(() => setSavedMsg(''), 5000)
    setSaving(false)
    load()
  }

  const avgMood = history.length > 0 ? (history.reduce((a, c) => a + c.mood_score, 0) / history.length).toFixed(1) : null
  const moodTrend = history.length >= 3 ?
    history[0].mood_score > history[2].mood_score ? '↗️ تحسّن' :
    history[0].mood_score < history[2].mood_score ? '↘️ تراجع' : '→ مستقر'
    : null

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Heart className="w-7 h-7 text-pink-500" />مساحتك الشخصية</h1>
        <p className="text-gray-500 text-sm mt-1">هنا يمكنك التعبير عن حالتك بأمان تام 💙</p>
      </div>

      {savedMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-2xl px-4 py-3 text-sm font-medium flex items-center gap-2 mb-4">
          <CheckCircle className="w-4 h-4" />{savedMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 bg-gray-100 p-1 rounded-2xl">
        {[
          { k: 'checkin', l: '😊 كيف حالك اليوم؟' },
          { k: 'journal', l: '📓 مذكرتي' },
          { k: 'request', l: '💙 أحتاج مساعدة' },
          { k: 'history', l: '📊 سجلي' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${tab === t.k ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* CHECK-IN */}
      {tab === 'checkin' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {todayCheckin && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-5 text-sm text-green-800 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />سجّلت حالتك اليوم — يمكنك التحديث
            </div>
          )}
          <h2 className="font-bold text-gray-800 text-lg mb-2 text-center">كيف تشعر اليوم؟</h2>
          <p className="text-gray-400 text-sm text-center mb-6">لا أحد يراها إلا إذا احتجت مساعدة</p>

          <div className="grid grid-cols-5 gap-3 mb-6">
            {MOODS.map(m => (
              <button key={m.score} onClick={() => setSelectedMood(m.score)}
                style={{ background: selectedMood === m.score ? m.bg : '#f9fafb', borderColor: selectedMood === m.score ? m.color : '#e5e7eb' }}
                className="flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all hover:scale-105">
                <span className="text-3xl">{m.emoji}</span>
                <span style={{ color: selectedMood === m.score ? m.color : '#9ca3af' }} className="text-xs font-medium">{m.label}</span>
              </button>
            ))}
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">هل تريد إضافة ملاحظة؟ (اختياري)</label>
            <textarea value={studentNote} onChange={e => setStudentNote(e.target.value)} rows={3}
              placeholder="ما الذي يشغل بالك اليوم؟ — لا أحد يقرأ هذا إلا إذا طلبت المساعدة"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none" />
          </div>

          <button onClick={saveCheckin} disabled={!selectedMood || saving}
            className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
            حفظ حالتي اليوم
          </button>
        </div>
      )}

      {/* JOURNAL */}
      {tab === 'journal' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-5 h-5 text-yellow-500" />
              <h2 className="font-bold text-gray-800">مذكرتي السرية 🔒</h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">لا يستطيع أحد قراءة ما تكتبه هنا — هذه مساحتك الخاصة</p>
            <div className="flex gap-2 mb-3">
              {MOODS.map(m => (
                <button key={m.score} onClick={() => setJournalMood(m.score)}
                  className={`text-xl rounded-xl p-1.5 transition-all border-2 ${journalMood === m.score ? 'border-gray-300 scale-110' : 'border-transparent'}`}>
                  {m.emoji}
                </button>
              ))}
            </div>
            <textarea value={journalContent} onChange={e => setJournalContent(e.target.value)} rows={5}
              placeholder="اكتب ما في قلبك... شيء جميل حدث اليوم، أو شيء يضغط عليك. هذه المساحة لك وحدك."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300 resize-none mb-3" />
            <button onClick={saveJournal} disabled={!journalContent.trim() || saving}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}حفظ في مذكرتي
            </button>
          </div>
          <div className="space-y-3">
            {journalEntries.map((e, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">{new Date(e.entry_date).toLocaleDateString('ar-KW')}</span>
                  {e.mood_score && <span className="text-lg">{MOODS[e.mood_score - 1].emoji}</span>}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{e.content}</p>
              </div>
            ))}
            {journalEntries.length === 0 && <p className="text-center text-gray-400 text-sm py-6">لا توجد مذكرات بعد — ابدأ الكتابة الآن</p>}
          </div>
        </div>
      )}

      {/* SUPPORT REQUEST */}
      {tab === 'request' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1"><MessageSquare className="w-5 h-5 text-blue-500" />
            <h2 className="font-bold text-gray-800">أحتاج مساعدة</h2>
          </div>
          <p className="text-xs text-gray-400 mb-5">طلبك سيصل لمشرف مدرستك — يمكنك الإرسال باسم مجهول</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">نوع المساعدة المطلوبة *</label>
              <div className="space-y-2">
                {REQUEST_TYPES.map(rt => (
                  <label key={rt.value} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${reqType === rt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                    <input type="radio" name="reqType" value={rt.value} checked={reqType === rt.value}
                      onChange={() => setReqType(rt.value)} className="mt-1" />
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{rt.label}</p>
                      <p className="text-xs text-gray-400">{rt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اشرح ما تحتاجه *</label>
              <textarea value={reqMessage} onChange={e => setReqMessage(e.target.value)} rows={4}
                placeholder="اكتب ما تشعر به أو ما تحتاج المساعدة فيه..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">مستوى الأهمية</label>
                <select value={reqUrgency} onChange={e => setReqUrgency(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none">
                  <option value="low">🟢 غير مستعجل</option>
                  <option value="normal">🟡 عادي</option>
                  <option value="high">🟠 مهم</option>
                  <option value="urgent">🔴 عاجل جداً</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={reqAnonymous} onChange={e => setReqAnonymous(e.target.checked)} className="rounded" />
                <span className="text-sm text-gray-600">إرسال باسم مجهول</span>
              </label>
            </div>
            <button onClick={sendRequest} disabled={!reqType || !reqMessage.trim() || saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}إرسال طلب المساعدة
            </button>
          </div>
          {myRequests.length > 0 && (
            <div className="mt-5 border-t pt-4">
              <p className="text-xs font-bold text-gray-500 mb-3">طلباتي السابقة</p>
              {myRequests.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <p className="text-sm text-gray-700 truncate flex-1">{r.message.substring(0, 50)}...</p>
                  <span className={`text-xs px-2 py-0.5 rounded-lg font-medium mr-2 ${r.status === 'resolved' ? 'bg-green-100 text-green-700' : r.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.status === 'pending' ? 'قيد الانتظار' : r.status === 'in_progress' ? 'قيد المعالجة' : 'تم الحل'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* HISTORY */}
      {tab === 'history' && (
        <div className="space-y-4">
          {avgMood && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
                <p className="text-3xl mb-1">{MOODS[Math.round(parseFloat(avgMood)) - 1]?.emoji}</p>
                <p className="text-2xl font-bold text-gray-800">{avgMood}</p>
                <p className="text-xs text-gray-400">متوسط حالتك (14 يوم)</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
                <TrendingUp className="w-8 h-8 mx-auto text-blue-500 mb-1" />
                <p className="text-xl font-bold text-gray-800">{moodTrend}</p>
                <p className="text-xs text-gray-400">اتجاه حالتك</p>
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b"><p className="font-bold text-gray-800 text-sm">سجل الأيام الأخيرة</p></div>
            {history.length === 0
              ? <p className="text-center text-gray-400 py-8 text-sm">ابدأ بتسجيل حالتك يومياً</p>
              : history.map((h, i) => {
                const mood = MOODS[h.mood_score - 1]
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                    <span className="text-xl flex-shrink-0">{mood.emoji}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: mood.color }}>{mood.label}</p>
                      {h.student_note && <p className="text-xs text-gray-400 truncate">{h.student_note}</p>}
                    </div>
                    <span className="text-xs text-gray-300">{new Date(h.checkin_date).toLocaleDateString('ar-KW')}</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
