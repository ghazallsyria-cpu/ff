import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { UserCheck } from 'lucide-react'
import { ATTENDANCE_STATUS_AR, formatDate } from '@/lib/utils'

export default async function StudentAttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: records } = await supabase
    .from('attendance')
    .select('*, subjects(name)')
    .eq('student_id', user.id)
    .order('date', { ascending: false })

  const total = records?.length ?? 0
  const present = records?.filter(r => r.status === 'present').length ?? 0
  const absent = records?.filter(r => r.status === 'absent').length ?? 0
  const late = records?.filter(r => r.status === 'late').length ?? 0
  const rate = total > 0 ? Math.round((present / total) * 100) : 0

  return (
    <div className="p-6">
      <PageHeader title="سجل حضوري وغيابي" />
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'نسبة الحضور', val: `${rate}%`, bg: 'bg-blue-50', color: 'text-blue-600' },
          { label: 'حاضر', val: present, bg: 'bg-green-50', color: 'text-green-600' },
          { label: 'غائب', val: absent, bg: 'bg-red-50', color: 'text-red-600' },
          { label: 'متأخر', val: late, bg: 'bg-yellow-50', color: 'text-yellow-600' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
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
                <td className="px-4 py-3 font-medium text-gray-700">{formatDate(r.date)}</td>
                <td className="px-4 py-3 text-gray-500">{(r.subjects as any)?.name}</td>
                <td className="px-4 py-3 text-gray-500">الحصة {r.period}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    r.status === 'present' ? 'bg-green-100 text-green-700' :
                    r.status === 'absent' ? 'bg-red-100 text-red-700' :
                    r.status === 'late' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                  }`}>{ATTENDANCE_STATUS_AR[r.status]}</span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{r.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {records?.length === 0 && <p className="text-center text-gray-400 py-8">لا توجد سجلات حضور</p>}
      </div>
    </div>
  )
}
