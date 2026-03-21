import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/shared/Sidebar'
import { UserRole } from '@/types/database'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('full_name, email, role, must_reset_password').eq('id', user.id).single()
  if (!profile) redirect('/login')
  if (profile.must_reset_password) redirect('/reset-password')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role={profile.role as UserRole} userName={profile.full_name} userEmail={profile.email} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
