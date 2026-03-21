'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, FileText, Video, Link, BookOpen, Plus, Trash2, Eye, Download, Loader2, CheckCircle, X, Edit2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const MATERIAL_TYPES = [
  { value: 'file',      label: '📎 ملف', icon: FileText },
  { value: 'video',     label: '🎥 فيديو', icon: Video },
  { value: 'link',      label: '🔗 رابط', icon: Link },
  { value: 'note',      label: '📝 ملاحظة', icon: BookOpen },
  { value: 'exam_prep', label: '📋 مراجعة', icon: CheckCircle },
]

const FILE_TYPE_ICON: Record<string, string> = {
  pdf: '📄', docx: '📝', pptx: '📊', xlsx: '📈',
  mp4: '🎥', mp3: '🎵', jpg: '🖼️', png: '🖼️', default: '📎'
}

export default function TeacherLibraryPage() {
  const supabase = createClient()
  const [materials, setMaterials] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter] = useState({ subject: '', type: '', search: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: '', description: '', material_type: 'file',
    subject_id: '', section_id: '', unit_number: '', unit_title: '',
    external_url: '', file: null as File | null,
  })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: mats }, { data: subs }, { data: sects }] = await Promise.all([
      supabase.from('study_materials')
        .select('*, subjects(name), sections(name, classes(name, grade_number, stage, stream))')
        .eq('teacher_id', user.id).order('created_at', { ascending: false }),
      supabase.from('teacher_sections')
        .select('subjects(id, name), sections(id, name, classes(name, grade_number, stage, stream))')
        .eq('teacher_id', user.id),
      supabase.from('teacher_sections')
        .select('sections(id, name, classes(name, grade_number))').eq('teacher_id', user.id),
    ])
    setMaterials(mats || [])
    // استخراج المواد الفريدة
    const uniqueSubs = new Map()
    ;(subs || []).forEach((ts: any) => { if (ts.subjects) uniqueSubs.set(ts.subjects.id, ts.subjects) })
    setSubjects([...uniqueSubs.values()])
    const uniqueSects = new Map()
    ;(sects || []).forEach((ts: any) => { if (ts.sections) uniqueSects.set(ts.sections.id, ts.sections) })
    setSections([...uniqueSects.values()])
    setLoading(false)
  }

  async function uploadMaterial() {
    if (!form.title.trim() || !form.subject_id) return
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let fileUrl = form.external_url || null
    let fileName = null, fileSize = null, fileType = null

    // رفع الملف إذا وُجد
    if (form.file) {
      const ext = form.file.name.split('.').pop()
      const path = `materials/${user.id}/${Date.now()}.${ext}`
      const { data: up, error } = await supabase.storage.from('school-materials').upload(path, form.file)
      if (!error && up) {
        const { data: urlData } = supabase.storage.from('school-materials').getPublicUrl(path)
        fileUrl = urlData.publicUrl
        fileName = form.file.name
        fileSize = form.file.size
        fileType = ext || null
      }
    }

    await supabase.from('study_materials').insert({
      teacher_id: user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      material_type: form.material_type,
      subject_id: form.subject_id,
      section_id: form.section_id || null,
      unit_number: form.unit_number ? parseInt(form.unit_number) : null,
      unit_title: form.unit_title.trim() || null,
      file_url: fileUrl,
      file_name: fileName,
      file_size_bytes: fileSize,
      file_type: fileType,
      external_url: form.material_type !== 'file' ? form.external_url || null : null,
      is_published: true,
    })

    setForm({ title: '', description: '', material_type: 'file', subject_id: '', section_id: '', unit_number: '', unit_title: '', external_url: '', file: null })
    setShowForm(false)
    setUploading(false)
    loadAll()
  }

  async function deleteMaterial(id: string) {
    if (!confirm('حذف هذه المادة نهائياً؟')) return
    await supabase.from('study_materials').delete().eq('id', id)
    setMaterials(prev => prev.filter(m => m.id !== id))
  }

  const filtered = materials.filter(m => {
    if (filter.subject && m.subject_id !== filter.subject) return false
    if (filter.type && m.material_type !== filter.type) return false
    if (filter.search && !m.title.toLowerCase().includes(filter.search.toLowerCase())) return false
    return true
  })

  const getStageLabel = (m: any) => {
    const cl = m.sections?.classes
    if (!cl) return ''
    const stage = cl.stage === 'middle' ? 'متوسط' : 'ثانوي'
    const stream = cl.stream === 'science' ? ' علمي' : cl.stream === 'arts' ? ' أدبي' : ''
    return `الصف ${cl.grade_number} ${stage}${stream}`
  }

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><BookOpen className="w-7 h-7 text-blue-600" />مكتبة المواد الدراسية</h1>
          <p className="text-sm text-gray-500 mt-1">{materials.length} مادة مرفوعة</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm">
          <Plus className="w-4 h-4" />إضافة مادة جديدة
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 flex gap-3 flex-wrap shadow-sm">
        <input placeholder="🔍 بحث..." value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <select value={filter.subject} onChange={e => setFilter(f => ({ ...f, subject: e.target.value }))}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">كل المواد</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">كل الأنواع</option>
          {MATERIAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <div className="mr-auto flex items-center gap-2">
          {['📎','🎥','🔗','📝','📋'].map((ico, i) => {
            const type = MATERIAL_TYPES[i].value
            const count = materials.filter(m => m.material_type === type).length
            return count > 0 ? (
              <span key={type} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                {ico} {count}
              </span>
            ) : null
          })}
        </div>
      </div>

      {/* Upload Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-gray-800 text-lg">إضافة مادة جديدة</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Type selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">نوع المادة</label>
                <div className="grid grid-cols-5 gap-2">
                  {MATERIAL_TYPES.map(t => (
                    <button key={t.value} onClick={() => setForm(f => ({ ...f, material_type: t.value }))}
                      className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all text-center ${form.material_type === t.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">العنوان *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="مثال: شرح درس التكامل — الوحدة الثالثة"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المادة *</label>
                  <select value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">اختر المادة</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الشعبة</label>
                  <select value={form.section_id} onChange={e => setForm(f => ({ ...f, section_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">كل الشعب</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{(s as any).classes?.name} - {s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم الوحدة</label>
                  <input type="number" min="1" value={form.unit_number} onChange={e => setForm(f => ({ ...f, unit_number: e.target.value }))}
                    placeholder="1" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">عنوان الوحدة</label>
                  <input value={form.unit_title} onChange={e => setForm(f => ({ ...f, unit_title: e.target.value }))}
                    placeholder="مثال: التكامل" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">وصف مختصر</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  placeholder="وصف مختصر للمادة..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              {/* File or URL */}
              {form.material_type === 'file' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الملف</label>
                  <div onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    {form.file ? (
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-2xl">{FILE_TYPE_ICON[form.file.name.split('.').pop() || ''] || '📎'}</span>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{form.file.name}</p>
                          <p className="text-xs text-gray-400">{(form.file.size / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">اسحب الملف هنا أو <span className="text-blue-600 underline">اضغط للاختيار</span></p>
                        <p className="text-xs text-gray-400 mt-1">PDF, DOCX, PPTX, MP4, صور — حتى 50MB</p>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" className="hidden"
                    accept=".pdf,.docx,.pptx,.xlsx,.mp4,.mp3,.jpg,.jpeg,.png,.zip"
                    onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] || null }))} />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {form.material_type === 'video' ? 'رابط الفيديو (YouTube / Zoom)' : 'الرابط'}
                  </label>
                  <input value={form.external_url} onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))}
                    placeholder="https://..." type="url"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">إلغاء</button>
                <button onClick={uploadMaterial} disabled={uploading || !form.title.trim() || !form.subject_id}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin" />جاري الرفع...</> : <><Upload className="w-4 h-4" />رفع المادة</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Materials Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
          <BookOpen className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">لا توجد مواد بعد</p>
          <p className="text-gray-400 text-sm mt-1">اضغط "إضافة مادة جديدة" لرفع أول ملف</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => {
            const ext = m.file_type || ''
            const ico = FILE_TYPE_ICON[ext] || '📎'
            const typeInfo = MATERIAL_TYPES.find(t => t.value === m.material_type)
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 flex items-center justify-between border-b border-gray-100">
                  <span className="text-2xl">{typeInfo ? typeInfo.label.split(' ')[0] : ico}</span>
                  <div className="flex items-center gap-1.5">
                    {m.unit_number && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg font-medium">وحدة {m.unit_number}</span>
                    )}
                    <span className="text-xs bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-lg">{typeInfo?.label.replace(/^\S+\s/, '')}</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-800 mb-1 leading-tight">{m.title}</h3>
                  {m.description && <p className="text-sm text-gray-500 mb-2 leading-relaxed line-clamp-2">{m.description}</p>}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-lg">{m.subjects?.name}</span>
                    {m.sections && (
                      <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-lg">{getStageLabel(m)}</span>
                    )}
                    {m.unit_title && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">{m.unit_title}</span>}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                    <span>{formatDate(m.created_at)}</span>
                    <span className="flex items-center gap-2">
                      {m.view_count > 0 && <span><Eye className="w-3 h-3 inline" /> {m.view_count}</span>}
                      {m.download_count > 0 && <span><Download className="w-3 h-3 inline" /> {m.download_count}</span>}
                      {m.file_size_bytes && <span>{(m.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {(m.file_url || m.external_url) && (
                      <a href={m.file_url || m.external_url} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-xs font-semibold transition-colors">
                        {m.material_type === 'file' ? <><Download className="w-3.5 h-3.5" />تحميل</> : <><Eye className="w-3.5 h-3.5" />فتح</>}
                      </a>
                    )}
                    <button onClick={() => deleteMaterial(m.id)}
                      className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl border border-gray-100 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
