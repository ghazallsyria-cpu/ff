import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { Bell } from 'lucide-react'
import { formatDateTime, ROLE_AR } from '@/lib/utils'

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: announcements } = await supabase
    .from('announcements')
    .select('*, users(full_name)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6">
      <PageHeader title="الإعلانات المدرسية" subtitle={`${announcements?.length ?? 0} إعلان`} />
      <div className="space-y-4">
        {announcements?.length === 0
          ? <div className="bg-white rounded-2xl p-10 text-center text-gray-400 border">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد إعلانات</p>
            </div>
          : announcements?.map(a => (
            <div key={a.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-gray-800 text-lg">{a.title}</h3>
                {a.target_role && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg font-medium">
                    {a.target_role === 'all' ? 'للجميع' : ROLE_AR[a.target_role]}
                  </span>
                )}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed mb-3">{a.content}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400 border-t pt-3">
                <span>بواسطة: {(a.users as any)?.full_name || 'النظام'}</span>
                <span>•</span>
                <span>{formatDateTime(a.created_at)}</span>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}
