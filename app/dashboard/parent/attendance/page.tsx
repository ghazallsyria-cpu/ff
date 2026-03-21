import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { ATTENDANCE_STATUS_AR, formatDate } from '@/lib/utils'
import { UserCheck } from 'lucide-react'

export default async function ParentAttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: children } = await supabase.from('students').select('id, users(full_name)').eq('parent_id', user.id)
  const childIds = children?.map(c => c.id) || []

  const { data: records } = childIds.length > 0
    ? await supabase.from('attendance')
        .select('*, students(users(full_name)), subjects(name)')
        .in('student_id', childIds)
        .order('date', { ascending: false })
    : { data: [] }

  return (
    <div className="p-6">
      <PageHeader title="سجل حضور وغياب الأبناء" />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-right px-4 py-3">اسم الطالب</th>
              <th className="text-right px-4 py-3">التاريخ</th>
              <th className="text-right px-4 py-3">المادة</th>
              <th className="text-right px-4 py-3">الحصة</th>
              <th className="text-center px-4 py-3">الحالة</th>
              <th className="text-right px-4 py-3">ملاحظات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records?.map(r => (
              <tr key={r.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-800">{(r.students as any)?.users?.full_name}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(r.date)}</td>
                <td className="px-4 py-3 text-gray-500">{(r.subjects as any)?.name}</td>
                <td className="px-4 py-3 text-gray-400">الحصة {r.period}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    r.status === 'present' ? 'bg-green-100 text-green-700' :
                    r.status === 'absent'  ? 'bg-red-100 text-red-700' :
                    r.status === 'late'    ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                  }`}>{ATTENDANCE_STATUS_AR[r.status]}</span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{r.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {records?.length === 0 && <p className="text-center text-gray-400 py-10">لا توجد سجلات</p>}
      </div>
    </div>
  )
}
