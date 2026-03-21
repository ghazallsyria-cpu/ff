'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/shared/PageHeader'
import { Save, Loader2 } from 'lucide-react'

export default function NewAssignmentPage() {
  const router = useRouter()
  const supabase = createClient()

  const [sections, setSections] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    section_id: '',
    subject_id: '',
    due_date: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('teacher_sections')
        .select('section_id, subject_id, sections(name, classes(name)), subjects(name)')
        .eq('teacher_id', user.id)

      setSections(data || [])
    }

    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (!form.title || !form.section_id || !form.subject_id || !form.due_date) return

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('assignments').insert({
      title: form.title,
      description: form.description || null,
      section_id: form.section_id,
      subject_id: form.subject_id,
      teacher_id: user.id,
      due_date: form.due_date,
    })

    router.push('/dashboard/teacher/assignments')
  }

  const uniqueSections = Array.from(
    new Map(sections.map(s => [s.section_id, s])).values()
  )

  const filteredSubjects = sections.filter(
    s => s.section_id === form.section_id
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader title="إضافة واجب جديد" />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSave} className="space-y-5">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              عنوان الواجب *
            </label>

            <input
              value={form.title}
              onChange={e =>
                setForm(f => ({ ...f, title: e.target.value }))
              }
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="مثال: واجب الفصل الأول"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الشعبة *
              </label>

              <select
                value={form.section_id}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    section_id: e.target.value,
                    subject_id: '',
                  }))
                }
                required
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">اختر الشعبة</option>

                {uniqueSections.map(s => (
                  <option key={s.section_id} value={s.section_id}>
                    {s.sections?.classes?.name} - {s.sections?.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                المادة *
              </label>

              <select
                value={form.subject_id}
                onChange={e =>
                  setForm(f => ({ ...f, subject_id: e.target.value }))
                }
                required
                disabled={!form.section_id}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              >
                <option value="">اختر المادة</option>

                {filteredSubjects.map(s => (
                  <option key={s.subject_id} value={s.subject_id}>
                    {s.subjects?.name}
                  </option>
                ))}
              </select>
            </div>

          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              موعد التسليم *
            </label>

            <input
              type="datetime-local"
              value={form.due_date}
              onChange={e =>
                setForm(f => ({ ...f, due_date: e.target.value }))
              }
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              وصف الواجب
            </label>

            <textarea
              value={form.description}
              onChange={e =>
                setForm(f => ({ ...f, description: e.target.value }))
              }
              rows={4}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="تعليمات ومتطلبات الواجب..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              حفظ الواجب
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
