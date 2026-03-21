import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { DAYS_AR, PERIODS } from '@/lib/utils'
import { Calendar } from 'lucide-react'

export default async function AdminSchedulesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'management'].includes(profile?.role ?? '')) redirect('/dashboard')

  const { data: sections } = await supabase
    .from('sections').select('id, name, classes(name)').order('name')

  const [firstSection] = sections || []

  const { data: schedule } = firstSection
    ? await supabase.from('schedules')
        .select('*, subjects(name), teachers(users(full_name))')
        .eq('section_id', firstSection.id)
        .order('period')
    : { data: [] }

  const SCHOOL_DAYS = [0, 1, 2, 3, 4]
  const byDayPeriod = new Map(schedule?.map(s => [`${s.day_of_week}-${s.period}`, s]) || [])

  return (
    <div className="p-6">
      <PageHeader title="الجداول الدراسية" subtitle="عرض جداول الشعب" />
      <div className="mb-4 flex flex-wrap gap-2">
        {sections?.map(sec => (
          <span key={sec.id} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-medium cursor-pointer border border-blue-200">
            {(sec.classes as any)?.name} — شعبة {sec.name}
          </span>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-4 py-3 text-right w-28">الحصة</th>
              {SCHOOL_DAYS.map(d => <th key={d} className="px-4 py-3 text-center">{DAYS_AR[d]}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period, i) => (
              <tr key={period.num} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                <td className="px-4 py-3 border-l border-gray-100">
                  <p className="font-bold text-gray-700 text-xs">الحصة {period.num}</p>
                  <p className="text-gray-400 text-xs">{period.time}</p>
                </td>
                {SCHOOL_DAYS.map(day => {
                  const cell = byDayPeriod.get(`${day}-${period.num}`)
                  return (
                    <td key={day} className="px-3 py-2 border-l border-gray-100 text-center">
                      {cell ? (
                        <div className="bg-blue-50 rounded-xl p-2 border border-blue-100">
                          <p className="font-semibold text-blue-800 text-xs">{(cell.subjects as any)?.name}</p>
                          <p className="text-gray-400 text-xs mt-0.5">{(cell.teachers as any)?.users?.full_name}</p>
                        </div>
                      ) : <span className="text-gray-200">—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
