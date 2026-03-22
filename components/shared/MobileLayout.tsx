'use client'
import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database'
import NotificationBell from './NotificationBell'
import {
  Menu, X, GraduationCap, LogOut, Settings,
  LayoutDashboard, Users, BookOpen, Calendar, ClipboardList,
  MessageSquare, Bell, BarChart3, FileText, UserCheck,
  Video, Heart, ChevronLeft
} from 'lucide-react'

const NAV: Record<string, { href: string; label: string; icon: any }[]> = {
  admin: [
    { href: '/dashboard',                        label: 'الرئيسية',        icon: LayoutDashboard },
    { href: '/dashboard/users',                  label: 'المستخدمون',      icon: Users },
    { href: '/dashboard/classes',                label: 'الصفوف والشعب',   icon: BookOpen },
    { href: '/dashboard/schedules',              label: 'الجداول',          icon: Calendar },
    { href: '/dashboard/admin/messages',         label: 'كل الرسائل',       icon: MessageSquare },
    { href: '/dashboard/admin/exams',            label: 'كل الاختبارات',    icon: ClipboardList },
    { href: '/dashboard/admin/assignments',      label: 'كل الواجبات',      icon: FileText },
    { href: '/dashboard/admin/results',          label: 'كل النتائج',        icon: BarChart3 },
    { href: '/dashboard/admin/attendance-tracking', label: 'متابعة الحضور', icon: UserCheck },
    { href: '/dashboard/admin/zoom-monitor',     label: 'مراقبة Zoom',      icon: Video },
    { href: '/dashboard/admin/library',          label: 'المكتبة',           icon: BookOpen },
    { href: '/dashboard/reports',                label: 'التقارير',          icon: BarChart3 },
    { href: '/dashboard/announcements',          label: 'الإعلانات',        icon: Bell },
  ],
  management: [
    { href: '/dashboard/management',                  label: 'الرئيسية',   icon: LayoutDashboard },
    { href: '/dashboard/management/attendance',       label: 'الحضور',      icon: UserCheck },
    { href: '/dashboard/management/grades',           label: 'النتائج',     icon: BarChart3 },
    { href: '/dashboard/management/announcements',    label: 'الإعلانات',   icon: Bell },
    { href: '/dashboard/messages',                    label: 'الرسائل',     icon: MessageSquare },
  ],
  teacher: [
    { href: '/dashboard/teacher',              label: 'الرئيسية',          icon: LayoutDashboard },
    { href: '/dashboard/teacher/live',         label: '🔴 الحصص المباشرة', icon: Video },
    { href: '/dashboard/teacher/attendance',   label: 'الحضور',             icon: UserCheck },
    { href: '/dashboard/teacher/exams',        label: 'الاختبارات',         icon: ClipboardList },
    { href: '/dashboard/teacher/assignments',  label: 'الواجبات',           icon: FileText },
    { href: '/dashboard/teacher/grades',       label: 'الدرجات',            icon: BarChart3 },
    { href: '/dashboard/teacher/library',      label: 'مكتبة المواد',       icon: BookOpen },
    { href: '/dashboard/teacher/schedule',     label: 'جدولي',              icon: Calendar },
    { href: '/dashboard/messages',             label: 'الرسائل',            icon: MessageSquare },
  ],
  student: [
    { href: '/dashboard/student',              label: 'الرئيسية',          icon: LayoutDashboard },
    { href: '/dashboard/student/live',         label: '🔴 الحصص المباشرة', icon: Video },
    { href: '/dashboard/student/schedule',     label: 'جدولي',              icon: Calendar },
    { href: '/dashboard/student/exams',        label: 'اختباراتي',          icon: ClipboardList },
    { href: '/dashboard/student/assignments',  label: 'واجباتي',            icon: FileText },
    { href: '/dashboard/student/grades',       label: 'درجاتي',             icon: BarChart3 },
    { href: '/dashboard/student/attendance',   label: 'حضوري',              icon: UserCheck },
    { href: '/dashboard/student/library',      label: 'المكتبة',            icon: BookOpen },
    { href: '/dashboard/student/wellbeing',    label: '💙 مساحتي',          icon: Heart },
    { href: '/dashboard/messages',             label: 'الرسائل',            icon: MessageSquare },
  ],
  parent: [
    { href: '/dashboard/parent',                    label: 'الرئيسية',    icon: LayoutDashboard },
    { href: '/dashboard/parent/weekly-report',      label: 'تقرير الأسبوع', icon: BarChart3 },
    { href: '/dashboard/parent/attendance',         label: 'الحضور',       icon: UserCheck },
    { href: '/dashboard/parent/grades',             label: 'النتائج',      icon: BarChart3 },
    { href: '/dashboard/parent/assignments',        label: 'الواجبات',     icon: FileText },
    { href: '/dashboard/parent/schedule',           label: 'الجدول',       icon: Calendar },
    { href: '/dashboard/messages',                  label: 'التواصل',      icon: MessageSquare },
  ],
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'مدير النظام', management: 'الإدارة',
  teacher: 'معلم', student: 'طالب', parent: 'ولي أمر',
}

const ROLE_COLOR: Record<string, string> = {
  admin: '#ef4444', management: '#8b5cf6',
  teacher: '#3b82f6', student: '#22c55e', parent: '#f59e0b',
}

interface Props {
  role: UserRole
  userName: string
  userEmail: string
  children: React.ReactNode
}

export default function MobileLayout({ role, userName, userEmail, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const navItems = NAV[role] || []
  const color = ROLE_COLOR[role] || '#3b82f6'

  // إغلاق السايدبار عند الضغط خارجه
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setSidebarOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [sidebarOpen])

  // إغلاق السايدبار عند تغيير الصفحة
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // منع scroll عند فتح السايدبار
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    const exactPaths = ['/dashboard', '/dashboard/teacher', '/dashboard/student', '/dashboard/parent', '/dashboard/management']
    if (exactPaths.includes(href)) return pathname === href
    return pathname.startsWith(href)
  }

  // ── Sidebar Content ─────────────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-blue-800 border-b border-blue-700">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">مدرسة الرفعة</p>
          <p className="text-blue-300 text-xs">النموذجية 2026</p>
        </div>
        {/* زر إغلاق في الموبايل */}
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 hover:bg-blue-700 rounded-lg">
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* User Card */}
      <div className="mx-3 mt-3 mb-2 rounded-xl p-3 flex items-center gap-2.5" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: color }}>
          {userName?.charAt(0) || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate">{userName}</p>
          <p className="text-slate-400 text-xs">{ROLE_LABEL[role]}</p>
        </div>
        <NotificationBell />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}>
              <Icon size={17} className="flex-shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {active && <ChevronLeft size={14} className="opacity-60 flex-shrink-0" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 pt-3 border-t border-slate-700 space-y-0.5">
        <Link href="/dashboard/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all">
          <Settings size={17} />ملفي الشخصي
        </Link>
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-900/30 transition-all">
          <LogOut size={17} />تسجيل الخروج
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden" dir="rtl">

      {/* ── Desktop Sidebar (lg+) ─────────────────────────── */}
      <aside className="hidden lg:flex lg:flex-col w-64 flex-shrink-0 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile Overlay ───────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Mobile Drawer ────────────────────────────────── */}
      <aside
        ref={sidebarRef}
        className={cn(
          'fixed top-0 right-0 h-full w-72 z-50 transform transition-transform duration-300 ease-in-out lg:hidden',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <SidebarContent />
      </aside>

      {/* ── Main Content ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile Top Bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <Menu className="w-6 h-6 text-gray-700" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-800 text-sm">مدرسة الرفعة</span>
          </div>

          <NotificationBell />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden flex-shrink-0 bg-white border-t border-gray-200 shadow-lg">
          <div className="flex items-center justify-around px-2 py-2">
            {navItems.slice(0, 5).map(item => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link key={item.href} href={item.href}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-0 transition-all',
                    active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                  )}>
                  <Icon size={22} className="flex-shrink-0" />
                  <span className="text-xs font-medium truncate max-w-[60px] text-center leading-tight">
                    {item.label.replace('🔴 ', '').replace('💙 ', '')}
                  </span>
                  {active && <div className="w-1 h-1 rounded-full bg-blue-600" />}
                </Link>
              )
            })}
            {/* زر المزيد */}
            <button onClick={() => setSidebarOpen(true)}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-gray-400 hover:text-gray-600 transition-all">
              <Menu size={22} />
              <span className="text-xs font-medium">المزيد</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  )
}