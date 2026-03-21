import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { getScoreBg, formatDate } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'

export default async function ManagementGradesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['admin','management'].includes(profile?.role ?? '')) redirect('/dashboard')

  const { data: grades } = await supabase
    .from('grades')
    .select('*, students(users(full_name)), exams(title, pass_score, subjects(name), sections(name, classes(name)))')
    .order('created_at', { ascending: false })
    .limit(100)

  const total = grades?.length ?? 0
  const avg = total > 0 ? Math.round(grades!.reduce((a, g) => a + g.score, 0) / total) : 0
  const passed = grades?.filter(g => g.score >= ((g.exams as any)?.pass_score ?? 50)).length ?? 0

  return (
    <div className="p-6">
      <PageHeader title="النتائج والدرجات" subtitle="نظرة شاملة على أداء الطلاب" />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-2xl p-4 text-center border border-gray-100">
          <p className="text-3xl font-bold text-blue-600">{total}</p>
          <p className="text-sm text-gray-500 mt-1">إجمالي النتائج</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-4 text-center border border-gray-100">
          <p className="text-3xl font-bold text-green-600">{avg}%</p>
          <p className="text-sm text-gray-500 mt-1">المتوسط العام</p>
        </div>
        <div className="bg-purple-50 rounded-2xl p-4 text-center border border-gray-100">
          <p className="text-3xl font-bold text-purple-600">
            {total ? Math.round((passed / total) * 100) : 0}%
          </p>
          <p className="text-sm text-gray-500 mt-1">نسبة النجاح</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-600" />
          <h2 className="font-bold text-gray-800">آخر النتائج</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-right px-4 py-3">الطالب</th>
              <th className="text-right px-4 py-3">الاختبار</th>
              <th className="text-right px-4 py-3">المادة</th>
              <th className="text-right px-4 py-3">الصف</th>
              <th className="text-center px-4 py-3">الدرجة</th>
              <th className="text-center px-4 py-3">الحالة</th>
              <th className="text-right px-4 py-3">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {grades?.map(g => {
              const exam = g.exams as any
              const passed = g.score >= (exam?.pass_score ?? 50)
              return (
                <tr key={g.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-800">{(g.students as any)?.users?.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{exam?.title}</td>
                  <td className="px-4 py-3 text-gray-500">{exam?.subjects?.name}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{exam?.sections?.classes?.name} - {exam?.sections?.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getScoreBg(g.score)}`}>{Math.round(g.score)}%</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {passed ? 'ناجح' : 'راسب'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(g.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {grades?.length === 0 && <p className="text-center text-gray-400 py-10">لا توجد نتائج بعد</p>}
      </div>
    </div>
  )
}
