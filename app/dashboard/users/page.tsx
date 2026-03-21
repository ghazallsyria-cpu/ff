import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { Users, Search } from 'lucide-react'
import { ROLE_AR, formatDate } from '@/lib/utils'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'management'].includes(profile?.role ?? '')) redirect('/dashboard')

  const { data: users } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  const roleColors: Record<string, string> = {
    admin:      'bg-red-100 text-red-700',
    management: 'bg-purple-100 text-purple-700',
    teacher:    'bg-blue-100 text-blue-700',
    student:    'bg-green-100 text-green-700',
    parent:     'bg-yellow-100 text-yellow-700',
  }

  return (
    <div className="p-6">
      <PageHeader title="إدارة المستخدمين" subtitle={`${users?.length ?? 0} مستخدم مسجل`} />

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {['admin','management','teacher','student','parent'].map(role => (
          <div key={role} className="bg-white rounded-xl p-4 text-center border border-gray-100 shadow-sm">
            <p className="text-2xl font-bold text-gray-800">{users?.filter(u => u.role === role).length ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">{ROLE_AR[role]}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-gray-800">قائمة المستخدمين</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-right px-4 py-3">الاسم الكامل</th>
              <th className="text-right px-4 py-3">البريد الإلكتروني</th>
              <th className="text-right px-4 py-3">رقم الهاتف</th>
              <th className="text-center px-4 py-3">الدور</th>
              <th className="text-center px-4 py-3">كلمة المرور</th>
              <th className="text-right px-4 py-3">تاريخ التسجيل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users?.map(u => (
              <tr key={u.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {u.full_name?.charAt(0)}
                    </div>
                    <span className="font-medium text-gray-800">{u.full_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3 text-gray-400">{u.phone || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${roleColors[u.role] || 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_AR[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs ${u.must_reset_password ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                    {u.must_reset_password ? 'يجب التغيير' : 'محدّثة'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
