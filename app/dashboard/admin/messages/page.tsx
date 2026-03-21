import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { MessageSquare, Users } from 'lucide-react'
import { formatDateTime, ROLE_AR } from '@/lib/utils'

export default async function AdminMessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') redirect('/dashboard')

  const [{ data: messages }, { data: groupMessages }] = await Promise.all([
    supabase.from('messages')
      .select('*, sender:sender_id(full_name,role), receiver:receiver_id(full_name,role)')
      .order('created_at', { ascending: false }).limit(100),
    supabase.from('group_messages')
      .select('*, sender:sender_id(full_name,role)')
      .order('created_at', { ascending: false }).limit(50),
  ])

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="مراقبة كل الرسائل" subtitle="صلاحية المدير — رؤية كاملة للمراسلات" />

      {/* Group messages */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b bg-purple-50 flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-600" />
          <h2 className="font-bold text-gray-800">الرسائل الجماعية ({groupMessages?.length ?? 0})</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {groupMessages?.map(m => (
            <div key={m.id} className="px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-800 text-sm">{(m.sender as any)?.full_name}
                  <span className="text-xs text-purple-600 mr-2 bg-purple-50 px-2 py-0.5 rounded-lg">{ROLE_AR[(m.sender as any)?.role]}</span>
                </span>
                <span className="text-xs text-gray-400">{formatDateTime(m.created_at)}</span>
              </div>
              {m.subject && <p className="text-sm font-medium text-gray-700 mb-1">{m.subject}</p>}
              <p className="text-sm text-gray-600">{m.content}</p>
            </div>
          ))}
          {groupMessages?.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">لا توجد رسائل جماعية</p>}
        </div>
      </div>

      {/* Individual messages */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b bg-blue-50 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-gray-800">الرسائل الفردية ({messages?.length ?? 0})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-right px-4 py-3">المرسل</th>
              <th className="text-right px-4 py-3">المستلم</th>
              <th className="text-right px-4 py-3">الموضوع</th>
              <th className="text-right px-4 py-3">المحتوى</th>
              <th className="text-center px-4 py-3">مقروءة</th>
              <th className="text-right px-4 py-3">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {messages?.map(m => (
              <tr key={m.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{(m.sender as any)?.full_name}</p>
                  <p className="text-xs text-gray-400">{ROLE_AR[(m.sender as any)?.role]}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{(m.receiver as any)?.full_name}</p>
                  <p className="text-xs text-gray-400">{ROLE_AR[(m.receiver as any)?.role]}</p>
                </td>
                <td className="px-4 py-3 text-gray-500">{m.subject || '—'}</td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{m.content}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${m.is_read ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {m.is_read ? 'مقروءة' : 'غير مقروءة'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{formatDateTime(m.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {messages?.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">لا توجد رسائل</p>}
      </div>
    </div>
  )
}
