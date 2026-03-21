import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { ClipboardList, Clock } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export default async function AdminExamsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['admin','management'].includes(p?.role)) redirect('/dashboard')

  const { data: exams } = await supabase
    .from('exams')
    .select('*, subjects(name), sections(name,classes(name)), teachers(users(full_name))')
    .order('created_at', { ascending: false })

  const { data: attemptsCount } = await supabase
    .from('exam_attempts').select('exam_id')

  const attemptMap = new Map<string, number>()
  attemptsCount?.forEach(a => attemptMap.set(a.exam_id, (attemptMap.get(a.exam_id) || 0) + 1))

  const statusStyle: Record<string, string> = {
    draft:     'bg-gray-100 text-gray-600',
    published: 'bg-green-100 text-green-700',
    archived:  'bg-yellow-100 text-yellow-700',
  }
  const statusLabel: Record<string, string> = { draft:'مسودة', published:'منشور', archived:'مؤرشف' }

  return (
    <div className="p-6">
      <PageHeader title="كل الاختبارات" subtitle={`${exams?.length ?? 0} اختبار في المنصة`} />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-right px-4 py-3">الاختبار</th>
              <th className="text-right px-4 py-3">المادة</th>
              <th className="text-right px-4 py-3">الشعبة</th>
              <th className="text-right px-4 py-3">المعلم</th>
              <th className="text-center px-4 py-3">المحاولات</th>
              <th className="text-center px-4 py-3">الحالة</th>
              <th className="text-right px-4 py-3">يبدأ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {exams?.map(e => (
              <tr key={e.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{e.title}</p>
                  {e.duration && <p className="text-xs text-gray-400 flex items-center gap-1"><Clock size={10}/>{e.duration} دقيقة</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">{(e.subjects as any)?.name}</td>
                <td className="px-4 py-3 text-gray-500">{(e.sections as any)?.classes?.name} - {(e.sections as any)?.name}</td>
                <td className="px-4 py-3 text-gray-500">{(e.teachers as any)?.users?.full_name}</td>
                <td className="px-4 py-3 text-center font-semibold text-gray-700">{attemptMap.get(e.id) || 0}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusStyle[e.status]}`}>{statusLabel[e.status]}</span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{e.start_at ? formatDateTime(e.start_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {exams?.length === 0 && <p className="text-center text-gray-400 py-10">لا توجد اختبارات</p>}
      </div>
    </div>
  )
}
