import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { BookOpen, Users } from 'lucide-react'

export default async function AdminClassesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'management'].includes(profile?.role ?? '')) redirect('/dashboard')

  const { data: classes } = await supabase
    .from('classes')
    .select('*, sections(id, name, capacity, homeroom_teacher_id)')
    .order('level')

  const { data: studentCounts } = await supabase
    .from('students')
    .select('section_id')

  const countMap = new Map<string, number>()
  studentCounts?.forEach(s => {
    if (s.section_id) countMap.set(s.section_id, (countMap.get(s.section_id) || 0) + 1)
  })

  return (
    <div className="p-6">
      <PageHeader title="الصفوف والشعب الدراسية"
        subtitle={`${classes?.length ?? 0} صف — ${classes?.reduce((a, c) => a + (c.sections?.length ?? 0), 0) ?? 0} شعبة`} />

      <div className="grid grid-cols-1 gap-5">
        {classes?.map(cls => (
          <div key={cls.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-blue-50 border-b border-blue-100">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{cls.name}</h3>
                <p className="text-xs text-gray-500">المرحلة {cls.level} — {cls.sections?.length ?? 0} شعبة</p>
              </div>
            </div>
            <div className="p-4 grid grid-cols-3 md:grid-cols-6 gap-3">
              {cls.sections?.map((sec: any) => {
                const count = countMap.get(sec.id) || 0
                const pct = Math.round((count / sec.capacity) * 100)
                return (
                  <div key={sec.id} className="border border-gray-100 rounded-xl p-3 text-center hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                    <p className="font-bold text-blue-700 text-lg">شعبة {sec.name}</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500">{count}/{sec.capacity}</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{pct}% مكتمل</p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
