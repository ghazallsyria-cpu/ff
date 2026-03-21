import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { FileText, Clock, CheckCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export default async function AdminAssignmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['admin','management'].includes(p?.role)) redirect('/dashboard')

  const { data: assignments } = await supabase
    .from('assignments')
    .select('*, subjects(name), sections(name,classes(name)), teachers(users(full_name))')
    .order('created_at', { ascending: false })

  const assignmentIds = assignments?.map(a => a.id) || []
  const { data: submissions } = assignmentIds.length > 0
    ? await supabase.from('assignment_submissions').select('assignment_id, status, grade').in('assignment_id', assignmentIds)
    : { data: [] }

  const subMap = new Map<string, any[]>()
  submissions?.forEach(s => {
    if (!subMap.has(s.assignment_id)) subMap.set(s.assignment_id, [])
    subMap.get(s.assignment_id)!.push(s)
  })

  const now = new Date()

  return (
    <div className="p-6">
      <PageHeader title="كل الواجبات" subtitle={`${assignments?.length ?? 0} واجب في المنصة`} />
      <div className="space-y-4">
        {assignments?.length === 0
          ? <div className="bg-white rounded-2xl p-10 text-center text-gray-400 border"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>لا توجد واجبات</p></div>
          : assignments?.map(a => {
            const subs = subMap.get(a.id) || []
            const graded = subs.filter(s => s.status === 'graded').length
            const overdue = now > new Date(a.due_date)
            return (
              <div key={a.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-gray-800">{a.title}</h3>
                    <p className="text-sm text-blue-600">{(a.subjects as any)?.name} — {(a.sections as any)?.classes?.name} شعبة {(a.sections as any)?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">المعلم: {(a.teachers as any)?.users?.full_name}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${overdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {overdue ? 'انتهى' : 'نشط'}
                  </span>
                </div>
                {a.description && <p className="text-sm text-gray-600 mb-3">{a.description}</p>}
                <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-3">
                  <span className="flex items-center gap-1"><Clock size={12}/>التسليم: {formatDateTime(a.due_date)}</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-blue-600"><FileText size={12}/>{subs.length} تسليم</span>
                    <span className="flex items-center gap-1 text-green-600"><CheckCircle size={12}/>{graded} مصحّح</span>
                  </div>
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
