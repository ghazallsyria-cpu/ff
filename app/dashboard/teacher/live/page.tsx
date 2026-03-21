'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Video, VideoOff, Users, CheckCircle, XCircle, Clock, Play,
  Square, Upload, Link, Bell, ExternalLink, AlertTriangle,
  Loader2, BookOpen, Check, X, ChevronDown
} from 'lucide-react'
import { formatDateTime, DAYS_AR } from '@/lib/utils'

interface Session {
  id: string; status: string; session_date: string; period: number
  zoom_link: string; zoom_password?: string; started_at?: string
  ended_at?: string; expected_students: number; checked_in_count: number
  session_notes?: string; recording_url?: string
  subjects: { name: string }; sections: { name: string; classes: { name: string } }
}

interface CheckinStudent {
  student_id: string; full_name: string
  checked_in: boolean; status?: string; late_minutes?: number; checked_in_at?: string
}

const STATUS_AR: Record<string, string> = {
  scheduled: 'مجدولة', announced: 'تم الإعلان', live: '🔴 مباشرة', ended: 'انتهت', cancelled: 'ملغاة'
}
const STATUS_COLOR: Record<string, string> = {
  scheduled: 'bg-gray-100 text-gray-600', announced: 'bg-blue-100 text-blue-700',
  live: 'bg-red-100 text-red-700 animate-pulse', ended: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-400'
}

export default function TeacherLivePage() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [students, setStudents] = useState<CheckinStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [notes, setNotes] = useState('')
  const [recordingUrl, setRecordingUrl] = useState('')
  const [showRecording, setShowRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    loadSessions()
    // Real-time updates
    const ch = supabase.channel('teacher-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_checkins' }, () => {
        if (activeSession) loadStudents(activeSession.id)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch); clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    if (activeSession?.status === 'live' && activeSession.started_at) {
      const start = new Date(activeSession.started_at).getTime()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000))
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [activeSession?.status, activeSession?.started_at])

  async function loadSessions() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('live_sessions')
      .select('*, subjects(name), sections(name, classes(name))')
      .eq('session_date', today).order('period')
    setSessions((data || []) as any)
    setLoading(false)
    // Auto-select first live or scheduled
    const live = (data || []).find((s: any) => s.status === 'live')
    const scheduled = (data || []).find((s: any) => s.status === 'scheduled' || s.status === 'announced')
    if (live) selectSession(live as any)
    else if (scheduled) selectSession(scheduled as any)
  }

  async function loadStudents(sessionId: string) {
    // احضر كل طلاب الفصل مع حالة check-in
    const { data: session } = await supabase.from('live_sessions')
      .select('section_id').eq('id', sessionId).single()
    if (!session) return

    const [{ data: allStudents }, { data: checkins }] = await Promise.all([
      supabase.from('students').select('id, users(full_name)').eq('section_id', session.section_id),
      supabase.from('session_checkins').select('*').eq('session_id', sessionId)
    ])

    const checkinMap = new Map((checkins || []).map(c => [c.student_id, c]))
    const list: CheckinStudent[] = (allStudents || []).map((s: any) => {
      const c = checkinMap.get(s.id)
      return {
        student_id: s.id,
        full_name: s.users?.full_name || '',
        checked_in: !!c,
        status: c?.status,
        late_minutes: c?.late_minutes,
        checked_in_at: c?.checked_in_at
      }
    })
    setStudents(list.sort((a, b) => (b.checked_in ? 1 : 0) - (a.checked_in ? 1 : 0)))
  }

  function selectSession(s: Session) {
    setActiveSession(s)
    setNotes(s.session_notes || '')
    setRecordingUrl(s.recording_url || '')
    loadStudents(s.id)
  }

  async function generateSessions() {
    setActionLoading('generate')
    await supabase.rpc('generate_daily_sessions', { p_date: new Date().toISOString().split('T')[0] })
    await loadSessions()
    setActionLoading('')
  }

  async function announceSession(sessionId: string) {
    setActionLoading('announce-' + sessionId)
    await supabase.rpc('announce_upcoming_sessions')
    await loadSessions()
    setActionLoading('')
  }

  async function startSession(sessionId: string) {
    setActionLoading('start')
    const { data } = await supabase.rpc('teacher_start_session', { p_session_id: sessionId })
    if (data?.success) {
      await loadSessions()
      setActiveSession(prev => prev ? { ...prev, status: 'live', started_at: new Date().toISOString() } : prev)
    }
    setActionLoading('')
  }

  async function endSession(sessionId: string) {
    if (!confirm('هل أنت متأكد من إنهاء الجلسة؟ سيُسجَّل الغياب تلقائياً للطلاب الذين لم يسجلوا حضورهم.')) return
    setActionLoading('end')
    const { data } = await supabase.rpc('teacher_end_session', { p_session_id: sessionId, p_notes: notes || null })
    if (data?.success) {
      await loadSessions()
      setActiveSession(prev => prev ? { ...prev, status: 'ended' } : prev)
    }
    setActionLoading('')
  }

  async function saveRecording(sessionId: string) {
    if (!recordingUrl.trim()) return
    setActionLoading('recording')
    await supabase.from('session_recordings').insert({
      session_id: sessionId,
      teacher_id: (await supabase.auth.getUser()).data.user?.id,
      recording_url: recordingUrl.trim(),
      recording_type: recordingUrl.includes('zoom.us') ? 'zoom_cloud' :
        recordingUrl.includes('youtube') ? 'youtube' :
        recordingUrl.includes('drive') ? 'drive' : 'other',
      title: `تسجيل حصة ${(activeSession?.subjects as any)?.name} — ${activeSession?.session_date}`
    })
    await supabase.from('live_sessions').update({ recording_url: recordingUrl }).eq('id', sessionId)
    setActiveSession(prev => prev ? { ...prev, recording_url: recordingUrl } : prev)
    setShowRecording(false)
    setActionLoading('')
  }

  async function manualCheckin(studentId: string, present: boolean) {
    if (!activeSession) return
    if (present) {
      await supabase.from('session_checkins').upsert({
        session_id: activeSession.id, student_id: studentId,
        status: 'present', late_minutes: 0, checked_in_at: new Date().toISOString()
      }, { onConflict: 'session_id,student_id' })
    } else {
      await supabase.from('session_checkins').delete()
        .eq('session_id', activeSession.id).eq('student_id', studentId)
    }
    loadStudents(activeSession.id)
  }

  const formatElapsed = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  const presentCount = students.filter(s => s.checked_in).length
  const lateCount = students.filter(s => s.status === 'late').length
  const attendancePct = students.length > 0 ? Math.round(presentCount / students.length * 100) : 0

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Video className="w-7 h-7 text-blue-600" />الحصص المباشرة اليوم
          </h1>
          <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleDateString('ar-KW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={generateSessions} disabled={actionLoading === 'generate'}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
          {actionLoading === 'generate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          توليد جلسات اليوم
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
          <Video className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">لا توجد جلسات اليوم</p>
          <p className="text-gray-400 text-sm mt-1">اضغط "توليد جلسات اليوم" لإنشائها من جدولك</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sessions List */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">حصص اليوم ({sessions.length})</p>
            {sessions.map(s => (
              <div key={s.id} onClick={() => selectSession(s)}
                className={`bg-white rounded-2xl p-4 border-2 cursor-pointer transition-all shadow-sm hover:shadow-md ${activeSession?.id === s.id ? 'border-blue-500' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{(s.subjects as any)?.name}</p>
                    <p className="text-xs text-gray-400">{(s.sections as any)?.classes?.name} — شعبة {(s.sections as any)?.name}</p>
                    <p className="text-xs text-gray-400">الحصة {s.period}</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-xl ${STATUS_COLOR[s.status]}`}>
                    {STATUS_AR[s.status]}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{s.checked_in_count}/{s.expected_students} حاضر</span>
                  {s.recording_url && <span className="flex items-center gap-1 text-green-600"><Video className="w-3 h-3" />مسجّلة</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Active Session Panel */}
          {activeSession ? (
            <div className="lg:col-span-2 space-y-4">
              {/* Session Header */}
              <div className={`rounded-2xl p-5 border-2 ${activeSession.status === 'live' ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'} shadow-sm`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{(activeSession.subjects as any)?.name}</h2>
                    <p className="text-sm text-gray-500">{(activeSession.sections as any)?.classes?.name} — شعبة {(activeSession.sections as any)?.name} | الحصة {activeSession.period}</p>
                  </div>
                  <div className="text-center">
                    {activeSession.status === 'live' && (
                      <div className="text-2xl font-mono font-bold text-red-600">{formatElapsed(elapsed)}</div>
                    )}
                    <span className={`text-xs font-bold px-3 py-1 rounded-xl ${STATUS_COLOR[activeSession.status]}`}>
                      {STATUS_AR[activeSession.status]}
                    </span>
                  </div>
                </div>

                {/* Zoom Link */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3 mb-4">
                  <Video className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-blue-500 font-medium mb-0.5">رابط الحصة على Zoom</p>
                    <p className="text-sm text-blue-800 font-mono truncate">{activeSession.zoom_link}</p>
                    {activeSession.zoom_password && <p className="text-xs text-blue-400 mt-0.5">كلمة المرور: {activeSession.zoom_password}</p>}
                  </div>
                  <a href={activeSession.zoom_link} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4" />افتح Zoom
                  </a>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {(activeSession.status === 'scheduled' || activeSession.status === 'announced') && (
                    <>
                      <button onClick={() => announceSession(activeSession.id)}
                        disabled={!!actionLoading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-sm font-semibold">
                        <Bell className="w-4 h-4" />أرسل الرابط للطلاب
                      </button>
                      <button onClick={() => startSession(activeSession.id)}
                        disabled={actionLoading === 'start'}
                        className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold">
                        {actionLoading === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        ابدأ الجلسة رسمياً
                      </button>
                    </>
                  )}
                  {activeSession.status === 'live' && (
                    <button onClick={() => endSession(activeSession.id)}
                      disabled={actionLoading === 'end'}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold">
                      {actionLoading === 'end' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                      إنهاء الجلسة
                    </button>
                  )}
                  {(activeSession.status === 'ended' || activeSession.status === 'live') && (
                    <button onClick={() => setShowRecording(!showRecording)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold">
                      <Upload className="w-4 h-4" />
                      {activeSession.recording_url ? 'تحديث رابط التسجيل' : 'أضف رابط التسجيل'}
                    </button>
                  )}
                </div>

                {/* Recording input */}
                {showRecording && (
                  <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                    <p className="text-xs font-bold text-purple-700 mb-2">🎥 رابط تسجيل Zoom (Cloud Recording أو YouTube أو Drive)</p>
                    <div className="flex gap-2">
                      <input value={recordingUrl} onChange={e => setRecordingUrl(e.target.value)}
                        placeholder="https://zoom.us/rec/share/... أو https://youtu.be/..."
                        className="flex-1 border border-purple-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                      <button onClick={() => saveRecording(activeSession.id)} disabled={!recordingUrl.trim() || actionLoading === 'recording'}
                        className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60">
                        {actionLoading === 'recording' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {(activeSession.status === 'live' || activeSession.status === 'ended') && (
                  <div className="mt-3">
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                      placeholder="ملاحظات الحصة (تُحفظ عند الإنهاء)..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                  </div>
                )}
              </div>

              {/* Attendance Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { l: 'حاضر', v: presentCount, c: 'text-green-600', bg: 'bg-green-50', b: 'border-green-200' },
                  { l: 'متأخر', v: lateCount, c: 'text-yellow-600', bg: 'bg-yellow-50', b: 'border-yellow-200' },
                  { l: 'غائب', v: students.length - presentCount, c: 'text-red-600', bg: 'bg-red-50', b: 'border-red-200' },
                  { l: 'نسبة الحضور', v: `${attendancePct}%`, c: 'text-blue-600', bg: 'bg-blue-50', b: 'border-blue-200' },
                ].map(s => (
                  <div key={s.l} className={`${s.bg} border ${s.b} rounded-2xl p-3 text-center`}>
                    <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.l}</p>
                  </div>
                ))}
              </div>
              {/* Progress bar */}
              <div className="bg-white rounded-xl border border-gray-100 p-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">نسبة الحضور الفعلي</span>
                  <span className={`font-bold ${attendancePct >= 80 ? 'text-green-600' : attendancePct >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{attendancePct}%</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${attendancePct >= 80 ? 'bg-green-500' : attendancePct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${attendancePct}%` }} />
                </div>
              </div>

              {/* Students List */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />قائمة الطلاب ({students.length})
                  </h3>
                  <p className="text-xs text-gray-400">✅ = سجّل بنفسه  |  يمكنك التعديل يدوياً</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {students.map(s => (
                    <div key={s.student_id} className={`flex items-center gap-3 px-4 py-3 ${s.checked_in ? '' : 'bg-red-50/30'}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${s.checked_in ? (s.status === 'late' ? 'bg-yellow-500' : 'bg-green-500') : 'bg-gray-300'}`}>
                        {s.full_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">{s.full_name}</p>
                        <p className="text-xs text-gray-400">
                          {s.checked_in
                            ? (s.status === 'late' ? `⏰ متأخر ${s.late_minutes} دق` : '✅ حاضر')
                            : '❌ لم يسجّل'
                          }
                          {s.checked_in_at && ` — ${new Date(s.checked_in_at).toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                      {/* Manual override buttons */}
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => manualCheckin(s.student_id, true)}
                          className={`p-1.5 rounded-lg border transition-colors ${s.checked_in ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-400 hover:border-green-300 hover:text-green-600'}`}
                          title="حاضر">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => manualCheckin(s.student_id, false)}
                          className={`p-1.5 rounded-lg border transition-colors ${!s.checked_in ? 'bg-red-100 border-red-300 text-red-700' : 'bg-white border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-600'}`}
                          title="غائب">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
              <Video className="w-14 h-14 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400">اختر حصة من القائمة</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
