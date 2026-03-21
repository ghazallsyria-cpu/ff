import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { ClipboardList, Plus, Clock, Users } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export default async function TeacherExamsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: exams } = await supabase
    .from('exams')
    .select('*, subjects(name), sections(name, classes(name))')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  const statusLabels: Record<string, { label: string; bg: string; text: string }> = {
    draft:     { label: 'مسودة',    bg: 'bg-gray-100',   text: 'text-gray-600' },
    published: { label: 'منشور',    bg: 'bg-green-100',  text: 'text-green-700' },
    archived:  { label: 'مؤرشف',   bg: 'bg-yellow-100', text: 'text-yellow-700' },
  }

  return (
    <div className="p-6">
      <PageHeader title="اختباراتي" subtitle="إدارة اختبارات فصولك">
        <Link href="/dashboard/teacher/exams/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" />إنشاء اختبار
        </Link>
      </PageHeader>

      {exams?.length === 0
        ? <div className="bg-white rounded-2xl p-10 text-center text-gray-400 border">
            <ClipboardList className="w-14 h-14 mx-auto mb-3 opacity-30" />
            <p className="font-medium">لا توجد اختبارات بعد</p>
            <Link href="/dashboard/teacher/exams/new" className="mt-4 inline-block text-sm text-blue-600 hover:underline">إنشاء أول اختبار</Link>
          </div>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {exams?.map(exam => {
              const st = statusLabels[exam.status] || statusLabels.draft
              return (
                <div key={exam.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-800">{exam.title}</h3>
                      <p className="text-sm text-blue-600">{(exam.subjects as any)?.name}</p>
                      <p className="text-xs text-gray-400">{(exam.sections as any)?.classes?.name} — شعبة {(exam.sections as any)?.name}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${st.bg} ${st.text}`}>{st.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-4 border-t pt-3">
                    {exam.duration && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{exam.duration} دقيقة</span>}
                    <span>درجة النجاح: {exam.pass_score}%</span>
                    <span>عدد المحاولات: {exam.max_attempts}</span>
                    {exam.start_at && <span>يبدأ: {formatDateTime(exam.start_at)}</span>}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/dashboard/teacher/exams/${exam.id}`}
                      className="flex-1 text-center bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-xl text-xs font-semibold transition-colors">
                      عرض التفاصيل
                    </Link>
                    <Link href={`/dashboard/teacher/exams/${exam.id}/results`}
                      className="flex items-center gap-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold transition-colors">
                      <Users className="w-3.5 h-3.5" />النتائج
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}
