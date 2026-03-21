'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, ROLE_AR } from '@/lib/utils'
import type { UserRole } from '@/types/database'
import NotificationBell from './NotificationBell'
import { LayoutDashboard, Heart, BookOpen, BarChart3, Video, Users, BookOpen, Calendar, ClipboardList, MessageSquare, Bell, Settings, LogOut, GraduationCap, ChevronLeft, BarChart3, FileText, UserCheck } from 'lucide-react'

const NAV: Record<string, { href: string; label: string; icon: any }[]> = {
  admin: [
    { href: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { href: '/dashboard/users', label: 'المستخدمون', icon: Users },
    { href: '/dashboard/classes', label: 'الصفوف والشعب', icon: BookOpen },
    { href: '/dashboard/schedules', label: 'الجداول', icon: Calendar },
    { href: '/dashboard/admin/messages', label: 'كل الرسائل', icon: MessageSquare },
    { href: '/dashboard/admin/exams', label: 'كل الاختبارات', icon: ClipboardList },
    { href: '/dashboard/admin/assignments', label: 'كل الواجبات', icon: FileText },
    { href: '/dashboard/admin/results', label: 'كل النتائج', icon: BarChart3 },
    { href: '/dashboard/admin/attendance-tracking', label: 'متابعة الحضور', icon: UserCheck },
    { href: '/dashboard/admin/zoom-monitor', label: 'مراقبة Zoom', icon: Video },
    { href: '/dashboard/admin/library', label: 'المكتبة', icon: BookOpen },
    { href: '/dashboard/admin/wellbeing', label: 'الدعم النفسي', icon: Heart },
    { href: '/dashboard/reports', label: 'التقارير', icon: BarChart3 },
    { href: '/dashboard/announcements', label: 'الإعلانات', icon: Bell },
  ],
  management: [
    { href: '/dashboard/management', label: 'الرئيسية', icon: LayoutDashboard },
    { href: '/dashboard/management/attendance', label: 'الحضور', icon: UserCheck },
    { href: '/dashboard/management/grades', label: 'النتائج', icon: BarChart3 },
    { href: '/dashboard/management/announcements', label: 'الإعلانات', icon: Bell },
    { href: '/dashboard/messages', label: 'الرسائل', icon: MessageSquare },
  ],
  teacher: [
    { href: '/dashboard/teacher', label: 'الرئيسية', icon: LayoutDashboard },
    { href: '/dashboard/teacher/live', label: '🔴 الحصص المباشرة', icon: Video },
    { href: '/dashboard/teacher/library', label: 'مكتبة المواد', icon: BookOpen },
    { href: '/dashboard/teacher/attendance', label: 'الحضور', icon: UserCheck },
    { href: '/dashboard/teacher/exams', label: 'الاختبارات', icon: ClipboardList },
    { href: '/dashboard/teacher/assignments', label: 'الواجبات', icon: FileText },
    { href: '/dashboard/teacher/grades', label: 'الدرجات', icon: BarChart3 },
    { href: '/dashboard/teacher/schedule', label: 'جدولي', icon: Calendar },
    { href: '/dashboard/messages', label: 'الرسائل', icon: MessageSquare },
  ],
  student: [
    { href: '/dashboard/student', label: 'الرئيسية', icon: LayoutDashboard },
    { href: '/dashboard/student/live', label: '🔴 الحصص المباشرة', icon: Video },
    { href: '/dashboard/student/library', label: 'المكتبة', icon: BookOpen },
    { href: '/dashboard/student/wellbeing', label: '💙 مساحتي', icon: Heart },
    { href: '/dashboard/student/schedule', label: 'جدولي', icon: Calendar },
    { href: '/dashboard/student/exams', label: 'اختباراتي', icon: ClipboardList },
    { href: '/dashboard/student/assignments', label: 'واجباتي', icon: FileText },
    { href: '/dashboard/student/grades', label: 'درجاتي', icon: BarChart3 },
    { href: '/dashboard/student/attendance', label: 'حضوري', icon: UserCheck },
    { href: '/dashboard/messages', label: 'الرسائل', icon: MessageSquare },
  ],
  parent: [
    { href: '/dashboard/parent', label: 'الرئيسية', icon: LayoutDashboard },
    { href: '/dashboard/parent/weekly-report', label: 'تقرير الأسبوع', icon: BarChart3 },
    { href: '/dashboard/parent/attendance', label: 'الحضور', icon: UserCheck },
    { href: '/dashboard/parent/grades', label: 'النتائج', icon: BarChart3 },
    { href: '/dashboard/parent/assignments', label: 'الواجبات', icon: FileText },
    { href: '/dashboard/parent/schedule', label: 'الجدول', icon: Calendar },
    { href: '/dashboard/messages', label: 'التواصل', icon: MessageSquare },
  ],
}

const GRAD: Record<string, string> = {
  admin: 'from-red-500 to-orange-500', management: 'from-purple-500 to-indigo-500',
  teacher: 'from-blue-500 to-cyan-500', student: 'from-green-500 to-teal-500', parent: 'from-yellow-500 to-amber-500',
}

export default function Sidebar({ role, userName, userEmail }: { role: UserRole; userName: string; userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = NAV[role] || []

  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (['/dashboard','/dashboard/teacher','/dashboard/student','/dashboard/parent','/dashboard/management'].includes(href)) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-64 bg-white border-l border-gray-100 flex flex-col h-screen sticky top-0 shadow-sm">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm">مدرسة الرفعة</p>
            <p className="text-xs text-gray-400">النموذجية 2026</p>
          </div>
        </div>
      </div>

      <div className="px-3 pt-3">
        <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${GRAD[role] || 'from-blue-500 to-blue-600'} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
            {userName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 text-sm truncate">{userName}</p>
            <p className="text-xs text-gray-400">{ROLE_AR[role]}</p>
          </div>
          <NotificationBell />
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                active ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800')}>
              <Icon className="flex-shrink-0" size={17} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronLeft size={14} className="opacity-60" />}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-4 border-t border-gray-100 pt-3 space-y-0.5">
        <Link href="/dashboard/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
          <Settings size={17} />ملفي الشخصي
        </Link>
        <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50">
          <LogOut size={17} />تسجيل الخروج
        </button>
      </div>
    </aside>
  )
}
