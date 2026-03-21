import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { getScoreBg, formatDate } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'

export default async function AdminResultsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['admin','management'].includes(p?.role)) redirect('/dashboard')

  const { data: grades } = await supabase
    .from('grades')
    .select('*, students(users(full_name),sections(name,classes(name))), exams(title,pass_score,subjects(name),teachers(users(full_name)))')
    .order('created_at', { ascending: false })

  const total = grades?.length ?? 0
  const avg = total > 0 ? Math.round(grades!.reduce((a,g) => a+g.score, 0) / total) : 0
  const passed = grades?.filter(g => g.score >= ((g.exams as any)?.pass_score ?? 50)).length ?? 0
  const passRate = total > 0 ? Math.round((passed/total)*100) : 0

  return (
    <div className="p-6">
      <PageHeader title="كل النتائج والدرجات" subtitle="رؤية شاملة لكل نتائج المنصة" />
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { l:'إجمالي النتائج', v:total, bg:'bg-blue-50', c:'text-blue-600' },
          { l:'المتوسط العام', v:`${avg}%`, bg:'bg-purple-50', c:'text-purple-600' },
          { l:'إجمالي الناجحين', v:passed, bg:'bg-green-50', c:'text-green-600' },
          { l:'نسبة النجاح', v:`${passRate}%`, bg:'bg-orange-50', c:'text-orange-600' },
        ].map(s=>(
          <div key={s.l} className={`${s.bg} rounded-2xl p-4 text-center border border-gray-100`}>
            <p className={`text-3xl font-bold ${s.c}`}>{s.v}</p>
            <p className="text-sm text-gray-500 mt-1">{s.l}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600"/>
          <h2 className="font-bold text-gray-800">سجل النتائج الكامل</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-right px-4 py-3">الطالب</th>
              <th className="text-right px-4 py-3">الصف</th>
              <th className="text-right px-4 py-3">الاختبار</th>
              <th className="text-right px-4 py-3">المادة</th>
              <th className="text-right px-4 py-3">المعلم</th>
              <th className="text-center px-4 py-3">الدرجة</th>
              <th className="text-center px-4 py-3">الحالة</th>
              <th className="text-right px-4 py-3">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {grades?.map(g => {
              const exam = g.exams as any; const student = g.students as any
              const ok = g.score >= (exam?.pass_score ?? 50)
              return (
                <tr key={g.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-800">{student?.users?.full_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{student?.sections?.classes?.name} - {student?.sections?.name}</td>
                  <td className="px-4 py-3 text-gray-600">{exam?.title}</td>
                  <td className="px-4 py-3 text-gray-500">{exam?.subjects?.name}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{exam?.teachers?.users?.full_name}</td>
                  <td className="px-4 py-3 text-center"><span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getScoreBg(g.score)}`}>{Math.round(g.score)}%</span></td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${ok?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{ok?'ناجح':'راسب'}</span></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(g.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {grades?.length === 0 && <p className="text-center text-gray-400 py-10">لا توجد نتائج</p>}
      </div>
    </div>
  )
}
