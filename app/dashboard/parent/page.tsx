import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import { UserCheck, BarChart3, FileText, GraduationCap } from 'lucide-react'
import { ATTENDANCE_STATUS_AR, formatDate, getScoreBg } from '@/lib/utils'
import Link from 'next/link'

export default async function ParentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: children } = await supabase
    .from('students')
    .select('id, users(full_name), sections(name, classes(name))')
    .eq('parent_id', user.id)

  const childIds = children?.map(c => c.id) || []

  const [{ data: attendances }, { data: grades }, { data: assignments }] = await Promise.all([
    childIds.length > 0
      ? supabase.from('attendance').select('student_id, date, status, subjects(name), students(users(full_name))').in('student_id', childIds).order('date', { ascending: false }).limit(10)
      : Promise.resolve({ data: [] }),
    childIds.length > 0
      ? supabase.from('grades').select('score, student_id, exams(title, pass_score, subjects(name)), students(users(full_name))').in('student_id', childIds).order('created_at', { ascending: false }).limit(8)
      : Promise.resolve({ data: [] }),
    childIds.length > 0
      ? supabase.from('assignments').select('title, due_date, subjects(name)').in('section_id', children?.map(c => (c.sections as any)?.id).filter(Boolean) || []).order('due_date').limit(5)
      : Promise.resolve({ data: [] }),
  ])

  const presentCount = attendances?.filter(a => a.status === 'present').length ?? 0
  const absentCount = attendances?.filter(a => a.status === 'absent').length ?? 0
  const avgScore = grades && grades.length > 0
    ? Math.round((grades as any[]).reduce((a: number, g: any) => a + g.score, 0) / grades.length)
    : 0

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="لوحة متابعة الأبناء" subtitle="تابع أداء أبنائك بشكل مباشر" />

      {/* Children Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children?.map(child => (
          <div key={child.id} className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl font-bold">
                {(child.users as any)?.full_name?.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-lg">{(child.users as any)?.full_name}</p>
                <p className="text-blue-200 text-sm">{(child.sections as any)?.classes?.name} — شعبة {(child.sections as any)?.name}</p>
              </div>
            </div>
          </div>
        ))}
        {children?.length === 0 && (
          <div className="col-span-2 bg-white rounded-2xl p-8 text-center text-gray-400 border">
            <GraduationCap className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>لا يوجد أبناء مسجلون في حسابك</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="إجمالي الأبناء" value={children?.length ?? 0} icon={GraduationCap} color="blue" />
        <StatCard title="حضور (10 أيام)" value={presentCount} icon={UserCheck} color="green" />
        <StatCard title="غياب (10 أيام)" value={absentCount} icon={UserCheck} color="red" />
        <StatCard title="متوسط الدرجات" value={`${avgScore}%`} icon={BarChart3} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Attendance */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><UserCheck className="w-5 h-5 text-blue-600" />آخر سجلات الحضور</h2>
            <Link href="/dashboard/parent/attendance" className="text-xs text-blue-600">عرض الكل</Link>
          </div>
          {attendances?.length === 0
            ? <p className="text-gray-400 text-sm text-center py-4">لا توجد سجلات</p>
            : attendances?.slice(0, 6).map(a => (
              <div key={a.id} className="flex items-center gap-3 p-2.5 mb-1.5 hover:bg-gray-50 rounded-xl">
                <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
                  a.status === 'present' ? 'bg-green-100 text-green-700' :
                  a.status === 'absent' ? 'bg-red-100 text-red-700' :
                  a.status === 'late' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                }`}>{ATTENDANCE_STATUS_AR[a.status]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{(a.students as any)?.users?.full_name}</p>
                  <p className="text-xs text-gray-400">{(a.subjects as any)?.name} — {formatDate(a.date)}</p>
                </div>
              </div>
            ))
          }
        </div>

        {/* Recent Grades */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-purple-600" />آخر النتائج</h2>
            <Link href="/dashboard/parent/grades" className="text-xs text-blue-600">عرض الكل</Link>
          </div>
          {grades?.length === 0
            ? <p className="text-gray-400 text-sm text-center py-4">لا توجد نتائج</p>
            : (grades as any[])?.map((g: any) => (
              <div key={g.id} className="flex items-center justify-between p-2.5 mb-1.5 hover:bg-gray-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{g.exams?.title}</p>
                  <p className="text-xs text-gray-400">{g.students?.users?.full_name} — {g.exams?.subjects?.name}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getScoreBg(g.score)}`}>{Math.round(g.score)}%</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
