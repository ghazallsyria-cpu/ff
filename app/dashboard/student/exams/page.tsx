import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { ClipboardList, Clock, CheckCircle, XCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export default async function StudentExamsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase.from('students').select('section_id').eq('id', user.id).single()

  const { data: exams } = await supabase
    .from('exams')
    .select('*, subjects(name), teachers(users(full_name))')
    .eq('section_id', student?.section_id ?? '')
    .eq('status', 'published')
    .order('start_at', { ascending: false })

  const { data: attempts } = await supabase
    .from('exam_attempts')
    .select('exam_id, status, score')
    .eq('student_id', user.id)

  const attemptMap = new Map(attempts?.map(a => [a.exam_id, a]) || [])
  const now = new Date()

  return (
    <div className="p-6">
      <PageHeader title="اختباراتي" subtitle="جميع الاختبارات المتاحة لشعبتي" />
      {exams?.length === 0
        ? <div className="bg-white rounded-2xl p-10 text-center text-gray-400 shadow-sm border"><ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد اختبارات متاحة حالياً</p></div>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {exams?.map(exam => {
              const attempt = attemptMap.get(exam.id)
              const startAt = exam.start_at ? new Date(exam.start_at) : null
              const endAt = exam.end_at ? new Date(exam.end_at) : null
              const isActive = (!startAt || now >= startAt) && (!endAt || now <= endAt)
              const isExpired = endAt && now > endAt
              const isNotStarted = startAt && now < startAt
              const completed = attempt?.status === 'completed' || attempt?.status === 'graded'
              return (
                <div key={exam.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-800">{exam.title}</h3>
                      <p className="text-sm text-blue-600 mt-0.5">{(exam.subjects as any)?.name}</p>
                      <p className="text-xs text-gray-400">المعلم: {(exam.teachers as any)?.users?.full_name}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      completed ? 'bg-green-100 text-green-700' :
                      isExpired ? 'bg-red-100 text-red-600' :
                      isNotStarted ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {completed ? 'مكتمل' : isExpired ? 'انتهى' : isNotStarted ? 'لم يبدأ' : 'متاح الآن'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-4">
                    {exam.duration && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{exam.duration} دقيقة</span>}
                    {exam.start_at && <span>يبدأ: {formatDateTime(exam.start_at)}</span>}
                    {exam.end_at && <span>ينتهي: {formatDateTime(exam.end_at)}</span>}
                  </div>

                  {completed
                    ? <div className="flex items-center justify-between bg-green-50 rounded-xl p-3">
                        <div className="flex items-center gap-2 text-green-700"><CheckCircle className="w-4 h-4" />تم الأداء</div>
                        {attempt?.score !== undefined && <span className="font-bold text-green-700">{Math.round(attempt.score)}%</span>}
                      </div>
                    : isActive && !completed
                    ? <Link href={`/dashboard/student/exams/${exam.id}`}
                        className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors">
                        دخول الاختبار
                      </Link>
                    : isExpired
                    ? <div className="flex items-center gap-2 text-red-500 text-sm"><XCircle className="w-4 h-4" />انتهى وقت الاختبار</div>
                    : <p className="text-sm text-yellow-600 text-center py-2">الاختبار لم يبدأ بعد</p>
                  }
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}
