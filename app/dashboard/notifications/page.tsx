import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { Bell, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Mark all as read
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)

  const typeConfig: Record<string, { icon: any; color: string; bg: string; border: string }> = {
    info:    { icon: Info,          color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100' },
    warning: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100' },
    success: { icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-100' },
    error:   { icon: XCircle,       color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-100' },
  }

  const unread = notifications?.filter(n => !n.is_read).length ?? 0

  return (
    <div className="p-6">
      <PageHeader title="الإشعارات" subtitle={`${notifications?.length ?? 0} إشعار`} />
      {notifications?.length === 0
        ? <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
            <Bell className="w-14 h-14 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">لا توجد إشعارات</p>
          </div>
        : (
          <div className="space-y-3">
            {notifications?.map(n => {
              const tc = typeConfig[n.type] || typeConfig.info
              const Icon = tc.icon
              return (
                <div key={n.id} className={`flex items-start gap-4 p-4 rounded-2xl border shadow-sm ${tc.bg} ${tc.border}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white shadow-sm`}>
                    <Icon className={`w-5 h-5 ${tc.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800">{n.title}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1.5">{formatDateTime(n.created_at)}</p>
                  </div>
                  {n.link && (
                    <a href={n.link} className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white ${tc.color} border ${tc.border}`}>
                      عرض
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}
