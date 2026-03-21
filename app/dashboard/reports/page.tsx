import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { BarChart3, TrendingUp, Users, UserCheck } from 'lucide-react'

export default async function AdminReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'management'].includes(profile?.role ?? '')) redirect('/dashboard')

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i)
    return d.toISOString().split('T')[0]
  }).reverse()

  const { data: attendanceData } = await supabase
    .from('attendance').select('date, status').in('date', last7Days)

  const { data: gradesData } = await supabase.from('grades').select('score')
  const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true })
  const { count: totalTeachers } = await supabase.from('teachers').select('*', { count: 'exact', head: true })

  const byDay = last7Days.map(date => {
    const dayRecords = attendanceData?.filter(a => a.date === date) || []
    return {
      date, present: dayRecords.filter(a => a.status === 'present').length,
      absent: dayRecords.filter(a => a.status === 'absent').length,
      total: dayRecords.length,
    }
  })

  const avgScore = gradesData?.length
    ? Math.round(gradesData.reduce((a, g) => a + g.score, 0) / gradesData.length) : 0
  const passRate = gradesData?.length
    ? Math.round((gradesData.filter(g => g.score >= 50).length / gradesData.length) * 100) : 0

  const scoreRanges = [
    { label: '90-100%', count: gradesData?.filter(g => g.score >= 90).length ?? 0, color: 'bg-green-500' },
    { label: '75-89%',  count: gradesData?.filter(g => g.score >= 75 && g.score < 90).length ?? 0, color: 'bg-blue-500' },
    { label: '50-74%',  count: gradesData?.filter(g => g.score >= 50 && g.score < 75).length ?? 0, color: 'bg-yellow-500' },
    { label: 'أقل من 50%', count: gradesData?.filter(g => g.score < 50).length ?? 0, color: 'bg-red-500' },
  ]
  const maxScore = Math.max(...scoreRanges.map(s => s.count), 1)

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="تقارير وإحصائيات المدرسة" />

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الطلاب', val: totalStudents ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'إجمالي المعلمين', val: totalTeachers ?? 0, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'متوسط الدرجات', val: `${avgScore}%`, icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'نسبة النجاح', val: `${passRate}%`, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-5 border border-gray-100`}>
            <s.icon className={`w-6 h-6 ${s.color} mb-2`} />
            <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Attendance Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />الحضور — آخر 7 أيام
          </h3>
          <div className="space-y-3">
            {byDay.map(d => {
              const rate = d.total > 0 ? Math.round((d.present / d.total) * 100) : 0
              return (
                <div key={d.date}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{d.date}</span>
                    <span>{d.present} حاضر / {d.total} مسجّل ({rate}%)</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${rate >= 80 ? 'bg-green-500' : rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${rate}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Score Distribution */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />توزيع الدرجات
          </h3>
          <div className="space-y-4">
            {scoreRanges.map(r => (
              <div key={r.label}>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>{r.label}</span>
                  <span className="font-semibold">{r.count} طالب</span>
                </div>
                <div className="h-7 bg-gray-100 rounded-xl overflow-hidden flex items-center px-2">
                  <div className={`h-4 rounded-lg ${r.color} transition-all`}
                    style={{ width: `${(r.count / maxScore) * 100}%`, minWidth: r.count > 0 ? '8px' : '0' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
