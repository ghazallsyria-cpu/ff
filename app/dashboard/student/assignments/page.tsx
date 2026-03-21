import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { FileText, Clock, CheckCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export default async function StudentAssignmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase.from('students').select('section_id').eq('id', user.id).single()

  const { data: assignments } = await supabase
    .from('assignments')
    .select('*, subjects(name), teachers(users(full_name))')
    .eq('section_id', student?.section_id ?? '')
    .order('due_date')

  const { data: submissions } = await supabase
    .from('assignment_submissions')
    .select('assignment_id, status, grade, submitted_at')
    .eq('student_id', user.id)

  const submissionMap = new Map(submissions?.map(s => [s.assignment_id, s]) || [])
  const now = new Date()

  return (
    <div className="p-6">
      <PageHeader title="واجباتي" subtitle="جميع الواجبات المطلوبة منك" />
      {assignments?.length === 0
        ? <div className="bg-white rounded-2xl p-10 text-center text-gray-400 border"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد واجبات حالياً</p></div>
        : (
          <div className="space-y-4">
            {assignments?.map(a => {
              const sub = submissionMap.get(a.id)
              const dueDate = new Date(a.due_date)
              const overdue = !sub && now > dueDate
              return (
                <div key={a.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800">{a.title}</h3>
                      <p className="text-sm text-blue-600">{(a.subjects as any)?.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">المعلم: {(a.teachers as any)?.users?.full_name}</p>
                      {a.description && <p className="text-sm text-gray-600 mt-2">{a.description}</p>}
                    </div>
                    <div className="text-left flex-shrink-0">
                      {sub
                        ? <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-xl">
                            <CheckCircle className="w-4 h-4" />
                            {sub.grade ? `${sub.grade}% — مصحح` : 'تم التسليم'}
                          </span>
                        : <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl ${
                            overdue ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            <Clock className="w-4 h-4" />{overdue ? 'انتهى الوقت' : 'قيد الانتظار'}
                          </span>
                      }
                      <p className={`text-xs mt-2 text-left ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
                        التسليم: {formatDateTime(a.due_date)}
                      </p>
                    </div>
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
