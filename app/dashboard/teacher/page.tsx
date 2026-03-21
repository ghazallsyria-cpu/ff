import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatCard from '@/components/shared/StatCard'
import PageHeader from '@/components/shared/PageHeader'
import {
  Users,
  ClipboardList,
  FileText,
  Calendar,
  BookOpen,
  BarChart3,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import { DAYS_AR } from '@/lib/utils'
import Link from 'next/link'

export default async function TeacherDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const today = new Date().getDay()
  const todayStr = new Date().toISOString().split('T')[0]

  // استخراج section_ids بشكل صحيح بدون spread على Set
  const sectionsRes = await supabase
    .from('teacher_sections')
    .select('section_id')
    .eq('teacher_id', user.id)

  const sectionIds = Array.from(
    new Set((sectionsRes.data || []).map((s) => s.section_id))
  )

  const examsRes = await supabase
    .from('exams')
    .select('id')
    .eq('teacher_id', user.id)

  const examIds = examsRes.data?.map((e) => e.id) || []

  const [
    { data: mySections },
    { data: myExams },
    { data: myAssignments },
    { data: todaySchedule },
    { data: recentGrades },
    { data: absentsToday },
    { data: myTracking },
  ] = await Promise.all([
    supabase
      .from('teacher_sections')
      .select('section_id, sections(name, classes(name)), subjects(name)')
      .eq('teacher_id', user.id),

    supabase
      .from('exams')
      .select('id,title,status,start_at,subjects(name)')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })
      .limit(4),

    supabase
      .from('assignments')
      .select('id,title,due_date,subjects(name),sections(name)')
      .eq('teacher_id', user.id)
      .order('due_date')
      .limit(4),

    supabase
      .from('schedules')
      .select(
        'period,start_time,subjects(name),sections(name,classes(name))'
      )
      .eq('teacher_id', user.id)
      .eq('day_of_week', today)
      .order('period'),

    supabase
      .from('grades')
      .select('id,score,students(users(full_name)),exams(title)')
      .in('exam_id', examIds)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('attendance')
      .select('students(users(full_name)),subjects(name)')
      .eq('date', todayStr)
      .eq('status', 'absent')
      .in('section_id', sectionIds),

    supabase
      .from('attendance_tracking')
      .select(
        'period,is_recorded,subject_id,section_id,subjects(name),sections(name,classes(name))'
      )
      .eq('teacher_id', user.id)
      .eq('tracking_date', todayStr)
      .order('period'),
  ])

  const uniqueSections = new Set(mySections?.map((s) => s.section_id) || [])
    .size

  const publishedExams =
    myExams?.filter((e) => e.status === 'published').length ?? 0

  const avgScore = recentGrades?.length
    ? Math.round(
        recentGrades.reduce((a, g) => a + g.score, 0) /
          recentGrades.length
      )
    : 0

  const unrecorded =
    myTracking?.filter((t) => !t.is_recorded).length ?? 0

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={`مرحباً، ${profile?.full_name} 🎓`}
        subtitle={`${DAYS_AR[today]} — لوحة المعلم`}
      />

      {unrecorded > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          <div className="flex-1">
            <p className="font-bold text-orange-800 text-sm">
              تنبيه: {unrecorded} حصة لم تُسجّل
            </p>
          </div>
          <Link
            href="/dashboard/teacher/attendance"
            className="bg-orange-500 text-white px-4 py-2 rounded-xl text-xs font-bold"
          >
            تسجيل
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="فصولي" value={uniqueSections} icon={BookOpen} color="blue" />
        <StatCard title="اختبارات" value={publishedExams} icon={ClipboardList} color="purple" />
        <StatCard title="واجبات" value={myAssignments?.length ?? 0} icon={FileText} color="yellow" />
        <StatCard title="متوسط" value={`${avgScore}%`} icon={BarChart3} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            جدول اليوم
          </h2>

          {todaySchedule?.map((s) => (
            <div key={s.period} className="p-3 mb-2 bg-blue-50 rounded-xl">
              <p className="font-semibold">
                {(s.subjects as any)?.name}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white p-5 rounded-2xl">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-purple-600" />
            الاختبارات
          </h2>

          {myExams?.map((e) => (
            <div key={e.id} className="p-2 border-b">
              {e.title}
            </div>
          ))}
        </div>

        <div className="bg-white p-5 rounded-2xl">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            الدرجات
          </h2>

          {recentGrades?.map((g: any) => (
            <div key={g.id} className="p-2 flex justify-between">
              <span>{g.students?.users?.full_name}</span>
              <span>{Math.round(g.score)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
