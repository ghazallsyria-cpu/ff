import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatCard from '@/components/shared/StatCard'
import PageHeader from '@/components/shared/PageHeader'
import { Users, ClipboardList, FileText, Calendar, BookOpen, BarChart3, TrendingUp, AlertTriangle } from 'lucide-react'
import { DAYS_AR, formatDate } from '@/lib/utils'
import Link from 'next/link'

export default async function TeacherDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('full_name').eq('id', user.id).single()
  const today = new Date().getDay()
  const todayStr = new Date().toISOString().split('T')[0]

  const [
    { data: mySections },
    { data: myExams },
    { data: myAssignments },
    { data: todaySchedule },
    { data: recentGrades },
    { data: absentsToday },
    { data: myTracking },
  ] = await Promise.all([
    supabase.from('teacher_sections').select('section_id, sections(name, classes(name)), subjects(name)').eq('teacher_id', user.id),
    supabase.from('exams').select('id,title,status,start_at,subjects(name)').eq('teacher_id', user.id).order('created_at', { ascending: false }).limit(4),
    supabase.from('assignments').select('id,title,due_date,subjects(name),sections(name)').eq('teacher_id', user.id).order('due_date').limit(4),
    supabase.from('schedules').select('period,start_time,subjects(name),sections(name,classes(name))').eq('teacher_id', user.id).eq('day_of_week', today).order('period'),
    supabase.from('grades').select('score,students(users(full_name)),exams(title)').in('exam_id',
      (await supabase.from('exams').select('id').eq('teacher_id', user.id)).data?.map(e => e.id) || []
    ).order('created_at', { ascending: false }).limit(5),
    supabase.from('attendance').select('students(users(full_name)),subjects(name)').eq('date', todayStr).eq('status', 'absent').in('section_id',
      [...new Set((await supabase.from('teacher_sections').select('section_id').eq('teacher_id', user.id)).data?.map(s => s.section_id) || [])]
    ),
    supabase.from('attendance_tracking').select('period,is_recorded,subject_id,section_id,subjects(name),sections(name,classes(name))').eq('teacher_id', user.id).eq('tracking_date', todayStr).order('period'),
  ])

  const uniqueSections = new Set(mySections?.map(s => s.section_id) || []).size
  const publishedExams = myExams?.filter(e => e.status === 'published').length ?? 0
  const avgScore = recentGrades?.length ? Math.round(recentGrades.reduce((a, g) => a + g.score, 0) / recentGrades.length) : 0
  const unrecorded = myTracking?.filter(t => !t.is_recorded).length ?? 0

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={`مرحباً، ${profile?.full_name} 🎓`} subtitle={`${DAYS_AR[today]} — لوحة المعلم`} />

      {/* Alert if unrecorded attendance */}
      {unrecorded > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-orange-800 text-sm">تنبيه: {unrecorded} حصة لم تُسجّل حضورها بعد</p>
            <p className="text-orange-600 text-xs mt-0.5">يرجى تسجيل الحضور لتجنب تذكير الإدارة</p>
          </div>
          <Link href="/dashboard/teacher/attendance" className="bg-orange-500 text-white px-4 py-2 rounded-xl text-xs font-bold">
            سجّل الآن
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="فصولي" value={uniqueSections} icon={BookOpen} color="blue" />
        <StatCard title="اختبارات منشورة" value={publishedExams} icon={ClipboardList} color="purple" />
        <StatCard title="الواجبات" value={myAssignments?.length ?? 0} icon={FileText} color="yellow" />
        <StatCard title="متوسط الدرجات" value={`${avgScore}%`} icon={BarChart3} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today Schedule */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />جدول اليوم — {DAYS_AR[today]}
          </h2>
          {todaySchedule?.length === 0
            ? <p className="text-gray-400 text-sm text-center py-6">لا توجد حصص اليوم</p>
            : todaySchedule?.map(s => {
              const trackRec = myTracking?.find(t => t.period === s.period)
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 mb-2 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">{s.period}</div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800 text-sm">{(s.subjects as any)?.name}</p>
                    <p className="text-xs text-gray-500">{(s.sections as any)?.classes?.name} - {(s.sections as any)?.name}</p>
                  </div>
                  {trackRec && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${trackRec.is_recorded ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {trackRec.is_recorded ? '✅' : '⚠️'}
                    </span>
                  )}
                </div>
              )
            })
          }
          {absentsToday && absentsToday.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-100">
              <p className="text-xs font-bold text-red-700 mb-2">غياب اليوم ({absentsToday.length})</p>
              {absentsToday.slice(0, 3).map((a: any, i: number) => (
                <p key={i} className="text-xs text-red-600">• {a.students?.users?.full_name}</p>
              ))}
            </div>
          )}
        </div>

        {/* My Exams */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-purple-600" />اختباراتي
            </h2>
            <Link href="/dashboard/teacher/exams" className="text-xs text-blue-600">الكل</Link>
          </div>
          {myExams?.map(e => (
            <div key={e.id} className="flex items-center justify-between p-3 mb-2 border border-gray-100 rounded-xl hover:bg-gray-50">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-800 text-sm truncate">{e.title}</p>
                <p className="text-xs text-gray-400">{(e.subjects as any)?.name}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold flex-shrink-0 mr-2 ${
                e.status === 'published' ? 'bg-green-100 text-green-700' :
                e.status === 'draft' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {e.status === 'published' ? 'منشور' : e.status === 'draft' ? 'مسودة' : 'مؤرشف'}
              </span>
            </div>
          ))}
          <Link href="/dashboard/teacher/exams/new" className="mt-2 block text-center text-sm text-blue-600 hover:underline">+ إنشاء اختبار جديد</Link>
        </div>

        {/* Recent Grades */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />آخر الدرجات
            </h2>
            <Link href="/dashboard/teacher/grades" className="text-xs text-blue-600">الكل</Link>
          </div>
          {recentGrades?.length === 0
            ? <p className="text-gray-400 text-sm text-center py-4">لا توجد درجات</p>
            : recentGrades?.map((g: any) => (
              <div key={g.id} className="flex items-center justify-between p-2.5 mb-1.5 hover:bg-gray-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{g.students?.users?.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{g.exams?.title}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0 mr-2 ${g.score >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {Math.round(g.score)}%
                </span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
