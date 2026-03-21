'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Video, CheckCircle, Clock, Play, ExternalLink, Loader2, BookOpen, Film, Eye } from 'lucide-react'

interface Session {
  id: string; status: string; session_date: string; period: number
  zoom_link: string; zoom_password?: string; started_at?: string
  subjects: { name: string }; sections: { name: string; classes: { name: string } }
  checked_in_count: number; expected_students: number
}

interface Recording {
  id: string; recording_url: string; recording_type: string
  title: string; duration_minutes?: number; created_at: string
  live_sessions: { subjects: { name: string }; session_date: string; period: number }
  recording_views: { completed: boolean }[]
}

export default function StudentLivePage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'today' | 'recordings'>('today')
  const [sessions, setSessions] = useState<Session[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [checkedIn, setCheckedIn] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState('')
  const [checkInResult, setCheckInResult] = useState<Record<string, any>>({})

  useEffect(() => {
    loadData()
    const ch = supabase.channel('student-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // احضر فصل الطالب
    const { data: student } = await supabase.from('students')
      .select('section_id').eq('id', user.id).single()
    if (!student) return

    const today = new Date().toISOString().split('T')[0]

    const [{ data: sess }, { data: recs }, { data: myCheckins }] = await Promise.all([
      supabase.from('live_sessions')
        .select('*, subjects(name), sections(name, classes(name))')
        .eq('session_date', today)
        .eq('section_id', student.section_id)
        .neq('status', 'cancelled')
        .order('period'),
      supabase.from('session_recordings')
        .select(`*, live_sessions(subjects(name), session_date, period, sections(name, classes(name))),
                  recording_views(completed)`)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('session_checkins')
        .select('session_id').eq('student_id', user.id)
    ])

    setSessions((sess || []) as any)
    setRecordings((recs || []) as any)
    const cMap: Record<string, boolean> = {}
    ;(myCheckins || []).forEach(c => { cMap[c.session_id] = true })
    setCheckedIn(cMap)
    setLoading(false)
  }

  async function checkIn(sessionId: string) {
    setActionId(sessionId)
    const { data } = await supabase.rpc('student_checkin', { p_session_id: sessionId })
    if (data) {
      setCheckInResult(prev => ({ ...prev, [sessionId]: data }))
      setCheckedIn(prev => ({ ...prev, [sessionId]: true }))
    }
    setActionId('')
  }

  async function markRecordingViewed(recordingId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('recording_views').upsert({
      recording_id: recordingId, student_id: user.id, completed: true,
      duration_watched_minutes: 0
    }, { onConflict: 'recording_id,student_id' })
    // update view count
    await supabase.rpc('increment_view_count' as any, { rec_id: recordingId }).catch(() => {})
    setRecordings(prev => prev.map(r => r.id === recordingId
      ? { ...r, recording_views: [{ completed: true }] } : r))
  }

  const now = new Date()
  const currentHour = now.getHours()
  const PERIOD_TIMES: Record<number, string> = { 1: '8:00', 2: '8:50', 3: '9:40', 4: '10:40', 5: '11:30', 6: '12:20', 7: '13:10' }

  const upcomingCount = sessions.filter(s => s.status === 'scheduled' || s.status === 'announced').length
  const liveCount = sessions.filter(s => s.status === 'live').length

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Video className="w-7 h-7 text-blue-600" />الحصص المباشرة
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {liveCount > 0 && <span className="text-red-600 font-bold">🔴 {liveCount} حصة مباشرة الآن  |  </span>}
            {upcomingCount} حصة قادمة
          </p>
        </div>
        <div className="flex gap-2">
          {['today', 'recordings'].map(t => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${tab === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
              {t === 'today' ? '📅 اليوم' : '🎬 التسجيلات'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'today' && (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
              <BookOpen className="w-14 h-14 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">لا توجد حصص مجدولة اليوم</p>
            </div>
          ) : sessions.map(s => {
            const isLive = s.status === 'live'
            const isAnnounced = s.status === 'announced'
            const isEnded = s.status === 'ended'
            const hasCheckedIn = checkedIn[s.id]
            const result = checkInResult[s.id]

            return (
              <div key={s.id} className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all ${isLive ? 'border-red-400' : isAnnounced ? 'border-blue-300' : 'border-gray-100'}`}>
                {/* Live banner */}
                {isLive && (
                  <div className="bg-red-500 px-4 py-2 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                    <p className="text-white text-sm font-bold">الحصة مباشرة الآن — انضم فوراً!</p>
                  </div>
                )}
                {isAnnounced && (
                  <div className="bg-blue-500 px-4 py-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-white" />
                    <p className="text-white text-sm font-bold">تبدأ الحصة قريباً — ابدأ بالتحضير</p>
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">{(s.subjects as any)?.name}</h2>
                      <p className="text-sm text-gray-500">{(s.sections as any)?.classes?.name} — شعبة {(s.sections as any)?.name}</p>
                      <p className="text-sm text-gray-400">الحصة {s.period}  •  {PERIOD_TIMES[s.period] || ''}</p>
                    </div>
                    {hasCheckedIn ? (
                      <span className="flex items-center gap-1.5 bg-green-100 text-green-700 text-sm font-bold px-3 py-1.5 rounded-xl">
                        <CheckCircle className="w-4 h-4" />تم تسجيل حضورك
                      </span>
                    ) : isEnded ? (
                      <span className="bg-gray-100 text-gray-500 text-sm px-3 py-1.5 rounded-xl">انتهت الحصة</span>
                    ) : (
                      <span className={`text-sm px-3 py-1.5 rounded-xl ${isLive ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                        {isLive ? 'لم تسجّل حضورك' : 'لم تبدأ بعد'}
                      </span>
                    )}
                  </div>

                  {/* Check-in result message */}
                  {result && (
                    <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${result.status === 'late' ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
                      {result.message}
                    </div>
                  )}

                  {/* Zoom + Check-in buttons */}
                  {(isLive || isAnnounced) && (
                    <div className="flex gap-3">
                      <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition-colors">
                        <ExternalLink className="w-5 h-5" />
                        {s.zoom_password ? `افتح Zoom  (كلمة المرور: ${s.zoom_password})` : 'افتح Zoom'}
                      </a>
                      {isLive && !hasCheckedIn && (
                        <button onClick={() => checkIn(s.id)} disabled={actionId === s.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-60">
                          {actionId === s.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                          سجّل حضوري ✅
                        </button>
                      )}
                    </div>
                  )}

                  {/* Attendance counter for context */}
                  {isLive && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full"
                          style={{ width: `${s.expected_students > 0 ? (s.checked_in_count / s.expected_students) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{s.checked_in_count} دخل من {s.expected_students} طالب</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'recordings' && (
        <div className="space-y-4">
          {recordings.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
              <Film className="w-14 h-14 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">لا توجد تسجيلات متاحة بعد</p>
              <p className="text-gray-400 text-sm mt-1">ستظهر هنا تسجيلات حصصك بعد أن يرفعها المعلمون</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recordings.map(r => {
                const watched = r.recording_views?.length > 0
                const session = r.live_sessions as any
                return (
                  <div key={r.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${watched ? 'border-gray-100' : 'border-blue-200'}`}>
                    {!watched && (
                      <div className="bg-blue-500 px-4 py-1.5 text-white text-xs font-bold">جديد — لم تشاهد بعد</div>
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-gray-800">{r.title || session?.subjects?.name}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {session?.subjects?.name}  •  {session?.session_date && new Date(session.session_date).toLocaleDateString('ar-KW')}
                          </p>
                          {r.duration_minutes && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />{r.duration_minutes} دقيقة
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                          {r.recording_type === 'zoom_cloud' ? '☁️ Zoom' : r.recording_type === 'youtube' ? '▶️ YouTube' : '📁 Drive'}
                        </span>
                      </div>
                      <a href={r.recording_url} target="_blank" rel="noopener noreferrer"
                        onClick={() => markRecordingViewed(r.id)}
                        className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${watched ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                        {watched ? <><Eye className="w-4 h-4" />مشاهدة مرة أخرى</> : <><Play className="w-4 h-4" />شاهد التسجيل</>}
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
