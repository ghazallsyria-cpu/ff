import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { ATTENDANCE_STATUS_AR, formatDate } from '@/lib/utils'
import { UserCheck } from 'lucide-react'

export default async function ManagementAttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['admin','management'].includes(profile?.role ?? '')) redirect('/dashboard')

  const today = new Date().toISOString().split('T')[0]

  const { data: records } = await supabase
    .from('attendance')
    .select('*, students(users(full_name), national_id), subjects(name), sections(name, classes(name))')
    .eq('date', today)
    .order('created_at', { ascending: false })

  const present = records?.filter(r => r.status === 'present').length ?? 0
  const absent = records?.filter(r => r.status === 'absent').length ?? 0
  const late = records?.filter(r => r.status === 'late').length ?? 0
  const total = records?.length ?? 0

  return (
    <div className="p-6">
      <PageHeader title="سجلات الحضور والغياب" subtitle={`اليوم — ${formatDate(today)}`} />
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'إجمالي السجلات', val: total, bg: 'bg-blue-50', color: 'text-blue-600' },
          { label: 'حاضر', val: present, bg: 'bg-green-50', color: 'text-green-600' },
          { label: 'غائب', val: absent, bg: 'bg-red-50', color: 'text-red-600' },
          { label: 'متأخر', val: late, bg: 'bg-yellow-50', color: 'text-yellow-600' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center border border-gray-100`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-gray-800">سجل الحضور اليوم</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-right px-4 py-3">اسم الطالب</th>
              <th className="text-right px-4 py-3">الصف / الشعبة</th>
              <th className="text-right px-4 py-3">المادة</th>
              <th className="text-center px-4 py-3">الحصة</th>
              <th className="text-center px-4 py-3">الحالة</th>
              <th className="text-right px-4 py-3">ملاحظات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records?.map(r => (
              <tr key={r.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-800">{(r.students as any)?.users?.full_name}</td>
                <td className="px-4 py-3 text-gray-500">{(r.sections as any)?.classes?.name} - {(r.sections as any)?.name}</td>
                <td className="px-4 py-3 text-gray-500">{(r.subjects as any)?.name}</td>
                <td className="px-4 py-3 text-center text-gray-400">الحصة {r.period}</td>
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
        {records?.length === 0 && <p className="text-center text-gray-400 py-10">لا توجد سجلات حضور لليوم</p>}
      </div>
    </div>
  )
}
