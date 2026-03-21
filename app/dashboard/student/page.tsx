import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatCard from '@/components/shared/StatCard'
import PageHeader from '@/components/shared/PageHeader'
import { ClipboardList, FileText, BarChart3, Calendar, UserCheck, Bell } from 'lucide-react'
import { DAYS_AR, formatDate, getScoreBg } from '@/lib/utils'
import Link from 'next/link'

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().getDay()

  const { data: student } = await supabase
    .from('students').select('section_id, sections(name, classes(name))').eq('id', user.id).single()

  const [
    { data: upcomingExams },
    { data: myGrades },
    { data: myAssignments },
    { data: todaySchedule },
    { data: recentAttendance },
    { data: announcements },
  ] = await Promise.all([
    supabase.from('exams').select('*, subjects(name)').eq('section_id', student?.section_id ?? '').eq('status', 'published').gte('end_at', new Date().toISOString()).order('start_at').limit(4),
    supabase.from('grades').select('score, exams(title, subjects(name))').eq('student_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('assignments').select('title, due_date, subjects(name)').eq('section_id', student?.section_id ?? '').order('due_date').limit(4),
    supabase.from('schedules').select('period, start_time, subjects(name), teachers(users(full_name))').eq('section_id', student?.section_id ?? '').eq('day_of_week', today).order('period'),
    supabase.from('attendance').select('date, status, subjects(name)').eq('student_id', user.id).order('date', { ascending: false }).limit(5),
    supabase.from('announcements').select('title, content, created_at').order('created_at', { ascending: false }).limit(3),
  ])

  const avgScore = myGrades && myGrades.length > 0
    ? Math.round(myGrades.reduce((acc, g) => acc + g.score, 0) / myGrades.length)
    : 0
  const presentCount = recentAttendance?.filter(a => a.status === 'present').length ?? 0

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="لوحتي الدراسية" subtitle={`${DAYS_AR[today]} — ${(student?.sections as any)?.classes?.name} شعبة ${(student?.sections as any)?.name}`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="اختبارات قادمة" value={upcomingExams?.length ?? 0} icon={ClipboardList} color="purple" />
        <StatCard title="واجبات معلقة" value={myAssignments?.length ?? 0} icon={FileText} color="yellow" />
        <StatCard title="متوسط درجاتي" value={`${avgScore}%`} icon={BarChart3} color="blue" />
        <StatCard title="حضوري (5 أيام)" value={`${presentCount}/5`} icon={UserCheck} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today Schedule */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />جدول اليوم
          </h2>
          {todaySchedule?.length === 0
            ? <p className="text-gray-400 text-sm text-center py-4">لا توجد حصص</p>
            : todaySchedule?.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-2.5 mb-2 bg-blue-50 rounded-xl">
                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">{s.period}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm">{(s.subjects as any)?.name}</p>
                  <p className="text-xs text-gray-400">{(s.teachers as any)?.users?.full_name}</p>
                </div>
                {s.start_time && <span className="text-xs text-gray-400">{s.start_time}</span>}
              </div>
            ))}
        </div>

        {/* Upcoming Exams */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-purple-600" />اختبارات قادمة
            </h2>
            <Link href="/dashboard/student/exams" className="text-xs text-blue-600">الكل</Link>
          </div>
          {upcomingExams?.length === 0
            ? <p className="text-gray-400 text-sm text-center py-4">لا توجد اختبارات</p>
            : upcomingExams?.map(e => (
              <div key={e.id} className="p-3 mb-2 border border-purple-100 rounded-xl bg-purple-50">
                <p className="font-semibold text-gray-800 text-sm">{e.title}</p>
                <p className="text-xs text-purple-600 mt-0.5">{(e.subjects as any)?.name}</p>
                {e.start_at && <p className="text-xs text-gray-400 mt-1">يبدأ: {formatDate(e.start_at)}</p>}
                <Link href={`/dashboard/student/exams/${e.id}`} className="mt-2 inline-block text-xs text-white bg-purple-600 px-3 py-1 rounded-lg">دخول الاختبار</Link>
              </div>
            ))}
        </div>

        {/* Recent Grades */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-600" />آخر درجاتي
            </h2>
            <Link href="/dashboard/student/grades" className="text-xs text-blue-600">الكل</Link>
          </div>
          {myGrades?.length === 0
            ? <p className="text-gray-400 text-sm text-center py-4">لا توجد درجات</p>
            : myGrades?.map(g => (
              <div key={g.id} className="flex items-center justify-between p-2.5 mb-2 hover:bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-800 text-sm">{(g.exams as any)?.title}</p>
                  <p className="text-xs text-gray-400">{(g.exams as any)?.subjects?.name}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getScoreBg(g.score)}`}>{Math.round(g.score)}%</span>
              </div>
            ))}
        </div>
      </div>

      {/* Announcements */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-yellow-500" />إعلانات المدرسة
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {announcements?.map(a => (
            <div key={a.id} className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl">
              <p className="font-semibold text-gray-800 text-sm mb-1">{a.title}</p>
              <p className="text-xs text-gray-500 line-clamp-2">{a.content}</p>
              <p className="text-xs text-gray-400 mt-2">{formatDate(a.created_at)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
