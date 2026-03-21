import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { getScoreBg, formatDate } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'

export default async function TeacherGradesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: grades } = await supabase
    .from('grades')
    .select('*, students(users(full_name), national_id), exams(title, pass_score, subjects(name), sections(name, classes(name)))')
    .in('exam_id', (await supabase.from('exams').select('id').eq('teacher_id', user.id)).data?.map(e => e.id) || [])
    .order('created_at', { ascending: false })

  const avg = grades && grades.length > 0
    ? Math.round(grades.reduce((a, g) => a + g.score, 0) / grades.length) : 0
  const passed = grades?.filter(g => g.score >= ((g.exams as any)?.pass_score ?? 50)).length ?? 0

  return (
    <div className="p-6">
      <PageHeader title="درجات الطلاب" subtitle="نتائج اختبارات فصولك" />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{grades?.length ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">إجمالي النتائج</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{avg}%</p>
          <p className="text-sm text-gray-500 mt-1">المتوسط العام</p>
        </div>
        <div className="bg-purple-50 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-purple-600">
            {grades?.length ? Math.round((passed / grades.length) * 100) : 0}%
          </p>
          <p className="text-sm text-gray-500 mt-1">نسبة النجاح</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-gray-800">سجل الدرجات</h2>
        </div>
        {grades?.length === 0
          ? <p className="text-center text-gray-400 py-10">لا توجد درجات بعد</p>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-right px-4 py-3">اسم الطالب</th>
                  <th className="text-right px-4 py-3">الاختبار</th>
                  <th className="text-right px-4 py-3">المادة</th>
                  <th className="text-right px-4 py-3">الشعبة</th>
                  <th className="text-center px-4 py-3">الدرجة</th>
                  <th className="text-center px-4 py-3">الحالة</th>
                  <th className="text-right px-4 py-3">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {grades?.map(g => {
                  const exam = g.exams as any
                  const student = g.students as any
                  const pass = g.score >= exam?.pass_score
                  return (
                    <tr key={g.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-800">{student?.users?.full_name}</td>
                      <td className="px-4 py-3 text-gray-600">{exam?.title}</td>
                      <td className="px-4 py-3 text-gray-500">{exam?.subjects?.name}</td>
                      <td className="px-4 py-3 text-gray-500">{exam?.sections?.classes?.name} - {exam?.sections?.name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getScoreBg(g.score)}`}>{Math.round(g.score)}%</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {pass ? 'ناجح' : 'راسب'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(g.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  )
}
