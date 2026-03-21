'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  UserCheck, AlertTriangle, CheckCircle, Clock, Bell, RefreshCw,
  Search, Filter, ChevronDown, ChevronUp, BarChart3, Users,
  TrendingDown, TrendingUp, Calendar, BookOpen, Send, Eye,
  XCircle, Loader2, Download
} from 'lucide-react'

interface TrackingRecord {
  tracking_id: string
  period: number
  teacher_name: string
  teacher_id: string
  teacher_email: string
  teacher_phone: string
  subject_name: string
  class_name: string
  section_name: string
  is_recorded: boolean
  recorded_at: string | null
  students_count: number
  present_count: number
  absent_count: number
  late_count: number
  attendance_rate: number
  reminder_sent: boolean
  reminder_count: number
  period_start: string | null
  period_end: string | null
}

interface TeacherStat {
  teacher_id: string
  teacher_name: string
  teacher_email: string
  total_scheduled: number
  total_recorded: number
  total_missed: number
  recording_rate: number
  total_reminders: number
  avg_attendance_rate: number
  total_students_handled: number
  last_recorded_at: string | null
}

const PERIODS = [
  { num: 1, time: '08:00 - 08:45' }, { num: 2, time: '08:50 - 09:35' },
  { num: 3, time: '09:40 - 10:25' }, { num: 4, time: '10:40 - 11:25' },
  { num: 5, time: '11:30 - 12:15' }, { num: 6, time: '12:20 - 13:05' },
  { num: 7, time: '13:10 - 13:55' },
]

export default function AttendanceTrackingPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'today' | 'stats' | 'teacher'>('today')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  })
  const [records, setRecords] = useState<TrackingRecord[]>([])
  const [stats, setStats] = useState<TeacherStat[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'missing' | 'recorded'>('all')
  const [searchTeacher, setSearchTeacher] = useState('')
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null)
  const [teacherDetail, setTeacherDetail] = useState<any[]>([])
  const [actionResult, setActionResult] = useState('')

  const loadTodayRecords = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_attendance_tracking_summary', { p_date: selectedDate })
    if (!error && data) setRecords(data as TrackingRecord[])
    setLoading(false)
  }, [selectedDate])

  const loadStats = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_teacher_attendance_stats', {
      p_from: dateRange.from, p_to: dateRange.to
    })
    if (!error && data) setStats(data as TeacherStat[])
    setLoading(false)
  }, [dateRange])

  useEffect(() => {
    if (tab === 'today') loadTodayRecords()
    else if (tab === 'stats' || tab === 'teacher') loadStats()
  }, [tab, selectedDate, dateRange])

  async function generateTracking() {
    setGenerating(true)
    const { data, error } = await supabase.rpc('generate_daily_attendance_tracking', { p_date: selectedDate })
    if (!error) {
      setActionResult(`✅ تم توليد ${data} سجل تتبع ليوم ${selectedDate}`)
      loadTodayRecords()
    }
    setGenerating(false)
    setTimeout(() => setActionResult(''), 4000)
  }

  async function notifyAllMissing() {
    setNotifying(true)
    const { data, error } = await supabase.rpc('notify_teachers_missing_attendance', {
      p_date: selectedDate, p_period: null
    })
    if (!error) {
      setActionResult(`📨 تم إرسال ${data} إشعار للمعلمين الذين لم يسجلوا الحضور`)
      loadTodayRecords()
    }
    setNotifying(false)
    setTimeout(() => setActionResult(''), 5000)
  }

  async function sendReminder(trackingId: string) {
    setSendingId(trackingId)
    const { data } = await supabase.rpc('send_attendance_reminder', { p_tracking_id: trackingId })
    if (data) {
      setRecords(prev => prev.map(r => r.tracking_id === trackingId
        ? { ...r, reminder_count: r.reminder_count + 1, reminder_sent: true }
        : r))
    }
    setSendingId(null)
  }

  async function loadTeacherDetail(teacherId: string) {
    if (expandedTeacher === teacherId) { setExpandedTeacher(null); return }
    setExpandedTeacher(teacherId)
    const { data } = await supabase.rpc('get_teacher_attendance_detail', {
      p_teacher_id: teacherId, p_from: dateRange.from, p_to: dateRange.to
    })
    setTeacherDetail(data || [])
  }

  const filteredRecords = records.filter(r => {
    if (filterStatus === 'missing' && r.is_recorded) return false
    if (filterStatus === 'recorded' && !r.is_recorded) return false
    if (searchTeacher && !r.teacher_name.includes(searchTeacher)) return false
    return true
  })

  const summary = {
    total: records.length,
    recorded: records.filter(r => r.is_recorded).length,
    missing: records.filter(r => !r.is_recorded).length,
    missingTeachers: new Set(records.filter(r => !r.is_recorded).map(r => r.teacher_id)).size,
    avgRate: records.filter(r => r.is_recorded && r.students_count > 0)
      .reduce((a, r) => a + r.attendance_rate, 0) / Math.max(records.filter(r => r.is_recorded).length, 1),
  }

  const statsByTeacher = stats.filter(s =>
    !searchTeacher || s.teacher_name.includes(searchTeacher)
  )

  return (
    <div className="p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-blue-600" />
            نظام متابعة تسجيل الحضور
          </h1>
          <p className="text-gray-500 text-sm mt-1">مراقبة التزام المعلمين بتسجيل الحضور</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={generateTracking} disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            توليد سجلات اليوم
          </button>
          <button onClick={notifyAllMissing} disabled={notifying || summary.missing === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
            {notifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            إشعار المتغيبين ({summary.missing})
          </button>
        </div>
      </div>

      {actionResult && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />{actionResult}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { k: 'today', l: '📅 تتبع اليوم', },
          { k: 'stats', l: '📊 إحصائيات المعلمين', },
          { k: 'teacher', l: '🔍 تفاصيل المعلمين', },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border ${tab === t.k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* TODAY TAB */}
      {tab === 'today' && (
        <>
          {/* Date + Summary Cards */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="text-sm text-gray-700 outline-none bg-transparent" />
            </div>
            <div className="flex gap-2">
              {[
                { l: 'الكل', v: 'all' }, { l: '❌ لم يسجل', v: 'missing' }, { l: '✅ سجّل', v: 'recorded' }
              ].map(f => (
                <button key={f.v} onClick={() => setFilterStatus(f.v as any)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${filterStatus === f.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {f.l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input placeholder="ابحث عن معلم..." value={searchTeacher} onChange={e => setSearchTeacher(e.target.value)}
                className="text-sm text-gray-700 outline-none bg-transparent w-36" />
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { l: 'إجمالي الحصص', v: summary.total, bg: 'bg-blue-50', c: 'text-blue-700', b: 'border-blue-200', icon: BookOpen },
              { l: 'سجّل الحضور', v: summary.recorded, bg: 'bg-green-50', c: 'text-green-700', b: 'border-green-200', icon: CheckCircle },
              { l: 'لم يسجّل', v: summary.missing, bg: 'bg-red-50', c: 'text-red-700', b: 'border-red-200', icon: XCircle },
              { l: 'معلمون متغيبون', v: summary.missingTeachers, bg: 'bg-orange-50', c: 'text-orange-700', b: 'border-orange-200', icon: AlertTriangle },
              { l: 'متوسط الحضور', v: `${Math.round(summary.avgRate)}%`, bg: 'bg-purple-50', c: 'text-purple-700', b: 'border-purple-200', icon: BarChart3 },
            ].map(s => (
              <div key={s.l} className={`${s.bg} border ${s.b} rounded-2xl p-4 text-center`}>
                <s.icon className={`w-5 h-5 ${s.c} mx-auto mb-2`} />
                <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
                <p className="text-xs text-gray-500 mt-1">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          {summary.total > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-semibold text-gray-700">نسبة الالتزام بتسجيل الحضور</span>
                <span className={`font-bold ${summary.recorded / summary.total >= 0.8 ? 'text-green-600' : summary.recorded / summary.total >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {Math.round((summary.recorded / summary.total) * 100)}%
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${summary.recorded / summary.total >= 0.8 ? 'bg-green-500' : summary.recorded / summary.total >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${(summary.recorded / summary.total) * 100}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{summary.recorded} حصة مسجّلة</span>
                <span>{summary.missing} حصة غير مسجّلة</span>
              </div>
            </div>
          )}

          {/* Records Table by Period */}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : (
            <div className="space-y-4">
              {PERIODS.map(period => {
                const periodRecords = filteredRecords.filter(r => r.period === period.num)
                if (periodRecords.length === 0) return null
                const missed = periodRecords.filter(r => !r.is_recorded)
                const recorded = periodRecords.filter(r => r.is_recorded)
                return (
                  <div key={period.num} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Period Header */}
                    <div className={`px-5 py-3 flex items-center justify-between border-b ${missed.length > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold ${missed.length > 0 ? 'bg-red-500' : 'bg-green-500'}`}>
                          {period.num}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">الحصة {period.num}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />{period.time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1.5 text-green-700 font-semibold bg-green-100 px-3 py-1 rounded-lg">
                          <CheckCircle className="w-4 h-4" />{recorded.length} سجّل
                        </span>
                        {missed.length > 0 && (
                          <span className="flex items-center gap-1.5 text-red-700 font-semibold bg-red-100 px-3 py-1 rounded-lg">
                            <AlertTriangle className="w-4 h-4" />{missed.length} لم يسجّل
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Records */}
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                        <tr>
                          <th className="text-right px-4 py-2.5">المعلم</th>
                          <th className="text-right px-4 py-2.5">المادة</th>
                          <th className="text-right px-4 py-2.5">الصف / الشعبة</th>
                          <th className="text-center px-4 py-2.5">الطلاب</th>
                          <th className="text-center px-4 py-2.5">الحضور</th>
                          <th className="text-center px-4 py-2.5">الغياب</th>
                          <th className="text-center px-4 py-2.5">نسبة الحضور</th>
                          <th className="text-center px-4 py-2.5">الحالة</th>
                          <th className="text-center px-4 py-2.5">التذكيرات</th>
                          <th className="text-center px-4 py-2.5">إجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {periodRecords.map(r => (
                          <tr key={r.tracking_id} className={`hover:bg-gray-50/50 ${!r.is_recorded ? 'bg-red-50/30' : ''}`}>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-800">{r.teacher_name}</p>
                              <p className="text-xs text-gray-400">{r.teacher_email}</p>
                              {r.teacher_phone && <p className="text-xs text-gray-400">{r.teacher_phone}</p>}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{r.subject_name}</td>
                            <td className="px-4 py-3">
                              <p className="text-gray-700 font-medium">{r.class_name}</p>
                              <p className="text-xs text-gray-400">شعبة {r.section_name}</p>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-gray-700">{r.students_count}</td>
                            <td className="px-4 py-3 text-center">
                              {r.is_recorded ? <span className="font-bold text-green-600">{r.present_count}</span> : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {r.is_recorded ? <span className="font-bold text-red-600">{r.absent_count}</span> : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {r.is_recorded && r.students_count > 0 ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className={`font-bold text-sm ${r.attendance_rate >= 80 ? 'text-green-600' : r.attendance_rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {r.attendance_rate}%
                                  </span>
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${r.attendance_rate >= 80 ? 'bg-green-500' : r.attendance_rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                      style={{ width: `${r.attendance_rate}%` }} />
                                  </div>
                                </div>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {r.is_recorded ? (
                                <span className="flex items-center justify-center gap-1 text-green-700 text-xs font-semibold">
                                  <CheckCircle className="w-4 h-4" />سجّل
                                </span>
                              ) : (
                                <span className="flex items-center justify-center gap-1 text-red-700 text-xs font-semibold">
                                  <XCircle className="w-4 h-4" />لم يسجّل
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {r.reminder_count > 0 ? (
                                <span className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded-lg">
                                  {r.reminder_count} تذكير
                                </span>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {!r.is_recorded && (
                                <button onClick={() => sendReminder(r.tracking_id)} disabled={sendingId === r.tracking_id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 mx-auto">
                                  {sendingId === r.tracking_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                  تذكير
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}

              {filteredRecords.length === 0 && !loading && (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
                  <UserCheck className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">لا توجد سجلات لهذا اليوم</p>
                  <p className="text-gray-400 text-sm mt-1">اضغط "توليد سجلات اليوم" لإنشاء السجلات من الجدول الدراسي</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* STATS TAB */}
      {tab === 'stats' && (
        <>
          {/* Date Range */}
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 w-fit">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">من</span>
            <input type="date" value={dateRange.from} onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))}
              className="text-sm text-gray-700 outline-none bg-transparent" />
            <span className="text-sm text-gray-500">إلى</span>
            <input type="date" value={dateRange.to} onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))}
              className="text-sm text-gray-700 outline-none bg-transparent" />
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  إحصائيات المعلمين — نسبة الالتزام
                </h2>
                <span className="text-sm text-gray-500">{stats.length} معلم</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 border-b">
                  <tr>
                    <th className="text-right px-4 py-3">المعلم</th>
                    <th className="text-center px-4 py-3">الحصص المجدولة</th>
                    <th className="text-center px-4 py-3">سجّل</th>
                    <th className="text-center px-4 py-3">لم يسجّل</th>
                    <th className="text-center px-4 py-3">نسبة الالتزام</th>
                    <th className="text-center px-4 py-3">متوسط حضور الطلاب</th>
                    <th className="text-center px-4 py-3">التذكيرات</th>
                    <th className="text-center px-4 py-3">آخر تسجيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {statsByTeacher.map(s => (
                    <tr key={s.teacher_id}
                      className={`hover:bg-gray-50/50 ${s.recording_rate < 50 ? 'bg-red-50/40' : s.recording_rate < 80 ? 'bg-yellow-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-800">{s.teacher_name}</p>
                        <p className="text-xs text-gray-400">{s.teacher_email}</p>
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-gray-700">{s.total_scheduled}</td>
                      <td className="px-4 py-3 text-center font-bold text-green-600">{s.total_recorded}</td>
                      <td className="px-4 py-3 text-center font-bold text-red-600">{s.total_missed}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-base font-bold ${s.recording_rate >= 80 ? 'text-green-600' : s.recording_rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {s.recording_rate}%
                          </span>
                          <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${s.recording_rate >= 80 ? 'bg-green-500' : s.recording_rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${s.recording_rate}%` }} />
                          </div>
                          <span className="text-xs">
                            {s.recording_rate >= 80 ? '✅ ممتاز' : s.recording_rate >= 50 ? '⚠️ متوسط' : '🚨 ضعيف'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-blue-600">
                        {s.avg_attendance_rate ? `${s.avg_attendance_rate}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.total_reminders > 0
                          ? <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg font-semibold">{s.total_reminders}</span>
                          : <span className="text-gray-300">0</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-400">
                        {s.last_recorded_at ? new Date(s.last_recorded_at).toLocaleDateString('ar-SA') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {stats.length === 0 && <p className="text-center text-gray-400 py-10">لا توجد بيانات في هذه الفترة</p>}
            </div>
          )}
        </>
      )}

      {/* TEACHER DETAIL TAB */}
      {tab === 'teacher' && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 max-w-xs">
              <Search className="w-4 h-4 text-gray-400" />
              <input placeholder="ابحث عن معلم..." value={searchTeacher} onChange={e => setSearchTeacher(e.target.value)}
                className="text-sm text-gray-700 outline-none bg-transparent flex-1" />
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input type="date" value={dateRange.from} onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))} className="text-sm outline-none bg-transparent" />
              <span className="text-gray-400">—</span>
              <input type="date" value={dateRange.to} onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))} className="text-sm outline-none bg-transparent" />
            </div>
          </div>

          {loading
            ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
            : (
              <div className="space-y-3">
                {statsByTeacher.map(s => (
                  <div key={s.teacher_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => loadTeacherDetail(s.teacher_id)}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${s.recording_rate >= 80 ? 'bg-green-600' : s.recording_rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                          {s.teacher_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{s.teacher_name}</p>
                          <p className="text-xs text-gray-400">{s.teacher_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className={`text-xl font-bold ${s.recording_rate >= 80 ? 'text-green-600' : s.recording_rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{s.recording_rate}%</p>
                          <p className="text-xs text-gray-400">الالتزام</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-red-600">{s.total_missed}</p>
                          <p className="text-xs text-gray-400">لم يسجّل</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-blue-600">{s.total_scheduled}</p>
                          <p className="text-xs text-gray-400">مجدول</p>
                        </div>
                        {expandedTeacher === s.teacher_id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </div>
                    </div>

                    {expandedTeacher === s.teacher_id && (
                      <div className="border-t border-gray-100">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-xs text-gray-500">
                            <tr>
                              <th className="text-right px-4 py-2">التاريخ</th>
                              <th className="text-center px-4 py-2">الحصة</th>
                              <th className="text-right px-4 py-2">المادة</th>
                              <th className="text-right px-4 py-2">الفصل</th>
                              <th className="text-center px-4 py-2">الطلاب</th>
                              <th className="text-center px-4 py-2">الحاضر</th>
                              <th className="text-center px-4 py-2">الغائب</th>
                              <th className="text-center px-4 py-2">الحالة</th>
                              <th className="text-center px-4 py-2">تذكير</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {teacherDetail.map((d: any, i: number) => (
                              <tr key={i} className={`${!d.is_recorded ? 'bg-red-50/40' : ''}`}>
                                <td className="px-4 py-2.5 text-gray-700 font-medium">{new Date(d.tracking_date).toLocaleDateString('ar-SA')}</td>
                                <td className="px-4 py-2.5 text-center text-gray-600">الحصة {d.period}</td>
                                <td className="px-4 py-2.5 text-gray-600">{d.subject_name}</td>
                                <td className="px-4 py-2.5 text-gray-500">{d.class_name} - {d.section_name}</td>
                                <td className="px-4 py-2.5 text-center font-medium text-gray-700">{d.students_count}</td>
                                <td className="px-4 py-2.5 text-center font-bold text-green-600">{d.is_recorded ? d.present_count : '—'}</td>
                                <td className="px-4 py-2.5 text-center font-bold text-red-600">{d.is_recorded ? d.absent_count : '—'}</td>
                                <td className="px-4 py-2.5 text-center">
                                  {d.is_recorded
                                    ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-lg font-semibold">✅ سجّل</span>
                                    : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-lg font-semibold">❌ لم يسجّل</span>}
                                </td>
                                <td className="px-4 py-2.5 text-center text-xs text-orange-600">{d.reminder_count > 0 ? `${d.reminder_count} 🔔` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {teacherDetail.length === 0 && <p className="text-center text-gray-400 py-5 text-sm">لا توجد تفاصيل في هذه الفترة</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          }
        </>
      )}
    </div>
  )
}
