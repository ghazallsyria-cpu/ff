'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Upload,
  FileText,
  Video,
  Link,
  BookOpen,
  Plus,
  Trash2,
  Eye,
  Download,
  Loader2,
  CheckCircle,
  X,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

const MATERIAL_TYPES = [
  { value: 'file', label: '📎 ملف', icon: FileText },
  { value: 'video', label: '🎥 فيديو', icon: Video },
  { value: 'link', label: '🔗 رابط', icon: Link },
  { value: 'note', label: '📝 ملاحظة', icon: BookOpen },
  { value: 'exam_prep', label: '📋 مراجعة', icon: CheckCircle },
]

const FILE_TYPE_ICON: Record<string, string> = {
  pdf: '📄',
  docx: '📝',
  pptx: '📊',
  xlsx: '📈',
  mp4: '🎥',
  mp3: '🎵',
  jpg: '🖼️',
  png: '🖼️',
  default: '📎',
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
    title: '',
    description: '',
    material_type: 'file',
    subject_id: '',
    section_id: '',
    unit_number: '',
    unit_title: '',
    external_url: '',
    file: null as File | null,
  })

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: mats }, { data: subs }, { data: sects }] = await Promise.all([
      supabase
        .from('study_materials')
        .select('*, subjects(name), sections(name, classes(name, grade_number, stage, stream))')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('teacher_sections')
        .select('subjects(id, name), sections(id, name, classes(name, grade_number, stage, stream))')
        .eq('teacher_id', user.id),

      supabase
        .from('teacher_sections')
        .select('sections(id, name, classes(name, grade_number))')
        .eq('teacher_id', user.id),
    ])

    setMaterials(mats || [])

    const uniqueSubs = new Map()
    ;(subs || []).forEach((ts: any) => {
      if (ts.subjects) uniqueSubs.set(ts.subjects.id, ts.subjects)
    })
    setSubjects(Array.from(uniqueSubs.values()))

    const uniqueSects = new Map()
    ;(sects || []).forEach((ts: any) => {
      if (ts.sections) uniqueSects.set(ts.sections.id, ts.sections)
    })
    setSections(Array.from(uniqueSects.values()))

    setLoading(false)
  }

  async function uploadMaterial() {
    if (!form.title.trim() || !form.subject_id) return

    setUploading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let fileUrl = form.external_url || null
    let fileName = null
    let fileSize = null
    let fileType = null

    if (form.file) {
      const ext = form.file.name.split('.').pop()
      const path = `materials/${user.id}/${Date.now()}.${ext}`

      const { data: up } = await supabase.storage
        .from('school-materials')
        .upload(path, form.file)

      if (up) {
        const { data: urlData } = supabase.storage
          .from('school-materials')
          .getPublicUrl(path)

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
      external_url:
        form.material_type !== 'file' ? form.external_url || null : null,
      is_published: true,
    })

    setForm({
      title: '',
      description: '',
      material_type: 'file',
      subject_id: '',
      section_id: '',
      unit_number: '',
      unit_title: '',
      external_url: '',
      file: null,
    })

    setShowForm(false)
    setUploading(false)

    loadAll()
  }

  async function deleteMaterial(id: string) {
    if (!confirm('حذف هذه المادة نهائياً؟')) return
    await supabase.from('study_materials').delete().eq('id', id)
    setMaterials((prev) => prev.filter((m) => m.id !== id))
  }

  const filtered = materials.filter((m) => {
    if (filter.subject && m.subject_id !== filter.subject) return false
    if (filter.type && m.material_type !== filter.type) return false
    if (
      filter.search &&
      !m.title.toLowerCase().includes(filter.search.toLowerCase())
    )
      return false
    return true
  })

  const getStageLabel = (m: any) => {
    const cl = m.sections?.classes
    if (!cl) return ''
    const stage = cl.stage === 'middle' ? 'متوسط' : 'ثانوي'
    const stream =
      cl.stream === 'science'
        ? ' علمي'
        : cl.stream === 'arts'
        ? ' أدبي'
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-blue-600" />
          المكتبة
        </h1>

        <button onClick={() => setShowForm(true)}>
          <Plus /> إضافة
        </button>
      </div>

      {filtered.map((m) => (
        <div key={m.id} className="border p-4 rounded-xl mb-3">
          <h3 className="font-bold">{m.title}</h3>

          <div className="flex gap-2 mt-2">
            <a href={m.file_url || m.external_url} target="_blank">
              عرض
            </a>

            <button onClick={() => deleteMaterial(m.id)}>
              <Trash2 />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
