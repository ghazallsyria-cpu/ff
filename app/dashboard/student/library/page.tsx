'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Download, Eye, Video, Link, Search, Filter, Loader2, CheckCircle, FileText } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  file:      { icon: '📎', color: 'text-blue-700',   bg: 'bg-blue-100' },
  video:     { icon: '🎥', color: 'text-red-700',    bg: 'bg-red-100' },
  link:      { icon: '🔗', color: 'text-purple-700', bg: 'bg-purple-100' },
  note:      { icon: '📝', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  exam_prep: { icon: '📋', color: 'text-green-700',  bg: 'bg-green-100' },
}

export default function StudentLibraryPage() {
  const supabase = createClient()
  const [materials, setMaterials] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ subject: '', type: '', search: '', unit: '' })
  const [interacted, setInteracted] = useState<Record<string, boolean>>({})

  useEffect(() => { load() }, [])

  async function load() {
    const { data: mats } = await supabase.from('study_materials')
      .select('*, subjects(name), sections(name, classes(name, grade_number, stage, stream))')
      .eq('is_published', true).order('unit_number', { ascending: true }).order('created_at', { ascending: false })

    // احضر تفاعلاتي
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: myInter } = await supabase.from('material_interactions')
        .select('material_id, interaction_type').eq('student_id', user.id)
      const iMap: Record<string, boolean> = {}
      ;(myInter || []).forEach(i => { iMap[i.material_id] = true })
      setInteracted(iMap)
    }

    const mList = mats || []
    setMaterials(mList)
    const subMap = new Map()
    mList.forEach((m: any) => { if (m.subjects) subMap.set(m.subjects.id || m.subject_id, m.subjects) })
    setSubjects([...subMap.values()])
    setLoading(false)
  }

  async function handleInteraction(materialId: string, type: 'view' | 'download') {
    await supabase.rpc('record_material_interaction', { p_material_id: materialId, p_type: type })
    setInteracted(prev => ({ ...prev, [materialId]: true }))
  }

  const filtered = materials.filter(m => {
    if (filter.subject && m.subjects?.name !== filter.subject) return false
    if (filter.type && m.material_type !== filter.type) return false
    if (filter.search && !m.title.toLowerCase().includes(filter.search.toLowerCase())) return false
    if (filter.unit && m.unit_number !== parseInt(filter.unit)) return false
    return true
  })

  // تجميع حسب الوحدة
  const byUnit = filtered.reduce((acc, m) => {
    const key = m.unit_number ? `الوحدة ${m.unit_number}${m.unit_title ? ` — ${m.unit_title}` : ''}` : 'متنوعة'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {} as Record<string, any[]>)

  const getStageLabel = (m: any) => {
    const cl = m.sections?.classes
    if (!cl) return 'كل الطلاب'
    const stage = cl.stage === 'middle' ? 'متوسط' : 'ثانوي'
    const stream = cl.stream === 'science' ? ' — علمي' : cl.stream === 'arts' ? ' — أدبي' : ''
    return `الصف ${cl.grade_number} ${stage}${stream}`
  }

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-blue-600" />المكتبة الرقمية
        </h1>
        <p className="text-sm text-gray-500 mt-1">{materials.length} مادة تعليمية متاحة</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
          const count = materials.filter(m => m.material_type === type).length
          return (
            <div key={type} className={`${cfg.bg} rounded-2xl p-3 text-center border border-gray-100`}>
              <div className="text-2xl mb-1">{cfg.icon}</div>
              <div className={`text-xl font-bold ${cfg.color}`}>{count}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {type === 'file' ? 'ملف' : type === 'video' ? 'فيديو' : type === 'link' ? 'رابط' : type === 'note' ? 'ملاحظة' : 'مراجعة'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 flex flex-wrap gap-3 shadow-sm">
        <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input placeholder="بحث في المواد..." value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
            className="text-sm focus:outline-none w-40" />
        </div>
        <select value={filter.subject} onChange={e => setFilter(f => ({ ...f, subject: e.target.value }))}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">كل المواد</option>
          {subjects.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">كل الأنواع</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {k === 'file' ? 'ملف' : k === 'video' ? 'فيديو' : k === 'link' ? 'رابط' : k === 'note' ? 'ملاحظة' : 'مراجعة'}</option>)}
        </select>
        {Object.keys(byUnit).filter(u => u !== 'متنوعة').length > 0 && (
          <select value={filter.unit} onChange={e => setFilter(f => ({ ...f, unit: e.target.value }))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">كل الوحدات</option>
            {[...new Set(materials.map(m => m.unit_number).filter(Boolean))].sort((a, b) => a - b).map(n => (
              <option key={n} value={n}>الوحدة {n}</option>
            ))}
          </select>
        )}
        {(filter.search || filter.subject || filter.type || filter.unit) && (
          <button onClick={() => setFilter({ subject: '', type: '', search: '', unit: '' })}
            className="text-xs text-red-500 hover:underline">مسح الفلاتر</button>
        )}
      </div>

      {/* Grouped by unit */}
      {Object.keys(byUnit).length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
          <BookOpen className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">لا توجد مواد متاحة بعد</p>
          <p className="text-gray-400 text-sm mt-1">ستظهر هنا المواد التي يرفعها معلموك</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byUnit).map(([unit, items]) => (
            <div key={unit}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-bold text-gray-800">{unit}</h2>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">{items.length} مادة</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(m => {
                  const cfg = TYPE_CONFIG[m.material_type] || TYPE_CONFIG.file
                  const seen = interacted[m.id]
                  const url = m.file_url || m.external_url
                  return (
                    <div key={m.id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${!seen ? 'border-blue-200' : 'border-gray-100'}`}>
                      {!seen && <div className="bg-blue-500 px-3 py-1 text-white text-xs font-bold">جديد</div>}
                      <div className="p-4">
                        <div className="flex items-start gap-3 mb-2">
                          <div className={`w-10 h-10 ${cfg.bg} rounded-xl flex items-center justify-center text-xl flex-shrink-0`}>{cfg.icon}</div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-800 text-sm leading-tight">{m.title}</h3>
                            <p className="text-xs text-blue-600 mt-0.5">{m.subjects?.name}</p>
                          </div>
                        </div>
                        {m.description && <p className="text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2">{m.description}</p>}
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                          <span>{getStageLabel(m)}</span>
                          <span>{formatDate(m.created_at)}</span>
                        </div>
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            onClick={() => handleInteraction(m.id, m.material_type === 'file' ? 'download' : 'view')}
                            className="flex items-center justify-center gap-1.5 w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                            {m.material_type === 'file' ? <><Download className="w-4 h-4" />تحميل</> :
                             m.material_type === 'video' ? <><Video className="w-4 h-4" />شاهد</> :
                             <><Eye className="w-4 h-4" />فتح</>}
                          </a>
                        ) : m.material_type === 'note' && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-gray-700">
                            {m.description || m.title}
                          </div>
                        )}
                        {seen && (
                          <div className="flex items-center gap-1 mt-2 justify-center">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            <span className="text-xs text-green-600">تم الاطلاع</span>
                          </div>
                        )}
                      </div>
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
