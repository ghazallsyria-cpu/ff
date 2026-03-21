import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { Video, Users, CheckCircle, XCircle, Clock, Film, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default async function AdminZoomMonitorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'management'].includes(p?.role)) redirect('/dashboard')

  const today = new Date().toISOString().split('T')[0]

  const [
    { data: allSessions },
    { data: liveSessions },
    { data: recordings },
  ] = await Promise.all([
    supabase.from('live_sessions')
      .select(`*, subjects(name), sections(name, classes(name)), users!teacher_id(full_name)`)
      .eq('session_date', today).order('period'),
    supabase.from('live_sessions')
      .select(`*, subjects(name), sections(name, classes(name)), users!teacher_id(full_name),
               session_checkins(student_id, status, late_minutes)`)
      .eq('session_date', today).eq('status', 'live'),
    supabase.from('session_recordings')
      .select(`*, users!teacher_id(full_name), live_sessions(subjects(name), session_date)`)
      .order('created_at', { ascending: false }).limit(10),
  ])

  const stats = {
    total: allSessions?.length ?? 0,
    live: allSessions?.filter(s => s.status === 'live').length ?? 0,
    ended: allSessions?.filter(s => s.status === 'ended').length ?? 0,
    scheduled: allSessions?.filter(s => s.status === 'scheduled' || s.status === 'announced').length ?? 0,
    withRecording: allSessions?.filter(s => s.recording_url).length ?? 0,
  }

  const STATUS_COLOR: Record<string, string> = {
    scheduled: 'bg-gray-100 text-gray-600', announced: 'bg-blue-100 text-blue-700',
    live: 'bg-red-100 text-red-700', ended: 'bg-green-100 text-green-700',
  }
  const STATUS_AR: Record<string, string> = {
    scheduled: 'مجدولة', announced: 'تم الإعلان', live: '🔴 مباشرة', ended: '✅ انتهت',
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="📹 مراقبة الحصص المباشرة" subtitle={`تاريخ اليوم: ${new Date().toLocaleDateString('ar-KW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`} />

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { l: 'إجمالي الحصص', v: stats.total, c: 'text-blue-600', bg: 'bg-blue-50', i: Video },
          { l: '🔴 مباشرة الآن', v: stats.live, c: 'text-red-600', bg: 'bg-red-50', i: Video },
          { l: '✅ انتهت', v: stats.ended, c: 'text-green-600', bg: 'bg-green-50', i: CheckCircle },
          { l: '⏳ قادمة', v: stats.scheduled, c: 'text-yellow-600', bg: 'bg-yellow-50', i: Clock },
          { l: '🎬 مع تسجيل', v: stats.withRecording, c: 'text-purple-600', bg: 'bg-purple-50', i: Film },
        ].map(s => (
          <div key={s.l} className={`${s.bg} rounded-2xl p-4 text-center border border-gray-100`}>
            <p className={`text-3xl font-bold ${s.c}`}>{s.v}</p>
            <p className="text-sm text-gray-500 mt-1">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Live now */}
      {(liveSessions?.length ?? 0) > 0 && (
        <div>
          <h2 className="font-bold text-gray-800 text-lg mb-3 flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />مباشر الآن
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveSessions!.map(s => {
              const checkins = (s.session_checkins as any[]) || []
              const present = checkins.filter(c => c.status !== 'absent').length
              const late = checkins.filter(c => c.status === 'late').length
              const pct = s.expected_students > 0 ? Math.round(present / s.expected_students * 100) : 0
              return (
                <div key={s.id} className="bg-white rounded-2xl border-2 border-red-300 shadow-sm overflow-hidden">
                  <div className="bg-red-500 px-4 py-2 flex items-center justify-between">
                    <span className="text-white text-sm font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />مباشر
                    </span>
                    {s.started_at && (
                      <span className="text-red-200 text-xs">
                        منذ {Math.round((Date.now() - new Date(s.started_at).getTime()) / 60000)} دقيقة
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-gray-800">{(s.subjects as any)?.name}</p>
                    <p className="text-sm text-gray-500">{(s.sections as any)?.classes?.name} — {(s.sections as any)?.name}</p>
                    <p className="text-xs text-gray-400 mb-3">المعلم: {(s.users as any)?.full_name}</p>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-green-600 font-bold">{present} حاضر</span>
                      {late > 0 && <span className="text-yellow-600">{late} متأخر</span>}
                      <span className="text-red-600">{s.expected_students - present} غائب</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-center">{pct}% حضور</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All sessions table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Video className="w-5 h-5 text-blue-600" />كل حصص اليوم ({stats.total})
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-right px-4 py-3">المعلم</th>
              <th className="text-right px-4 py-3">المادة</th>
              <th className="text-right px-4 py-3">الفصل</th>
              <th className="text-center px-4 py-3">الحصة</th>
              <th className="text-center px-4 py-3">الحضور</th>
              <th className="text-center px-4 py-3">الحالة</th>
              <th className="text-center px-4 py-3">تسجيل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(allSessions || []).map(s => {
              const pct = s.expected_students > 0 ? Math.round(s.checked_in_count / s.expected_students * 100) : 0
              return (
                <tr key={s.id} className={`hover:bg-gray-50/50 ${s.status === 'live' ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{(s.users as any)?.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{(s.subjects as any)?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{(s.sections as any)?.classes?.name} — {(s.sections as any)?.name}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{s.period}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`font-bold text-xs ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {s.checked_in_count}/{s.expected_students}  ({pct}%)
                      </span>
                      {s.expected_students > 0 && (
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${STATUS_COLOR[s.status] || 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_AR[s.status] || s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.recording_url
                      ? <a href={s.recording_url} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline text-xs flex items-center gap-1 justify-center"><Film className="w-3.5 h-3.5" />عرض</a>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {(allSessions?.length ?? 0) === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Video className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>لا توجد جلسات اليوم</p>
          </div>
        )}
      </div>

      {/* Recent recordings */}
      {(recordings?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><Film className="w-5 h-5 text-purple-600" />آخر التسجيلات</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recordings!.map(r => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800 text-sm">{r.title}</p>
                  <p className="text-xs text-gray-400">المعلم: {(r.users as any)?.full_name} — {(r.live_sessions as any)?.session_date}</p>
                </div>
                <a href={r.recording_url} target="_blank" rel="noopener noreferrer"
                  className="text-purple-600 hover:underline text-sm flex items-center gap-1">
                  <Film className="w-4 h-4" />شاهد التسجيل
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
