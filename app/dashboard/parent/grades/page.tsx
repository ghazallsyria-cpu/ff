import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { getScoreBg, formatDate } from '@/lib/utils'

export default async function ParentGradesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: children } = await supabase.from('students').select('id, users(full_name)').eq('parent_id', user.id)
  const childIds = children?.map(c => c.id) || []

  const { data: grades } = childIds.length > 0
    ? await supabase.from('grades')
        .select('*, students(users(full_name)), exams(title, pass_score, subjects(name))')
        .in('student_id', childIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="p-6">
      <PageHeader title="نتائج ودرجات الأبناء" />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-right px-4 py-3">اسم الطالب</th>
              <th className="text-right px-4 py-3">الاختبار</th>
              <th className="text-right px-4 py-3">المادة</th>
              <th className="text-center px-4 py-3">الدرجة</th>
              <th className="text-center px-4 py-3">الحالة</th>
              <th className="text-right px-4 py-3">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(grades as any[])?.map((g: any) => {
              const passed = g.score >= (g.exams?.pass_score ?? 50)
              return (
                <tr key={g.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-800">{g.students?.users?.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{g.exams?.title}</td>
                  <td className="px-4 py-3 text-gray-500">{g.exams?.subjects?.name}</td>
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
