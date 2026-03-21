import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { formatDateTime } from '@/lib/utils'

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

  const { data: attendances } =
    sectionIds.length > 0
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
      : { data: [] }

  const list = (attendances ?? []) as any[]

  return (
    <div className="p-6">
      <PageHeader title="حضور الأبناء" subtitle="متابعة حضور وغياب الأبناء" />

      {list.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">
          لا توجد سجلات
        </p>
      ) : (
        <div className="space-y-2">
          {list.slice(0, 6).map(a => (
            <div key={`${a.student_id}-${a.date}`}
              className="flex items-center gap-3 p-2.5 mb-1.5 hover:bg-gray-50 rounded-xl"
            >
              <span
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
                  a.status === 'present'
                    ? 'bg-green-100 text-green-700'
                    : a.status === 'absent'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {a.status === 'present'
                  ? 'حاضر'
                  : a.status === 'absent'
                  ? 'غائب'
                  : 'متأخر'}
              </span>

              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">
                  {a.students?.[0]?.users?.[0]?.full_name}
                </p>
                <p className="text-xs text-gray-400">
                  {a.subjects?.[0]?.name}
                </p>
              </div>

              <p className="text-xs text-gray-400">
                {formatDateTime(a.date)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
