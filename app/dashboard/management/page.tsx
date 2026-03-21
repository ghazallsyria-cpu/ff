import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatCard from '@/components/shared/StatCard'
import PageHeader from '@/components/shared/PageHeader'
import { Users, UserCheck, BarChart3, Bell, GraduationCap, BookOpen } from 'lucide-react'

export default async function ManagementDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin','management'].includes(profile.role)) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const [
    { count: totalStudents }, { count: totalTeachers },
    { count: todayPresent }, { count: todayAbsent },
    { data: recentGrades }, { count: totalSections },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('teachers').select('*', { count: 'exact', head: true }),
    supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', today).eq('status', 'present'),
    supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', today).eq('status', 'absent'),
    supabase.from('grades').select('score, students(users(full_name)), exams(title, subjects(name))').order('created_at', { ascending: false }).limit(6),
    supabase.from('sections').select('*', { count: 'exact', head: true }),
  ])

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="لوحة الإدارة" subtitle="نظرة شاملة على أداء المدرسة اليوم" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="الطلاب" value={totalStudents ?? 0} icon={GraduationCap} color="blue" />
        <StatCard title="المعلمون" value={totalTeachers ?? 0} icon={Users} color="green" />
        <StatCard title="الشعب" value={totalSections ?? 0} icon={BookOpen} color="purple" />
        <StatCard title="حاضر اليوم" value={todayPresent ?? 0} icon={UserCheck} color="green" />
        <StatCard title="غائب اليوم" value={todayAbsent ?? 0} icon={UserCheck} color="red" />
        <StatCard title="نسبة الحضور" value={totalStudents ? `${Math.round(((todayPresent ?? 0) / totalStudents) * 100)}%` : '—'} icon={BarChart3} color="yellow" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-purple-600" />آخر النتائج</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {recentGrades?.map((g: any) => (
            <div key={g.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="font-medium text-gray-800 text-sm">{g.students?.users?.full_name}</p>
                <p className="text-xs text-gray-400">{g.exams?.title} — {g.exams?.subjects?.name}</p>
              </div>
              <span className={`px-3 py-1 rounded-lg text-xs font-bold ${g.score >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {Math.round(g.score)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
