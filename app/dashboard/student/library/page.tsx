'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BookOpen,
  Download,
  Eye,
  Video,
  Search,
  Loader2,
  CheckCircle
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  file: { icon: '📎', color: 'text-blue-700', bg: 'bg-blue-100' },
  video: { icon: '🎥', color: 'text-red-700', bg: 'bg-red-100' },
  link: { icon: '🔗', color: 'text-purple-700', bg: 'bg-purple-100' },
  note: { icon: '📝', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  exam_prep: { icon: '📋', color: 'text-green-700', bg: 'bg-green-100' }
}

export default function StudentLibraryPage() {
  const supabase = createClient()
  const [materials, setMaterials] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ subject: '', type: '', search: '', unit: '' })
  const [interacted, setInteracted] = useState<Record<string, boolean>>({})

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: mats } = await supabase
      .from('study_materials')
      .select('*, subjects(name), sections(name, classes(name, grade_number, stage, stream))')
      .eq('is_published', true)
      .order('unit_number', { ascending: true })
      .order('created_at', { ascending: false })

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: myInter } = await supabase
        .from('material_interactions')
        .select('material_id')
        .eq('student_id', user.id)

      const iMap: Record<string, boolean> = {}
      ;(myInter || []).forEach(i => {
        iMap[i.material_id] = true
      })

      setInteracted(iMap)
    }

    const mList = mats || []
    setMaterials(mList)

    const subMap = new Map()
    mList.forEach((m: any) => {
      if (m.subjects) subMap.set(m.subjects.id || m.subject_id, m.subjects)
    })

    setSubjects(Array.from(subMap.values()))
    setLoading(false)
  }

  async function handleInteraction(materialId: string, type: 'view' | 'download') {
    await supabase.rpc('record_material_interaction', {
      p_material_id: materialId,
      p_type: type
    })
    setInteracted(prev => ({ ...prev, [materialId]: true }))
  }

  const filtered = materials.filter(m => {
    if (filter.subject && m.subjects?.name !== filter.subject) return false
    if (filter.type && m.material_type !== filter.type) return false
    if (filter.search && !m.title.toLowerCase().includes(filter.search.toLowerCase())) return false
    if (filter.unit && m.unit_number !== parseInt(filter.unit)) return false
    return true
  })

  const byUnit = filtered.reduce((acc: Record<string, any[]>, m) => {
    const key = m.unit_number
      ? `الوحدة ${m.unit_number}${m.unit_title ? ` — ${m.unit_title}` : ''}`
      : 'متنوعة'

    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const getStageLabel = (m: any) => {
    const cl = m.sections?.classes
    if (!cl) return 'كل الطلاب'

    const stage = cl.stage === 'middle' ? 'متوسط' : 'ثانوي'
    const stream =
      cl.stream === 'science'
        ? ' — علمي'
        : cl.stream === 'arts'
        ? ' — أدبي'
        : ''

    return `الصف ${cl.grade_number} ${stage}${stream}`
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-blue-600" />
          المكتبة الرقمية
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {materials.length} مادة تعليمية متاحة
        </p>
      </div>

      <div className="bg-white rounded-2xl border p-4 mb-5 flex gap-3">
        <div className="flex items-center gap-2 border px-3 py-2 rounded-xl">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            placeholder="بحث..."
            value={filter.search}
            onChange={e =>
              setFilter(f => ({ ...f, search: e.target.value }))
            }
            className="text-sm focus:outline-none"
          />
        </div>
      </div>

      {Object.keys(byUnit).length === 0 ? (
        <div className="bg-white p-12 text-center border rounded-2xl">
          <BookOpen className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">لا توجد مواد</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byUnit).map(([unit, items]) => (
            <div key={unit}>
              <h2 className="font-bold mb-3">{unit}</h2>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((m: any) => {
                  const cfg =
                    TYPE_CONFIG[m.material_type] || TYPE_CONFIG.file

                  const seen = interacted[m.id]
                  const url = m.file_url || m.external_url

                  return (
                    <div
                      key={m.id}
                      className="bg-white border rounded-2xl p-4"
                    >
                      <div className="flex gap-3 mb-2">
                        <div className={`w-10 h-10 ${cfg.bg} flex items-center justify-center rounded-xl`}>
                          {cfg.icon}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">{m.title}</h3>
                          <p className="text-xs text-blue-600">
                            {m.subjects?.name}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-gray-400 mb-3">
                        {getStageLabel(m)} — {formatDate(m.created_at)}
                      </div>

                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          onClick={() =>
                            handleInteraction(
                              m.id,
                              m.material_type === 'file'
                                ? 'download'
                                : 'view'
                            )
                          }
                          className="block text-center bg-blue-600 text-white py-2 rounded-xl text-sm"
                        >
                          {m.material_type === 'file' ? (
                            <Download />
                          ) : (
                            <Eye />
                          )}
                        </a>
                      )}

                      {seen && (
                        <div className="text-green-600 text-xs mt-2 text-center flex justify-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          تم الاطلاع
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
