import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { FileText, Clock, CheckCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export default async function ParentAssignmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: children } = await supabase
    .from('students')
    .select('id, section_id, users(full_name)')
    .eq('parent_id', user.id)

  const sectionIds = [...new Set(children?.map(c => c.section_id).filter(Boolean) || [])]
  const childIds = children?.map(c => c.id) || []

  const { data: assignments } = sectionIds.length > 0
    ? await supabase.from('assignments')
        .select('*, subjects(name), sections(name, classes(name)), teachers(users(full_name))')
        .in('section_id', sectionIds)
        .order('due_date')
    : { data: [] }

  const { data: submissions } = childIds.length > 0
    ? await supabase.from('assignment_submissions')
        .select('assignment_id, student_id, status, grade')
        .in('student_id', childIds)
    : { data: [] }

  const now = new Date()

  return (
    <div className="p-6">
      <PageHeader title="واجبات الأبناء" subtitle="متابعة الواجبات المطلوبة" />
      {assignments?.length === 0
        ? <div className="bg-white rounded-2xl p-10 text-center text-gray-400 border">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد واجبات حالياً</p>
          </div>
        : (
          <div className="space-y-4">
            {assignments?.map(a => {
              const overdue = now > new Date(a.due_date)
              const childSubmissions = submissions?.filter(s => s.assignment_id === a.id) || []
              return (
                <div key={a.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-bold text-gray-800">{a.title}</h3>
                      <p className="text-sm text-blue-600">{(a.subjects as any)?.name} — {(a.sections as any)?.classes?.name} شعبة {(a.sections as any)?.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">المعلم: {(a.teachers as any)?.users?.full_name}</p>
                      {a.description && <p className="text-sm text-gray-600 mt-2">{a.description}</p>}
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl flex-shrink-0 ${overdue ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      <Clock className="w-3.5 h-3.5" />{overdue ? 'انتهى الوقت' : 'نشط'}
                    </span>
                  </div>
                  <div className="border-t pt-3">
                    <p className="text-xs text-gray-500 mb-2 font-medium">تسليمات الأبناء:</p>
                    <div className="flex flex-wrap gap-2">
                      {children?.map(child => {
                        const sub = childSubmissions.find(s => s.student_id === child.id)
                        return (
                          <div key={child.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${sub ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {sub ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            {(child.users as any)?.full_name}
                            {sub?.grade ? ` — ${sub.grade}%` : sub ? ' (مسلّم)' : ' (لم يسلّم)'}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <p className={`text-xs mt-2 ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
                    موعد التسليم: {formatDateTime(a.due_date)}
                  </p>
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}
