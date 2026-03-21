import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { formatDateTime } from '@/lib/utils'

type Attendance = {
  id: string
  student_id: string
  date: string
  status: 'present' | 'absent' | 'late'
  subjects: { name: string }[]
  students: { users: { full_name: string }[] }[]
}

export default async function ParentPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: children } = await supabase
    .from('students')
    .select('id, section_id, users(full_name)')
    .eq('parent_id', user.id)

  const sectionIds = Array.from(
    new Set(children?.map(c => c.section_id).filter(Boolean) || [])
  )

  const { data: attendances } = (sectionIds.length > 0
    ? await supabase
        .from('attendances')
        .select(`
          id,
          student_id,
          date,
          status,
          subjects(name),
          students(users(full_name))
        `)
        .in('section_id', sectionIds)
        .order('date', { ascending: false })
    : { data: [] }) as { data: Attendance[] }

  return (
    <div className="p-6">
      <PageHeader title="حضور الأبناء" subtitle="متابعة حضور وغياب الأبناء" />

      {!attendances || attendances.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">
          لا توجد سجلات
        </p>
      ) : (
        <div className="space-y-2">
          {attendances.slice(0, 6).map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2.5 mb-1.5 hover:bg-gray-50 rounded-xl"
            >
              <span
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
                  item.status === 'present'
                    ? 'bg-green-100 text-green-700'
                    : item.status === 'absent'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {item.status === 'present'
                  ? 'حاضر'
                  : item.status === 'absent'
                  ? 'غائب'
                  : 'متأخر'}
              </span>

              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">
                  {item.students?.[0]?.users?.[0]?.full_name}
                </p>
                <p className="text-xs text-gray-400">
                  {item.subjects?.[0]?.name}
                </p>
              </div>

              <p className="text-xs text-gray-400">
                {formatDateTime(item.date)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
