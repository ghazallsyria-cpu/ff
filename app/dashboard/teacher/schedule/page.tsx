import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { DAYS_AR, PERIODS } from '@/lib/utils'
import { Video } from 'lucide-react'

export default async function TeacherSchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: schedule } = await supabase
    .from('schedules')
    .select('*, subjects(name), sections(name, classes(name))')
    .eq('teacher_id', user.id)
    .order('period')

  const { data: teacherData } = await supabase
    .from('teachers').select('zoom_link').eq('id', user.id).single()

  const SCHOOL_DAYS = [0, 1, 2, 3, 4]
  const byDayPeriod = new Map(schedule?.map(s => [`${s.day_of_week}-${s.period}`, s]) || [])

  return (
    <div className="p-6">
      <PageHeader title="جدولي الدراسي الأسبوعي">
        {teacherData?.zoom_link && (
          <a href={teacherData.zoom_link} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
            <Video className="w-4 h-4" />رابط Zoom الخاص بي
          </a>
        )}
      </PageHeader>
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
                          <p className="text-gray-400 text-xs mt-0.5">
                            {(cell.sections as any)?.classes?.name} - {(cell.sections as any)?.name}
                          </p>
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
