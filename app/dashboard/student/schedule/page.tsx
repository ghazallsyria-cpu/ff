import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { DAYS_AR, PERIODS } from '@/lib/utils'
import { Video } from 'lucide-react'

export default async function StudentSchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase.from('students').select('section_id').eq('id', user.id).single()

  const { data: schedule } = await supabase
    .from('schedules')
    .select('*, subjects(name), teachers(zoom_link, users(full_name))')
    .eq('section_id', student?.section_id ?? '')
    .order('period')

  const SCHOOL_DAYS = [0, 1, 2, 3, 4] // الأحد - الخميس
  const byDayPeriod = new Map(schedule?.map(s => [`${s.day_of_week}-${s.period}`, s]) || [])

  return (
    <div className="p-6">
      <PageHeader title="جدولي الدراسي الأسبوعي" />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-4 py-3 text-right font-semibold w-28">الحصة / الوقت</th>
              {SCHOOL_DAYS.map(d => (
                <th key={d} className="px-4 py-3 text-center font-semibold">{DAYS_AR[d]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period, i) => (
              <tr key={period.num} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
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
                          <p className="font-semibold text-blue-800 text-xs leading-tight">{(cell.subjects as any)?.name}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{(cell.teachers as any)?.users?.full_name}</p>
                          {(cell.teachers as any)?.zoom_link && (
                            <a href={(cell.teachers as any).zoom_link} target="_blank" rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                              <Video className="w-3 h-3" />Zoom
                            </a>
                          )}
                        </div>
                      ) : <span className="text-gray-200 text-xs">—</span>}
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
