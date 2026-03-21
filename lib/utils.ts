import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DAYS_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']

export const PERIODS = [
  { num: 1, time: '08:00 - 08:45' },
  { num: 2, time: '08:50 - 09:35' },
  { num: 3, time: '09:40 - 10:25' },
  { num: 4, time: '10:40 - 11:25' },
  { num: 5, time: '11:30 - 12:15' },
  { num: 6, time: '12:20 - 13:05' },
  { num: 7, time: '13:10 - 13:55' },
]

export const ATTENDANCE_STATUS_AR: Record<string, string> = {
  present: 'حاضر', absent: 'غائب', late: 'متأخر', excused: 'غياب بعذر',
}

export const ATTENDANCE_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-800',
  late: 'bg-yellow-100 text-yellow-800',
  excused: 'bg-blue-100 text-blue-800',
}

export const ROLE_AR: Record<string, string> = {
  admin: 'مدير النظام', management: 'الإدارة',
  teacher: 'معلم', student: 'طالب', parent: 'ولي أمر',
}

export const ROLE_REDIRECT: Record<string, string> = {
  admin: '/dashboard', management: '/dashboard/management',
  teacher: '/dashboard/teacher', student: '/dashboard/student', parent: '/dashboard/parent',
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function getScoreColor(score: number, passScore = 50): string {
  if (score >= 90) return 'text-green-600'
  if (score >= passScore) return 'text-blue-600'
  return 'text-red-600'
}

export function getScoreBg(score: number, passScore = 50): string {
  if (score >= 90) return 'bg-green-100 text-green-800'
  if (score >= passScore) return 'bg-blue-100 text-blue-800'
  return 'bg-red-100 text-red-800'
}
