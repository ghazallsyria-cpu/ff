import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { FileText, Plus, Clock, Users } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export default async function TeacherAssignmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: assignments } = await supabase
    .from('assignments')
    .select('*, subjects(name), sections(name, classes(name))')
    .eq('teacher_id', user.id)
    .order('due_date', { ascending: true })

  const assignmentIds = assignments?.map(a => a.id) || []
  const { data: submissionCounts } = assignmentIds.length > 0
    ? await supabase.from('assignment_submissions').select('assignment_id').in('assignment_id', assignmentIds)
    : { data: [] }

  const countMap = new Map<string, number>()
  submissionCounts?.forEach(s => {
    countMap.set(s.assignment_id, (countMap.get(s.assignment_id) || 0) + 1)
  })

  const now = new Date()

  return (
    <div className="p-6">
      <PageHeader title="الواجبات" subtitle="إدارة واجبات فصولك">
        <Link href="/dashboard/teacher/assignments/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" />إضافة واجب
        </Link>
      </PageHeader>

      {assignments?.length === 0
        ? <div className="bg-white rounded-2xl p-10 text-center text-gray-400 border">
            <FileText className="w-14 h-14 mx-auto mb-3 opacity-30" />
            <p>لا توجد واجبات بعد</p>
            <Link href="/dashboard/teacher/assignments/new" className="mt-3 inline-block text-sm text-blue-600 hover:underline">إضافة أول واجب</Link>
          </div>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {assignments?.map(a => {
              const dueDate = new Date(a.due_date)
              const overdue = now > dueDate
              const subCount = countMap.get(a.id) || 0
              return (
                <div key={a.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-800">{a.title}</h3>
                      <p className="text-sm text-blue-600">{(a.subjects as any)?.name}</p>
                      <p className="text-xs text-gray-400">{(a.sections as any)?.classes?.name} — شعبة {(a.sections as any)?.name}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${overdue ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                      {overdue ? 'انتهى الوقت' : 'نشط'}
                    </span>
                  </div>
                  {a.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{a.description}</p>}
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" />التسليم: {formatDateTime(a.due_date)}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-purple-600">
                      <Users className="w-3.5 h-3.5" />{subCount} تسليم
                    </span>
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
