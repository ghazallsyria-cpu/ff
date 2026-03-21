-- ================================================================
-- Migration 008: المراحل + المكتبة + الدعم النفسي + تقارير ولي الأمر
-- مدرسة الرفعة النموذجية — بنين — الكويت
-- ================================================================

-- ================================================================
-- PART 1: تمييز المراحل والأقسام
-- ================================================================

-- إضافة المرحلة الدراسية لجدول الصفوف
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'middle'
    CHECK (stage IN ('middle','secondary')),
  ADD COLUMN IF NOT EXISTS grade_number INTEGER
    CHECK (grade_number BETWEEN 6 AND 12);

-- إضافة القسم للصفوف الثانوية
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS stream TEXT DEFAULT NULL
    CHECK (stream IN ('science','arts', NULL));

-- تحديث الصفوف بناءً على الرقم
-- متوسط: 6-9، ثانوي: 10-12
UPDATE public.classes SET stage = 'middle'     WHERE grade_number BETWEEN 6 AND 9;
UPDATE public.classes SET stage = 'secondary'  WHERE grade_number BETWEEN 10 AND 12;

-- إضافة المرحلة للمواد (مادة قد تُدرَّس في مراحل متعددة)
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS stages TEXT[] DEFAULT ARRAY['middle','secondary'],
  ADD COLUMN IF NOT EXISTS streams TEXT[] DEFAULT ARRAY['science','arts'],
  ADD COLUMN IF NOT EXISTS is_core BOOLEAN DEFAULT TRUE; -- أساسية أم اختيارية

-- جدول توزيع الطلاب على الشعب (مع القسم)
-- (الجدول students موجود، نضيف stream للشعبة)
ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS stream TEXT DEFAULT NULL
    CHECK (stream IN ('science','arts', NULL)),
  ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 35;

-- View: الطلاب مع معلومات مرحلتهم كاملة
CREATE OR REPLACE VIEW public.students_full AS
SELECT
  s.id, u.full_name, u.email, u.phone,
  sec.name AS section_name, sec.stream,
  cl.name AS class_name, cl.grade_number, cl.stage,
  s.parent_id,
  pu.full_name AS parent_name
FROM public.students s
JOIN public.users u ON u.id = s.id
JOIN public.sections sec ON sec.id = s.section_id
JOIN public.classes cl ON cl.id = sec.class_id
LEFT JOIN public.users pu ON pu.id = s.parent_id;

-- ================================================================
-- PART 2: مكتبة المحتوى التعليمي
-- ================================================================

CREATE TABLE IF NOT EXISTS public.study_materials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  -- يمكن ربطه بصف بدلاً من شعبة (لكل طلاب الصف)
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  -- معلومات الملف
  title TEXT NOT NULL,
  description TEXT,
  material_type TEXT DEFAULT 'file'
    CHECK (material_type IN ('file','video','link','note','exam_prep')),
  file_url TEXT,       -- Supabase Storage URL
  file_name TEXT,
  file_size_bytes BIGINT,
  file_type TEXT,      -- pdf, docx, pptx, mp4, ...
  external_url TEXT,   -- لو رابط خارجي (YouTube, Drive)
  -- تنظيم
  unit_number INTEGER,
  unit_title TEXT,
  week_number INTEGER,
  -- إتاحة
  is_published BOOLEAN DEFAULT TRUE,
  publish_date DATE DEFAULT CURRENT_DATE,
  available_until DATE,
  -- إحصاء
  download_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_materials_modtime
  BEFORE UPDATE ON public.study_materials
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- سجل تحميلات/مشاهدات المواد
CREATE TABLE IF NOT EXISTS public.material_interactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  material_id UUID REFERENCES public.study_materials(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  interaction_type TEXT CHECK (interaction_type IN ('view','download','complete')),
  interacted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(material_id, student_id, interaction_type)
);

-- RLS للمكتبة
ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materials_select" ON public.study_materials FOR SELECT
  USING (
    get_user_role() IN ('admin','management') OR
    teacher_id = auth.uid() OR
    -- الطالب يرى مواد شعبته أو صفه
    (is_published = TRUE AND (
      section_id IN (SELECT section_id FROM public.students WHERE id = auth.uid()) OR
      class_id IN (
        SELECT cl.id FROM public.students s
        JOIN public.sections sec ON sec.id = s.section_id
        JOIN public.classes cl ON cl.id = sec.class_id
        WHERE s.id = auth.uid()
      )
    )) OR
    -- ولي الأمر يرى مواد أبنائه
    (is_published = TRUE AND section_id IN (
      SELECT section_id FROM public.students WHERE parent_id = auth.uid()
    ))
  );

CREATE POLICY "materials_manage_teacher" ON public.study_materials FOR ALL
  USING (teacher_id = auth.uid() OR get_user_role() IN ('admin','management'));

CREATE POLICY "interactions_own" ON public.material_interactions FOR ALL
  USING (student_id = auth.uid() OR get_user_role() IN ('admin','management','teacher'));

-- دالة: تسجيل تفاعل الطالب مع المادة
CREATE OR REPLACE FUNCTION public.record_material_interaction(
  p_material_id UUID,
  p_type TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.material_interactions (material_id, student_id, interaction_type)
  VALUES (p_material_id, auth.uid(), p_type)
  ON CONFLICT (material_id, student_id, interaction_type) DO NOTHING;

  -- تحديث العداد
  IF p_type = 'download' THEN
    UPDATE public.study_materials SET download_count = download_count + 1 WHERE id = p_material_id;
  ELSIF p_type = 'view' THEN
    UPDATE public.study_materials SET view_count = view_count + 1 WHERE id = p_material_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_material_interaction(UUID, TEXT) TO authenticated;

-- ================================================================
-- PART 3: نظام الدعم النفسي والاجتماعي
-- ================================================================

-- استبيان الحالة اليومية (Check-in)
CREATE TABLE IF NOT EXISTS public.wellbeing_checkins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- المقياس: 1=سيء جداً، 2=سيء، 3=عادي، 4=جيد، 5=ممتاز
  mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
  mood_emoji TEXT, -- 😢😕😐🙂😄
  -- ملاحظة اختيارية من الطالب
  student_note TEXT,
  -- هل أُرسل تنبيه للمرشد؟
  alert_sent BOOLEAN DEFAULT FALSE,
  counselor_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, checkin_date)
);

-- مجلة الطالب الخاصة (سرية تماماً)
CREATE TABLE IF NOT EXISTS public.student_journal (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL, -- مشفّر على مستوى التطبيق
  mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 5),
  is_private BOOLEAN DEFAULT TRUE, -- لا يراه أحد إلا بإذن الطالب
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- طلبات الدعم من الطالب
CREATE TABLE IF NOT EXISTS public.support_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  request_type TEXT CHECK (request_type IN ('academic','emotional','family','bullying','other')),
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('low','normal','high','urgent')),
  message TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT FALSE,
  -- حالة المعالجة
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','resolved','closed')),
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  response_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_support_requests_modtime
  BEFORE UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- RLS للدعم النفسي
ALTER TABLE public.wellbeing_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- الطالب فقط يرى check-ins نفسه؛ المدير والمرشد يرون الكل
CREATE POLICY "checkins_student_own" ON public.wellbeing_checkins FOR ALL
  USING (student_id = auth.uid() OR get_user_role() IN ('admin','management'));

-- المجلة سرية تماماً — الطالب فقط
CREATE POLICY "journal_private" ON public.student_journal FOR ALL
  USING (student_id = auth.uid());

-- طلبات الدعم
CREATE POLICY "support_student" ON public.support_requests FOR SELECT
  USING (student_id = auth.uid() OR get_user_role() IN ('admin','management') OR assigned_to = auth.uid());
CREATE POLICY "support_insert" ON public.support_requests FOR INSERT
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "support_update_admin" ON public.support_requests FOR UPDATE
  USING (get_user_role() IN ('admin','management') OR assigned_to = auth.uid());

-- Trigger: تنبيه المرشد عند mood_score منخفض 3 مرات متتالية
CREATE OR REPLACE FUNCTION public.check_wellbeing_alert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_low_count INTEGER;
  v_student_name TEXT;
  v_admin_id UUID;
BEGIN
  -- عدّ الأيام الأخيرة ذات mood_score <= 2
  SELECT COUNT(*) INTO v_low_count
  FROM public.wellbeing_checkins
  WHERE student_id = NEW.student_id
    AND mood_score <= 2
    AND checkin_date >= CURRENT_DATE - INTERVAL '7 days';

  IF v_low_count >= 3 AND NOT NEW.alert_sent THEN
    SELECT u.full_name INTO v_student_name
    FROM public.users u WHERE u.id = NEW.student_id;

    -- إشعار لكل المدراء والإدارة
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT u.id,
      '💙 تنبيه دعم نفسي — ' || v_student_name,
      'الطالب ' || v_student_name || ' أبدى حالة نفسية منخفضة لـ ' || v_low_count ||
      ' أيام متتالية. يُنصح بالتواصل معه.',
      'warning', '/dashboard/admin/wellbeing'
    FROM public.users u
    WHERE u.role IN ('admin','management');

    UPDATE public.wellbeing_checkins
    SET alert_sent = TRUE, counselor_notified_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_wellbeing_checkin ON public.wellbeing_checkins;
CREATE TRIGGER on_wellbeing_checkin
  AFTER INSERT OR UPDATE ON public.wellbeing_checkins
  FOR EACH ROW EXECUTE FUNCTION public.check_wellbeing_alert();

-- ================================================================
-- PART 4: تقرير ولي الأمر الأسبوعي
-- ================================================================

CREATE TABLE IF NOT EXISTS public.weekly_parent_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  parent_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  -- ملخص البيانات (مخزون كـ JSON للسرعة)
  attendance_summary JSONB DEFAULT '{}',  -- {present, absent, late, total}
  grades_summary JSONB DEFAULT '{}',      -- {avg, exams: [...]}
  assignments_summary JSONB DEFAULT '{}', -- {submitted, pending, overdue}
  wellbeing_summary JSONB DEFAULT '{}',   -- {avg_mood, alerts}
  -- حالة التقرير
  is_generated BOOLEAN DEFAULT FALSE,
  generated_at TIMESTAMPTZ,
  -- رابط PDF المولّد
  pdf_url TEXT,
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, student_id, week_start)
);

ALTER TABLE public.weekly_parent_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_reports_parent" ON public.weekly_parent_reports FOR SELECT
  USING (parent_id = auth.uid() OR get_user_role() IN ('admin','management'));
CREATE POLICY "weekly_reports_admin" ON public.weekly_parent_reports FOR ALL
  USING (get_user_role() IN ('admin','management'));

-- دالة: توليد بيانات التقرير الأسبوعي
CREATE OR REPLACE FUNCTION public.generate_weekly_report(
  p_student_id UUID,
  p_week_start DATE DEFAULT date_trunc('week', CURRENT_DATE)::DATE
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_week_end DATE := p_week_start + INTERVAL '6 days';
  v_parent_id UUID;
  v_report_id UUID;
  v_attendance JSONB;
  v_grades JSONB;
  v_assignments JSONB;
  v_wellbeing JSONB;
BEGIN
  -- ولي أمر الطالب
  SELECT parent_id INTO v_parent_id FROM public.students WHERE id = p_student_id;
  IF v_parent_id IS NULL THEN RETURN NULL; END IF;

  -- إحصاء الحضور
  SELECT jsonb_build_object(
    'present', COUNT(*) FILTER (WHERE status = 'present'),
    'absent',  COUNT(*) FILTER (WHERE status = 'absent'),
    'late',    COUNT(*) FILTER (WHERE status = 'late'),
    'excused', COUNT(*) FILTER (WHERE status = 'excused'),
    'total',   COUNT(*)
  ) INTO v_attendance
  FROM public.attendance
  WHERE student_id = p_student_id AND date BETWEEN p_week_start AND v_week_end;

  -- ملخص الدرجات
  SELECT jsonb_build_object(
    'avg', ROUND(AVG(g.score), 1),
    'count', COUNT(*),
    'passed', COUNT(*) FILTER (WHERE g.score >= 50),
    'exams', jsonb_agg(jsonb_build_object(
      'title', e.title, 'score', ROUND(g.score, 1),
      'pass', g.score >= 50
    ))
  ) INTO v_grades
  FROM public.grades g
  JOIN public.exams e ON e.id = g.exam_id
  WHERE g.student_id = p_student_id AND g.created_at::DATE BETWEEN p_week_start AND v_week_end;

  -- الواجبات
  SELECT jsonb_build_object(
    'submitted', COUNT(*) FILTER (WHERE asub.status IN ('submitted','graded')),
    'pending',   COUNT(*) FILTER (WHERE asub.status = 'pending' AND a.due_date >= CURRENT_DATE),
    'overdue',   COUNT(*) FILTER (WHERE asub.status = 'pending' AND a.due_date < CURRENT_DATE)
  ) INTO v_assignments
  FROM public.assignments a
  LEFT JOIN public.assignment_submissions asub ON asub.assignment_id = a.id AND asub.student_id = p_student_id
  JOIN public.sections sec ON sec.id = a.section_id
  JOIN public.students s ON s.section_id = sec.id AND s.id = p_student_id
  WHERE a.due_date BETWEEN p_week_start AND v_week_end + INTERVAL '7 days';

  -- الحالة النفسية
  SELECT jsonb_build_object(
    'avg_mood', ROUND(AVG(mood_score), 1),
    'low_days', COUNT(*) FILTER (WHERE mood_score <= 2),
    'total_checkins', COUNT(*)
  ) INTO v_wellbeing
  FROM public.wellbeing_checkins
  WHERE student_id = p_student_id AND checkin_date BETWEEN p_week_start AND v_week_end;

  -- إنشاء/تحديث التقرير
  INSERT INTO public.weekly_parent_reports (
    parent_id, student_id, week_start, week_end,
    attendance_summary, grades_summary, assignments_summary, wellbeing_summary,
    is_generated, generated_at
  ) VALUES (
    v_parent_id, p_student_id, p_week_start, v_week_end,
    COALESCE(v_attendance, '{}'), COALESCE(v_grades, '{}'),
    COALESCE(v_assignments, '{}'), COALESCE(v_wellbeing, '{}'),
    TRUE, NOW()
  )
  ON CONFLICT (parent_id, student_id, week_start) DO UPDATE SET
    attendance_summary = EXCLUDED.attendance_summary,
    grades_summary = EXCLUDED.grades_summary,
    assignments_summary = EXCLUDED.assignments_summary,
    wellbeing_summary = EXCLUDED.wellbeing_summary,
    is_generated = TRUE, generated_at = NOW()
  RETURNING id INTO v_report_id;

  -- إشعار ولي الأمر
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT v_parent_id,
    '📊 تقرير الأسبوع جاهز',
    'التقرير الأسبوعي لابنك جاهز للمشاهدة — ' ||
    TO_CHAR(p_week_start, 'DD/MM') || ' إلى ' || TO_CHAR(v_week_end, 'DD/MM'),
    'info', '/dashboard/parent/weekly-report';

  RETURN v_report_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.generate_weekly_report(UUID, DATE) TO authenticated, service_role;

-- دالة: توليد تقارير كل الطلاب دفعة واحدة (تُشغَّل كل أحد)
CREATE OR REPLACE FUNCTION public.generate_all_weekly_reports()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_student RECORD;
  v_count INTEGER := 0;
  v_week_start DATE := date_trunc('week', CURRENT_DATE)::DATE;
BEGIN
  FOR v_student IN SELECT id FROM public.students WHERE parent_id IS NOT NULL
  LOOP
    PERFORM public.generate_weekly_report(v_student.id, v_week_start);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.generate_all_weekly_reports() TO service_role;

-- ================================================================
-- PART 5: الشهادات والتقارير الأكاديمية
-- ================================================================

CREATE TABLE IF NOT EXISTS public.academic_certificates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  semester INTEGER CHECK (semester IN (1, 2)),
  cert_type TEXT DEFAULT 'semester_report'
    CHECK (cert_type IN ('semester_report','annual_report','honor_roll','participation')),
  -- البيانات المحسوبة
  overall_avg NUMERIC(5,2),
  attendance_rate NUMERIC(5,2),
  rank_in_section INTEGER,
  total_students_in_section INTEGER,
  subjects_data JSONB DEFAULT '[]', -- [{subject, score, grade, status}]
  -- الملف
  pdf_url TEXT,
  generated_at TIMESTAMPTZ,
  generated_by UUID REFERENCES public.users(id),
  is_official BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.academic_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certs_student_own" ON public.academic_certificates FOR SELECT
  USING (
    student_id = auth.uid() OR
    student_id IN (SELECT id FROM public.students WHERE parent_id = auth.uid()) OR
    get_user_role() IN ('admin','management')
  );
CREATE POLICY "certs_admin" ON public.academic_certificates FOR ALL
  USING (get_user_role() IN ('admin','management'));

-- دالة: حساب بيانات الشهادة
CREATE OR REPLACE FUNCTION public.compute_certificate(
  p_student_id UUID,
  p_academic_year_id UUID,
  p_semester INTEGER DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSONB;
  v_section_id UUID;
  v_avg NUMERIC;
  v_attend_rate NUMERIC;
  v_rank INTEGER;
  v_total INTEGER;
BEGIN
  SELECT section_id INTO v_section_id FROM public.students WHERE id = p_student_id;

  -- المتوسط العام
  SELECT ROUND(AVG(g.score), 2) INTO v_avg
  FROM public.grades g
  JOIN public.exams e ON e.id = g.exam_id
  WHERE g.student_id = p_student_id;

  -- نسبة الحضور
  SELECT ROUND(
    COUNT(*) FILTER (WHERE status = 'present')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1
  ) INTO v_attend_rate
  FROM public.attendance WHERE student_id = p_student_id;

  -- الترتيب في الشعبة
  SELECT COUNT(*) + 1 INTO v_rank
  FROM (
    SELECT s.id, AVG(g.score) AS avg_s
    FROM public.students s
    JOIN public.grades g ON g.student_id = s.id
    JOIN public.exams e ON e.id = g.exam_id
    WHERE s.section_id = v_section_id
    GROUP BY s.id
    HAVING AVG(g.score) > v_avg
  ) ranked;

  SELECT COUNT(*) INTO v_total FROM public.students WHERE section_id = v_section_id;

  v_result := jsonb_build_object(
    'overall_avg', COALESCE(v_avg, 0),
    'attendance_rate', COALESCE(v_attend_rate, 0),
    'rank_in_section', v_rank,
    'total_students', v_total
  );

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.compute_certificate(UUID, UUID, INTEGER) TO authenticated;

-- ================================================================
-- PART 6: تحسينات إضافية
-- ================================================================

-- تنبيه خطر الرسوب
CREATE OR REPLACE FUNCTION public.check_failing_risk()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_avg NUMERIC;
  v_student_name TEXT;
  v_parent_id UUID;
  v_exam_count INTEGER;
BEGIN
  SELECT AVG(g2.score), COUNT(g2.id)
  INTO v_avg, v_exam_count
  FROM public.grades g2
  WHERE g2.student_id = NEW.student_id;

  -- إذا المتوسط أقل من 50% وهناك 3 اختبارات على الأقل
  IF v_avg < 50 AND v_exam_count >= 3 THEN
    SELECT u.full_name, s.parent_id
    INTO v_student_name, v_parent_id
    FROM public.users u
    JOIN public.students s ON s.id = u.id
    WHERE u.id = NEW.student_id;

    -- إشعار الإدارة
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT u.id,
      '⚠️ خطر رسوب — ' || v_student_name,
      'متوسط الطالب ' || v_student_name || ' انخفض إلى ' || ROUND(v_avg, 1) || '%',
      'error', '/dashboard/admin/results'
    FROM public.users u WHERE u.role IN ('admin','management');

    -- إشعار ولي الأمر
    IF v_parent_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (v_parent_id,
        '⚠️ تنبيه أكاديمي مهم',
        'متوسط ابنك ' || v_student_name || ' انخفض إلى ' || ROUND(v_avg, 1) ||
        '%. يُرجى التواصل مع المدرسة.',
        'error', '/dashboard/parent/grades'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_grade_failing_check ON public.grades;
CREATE TRIGGER on_grade_failing_check
  AFTER INSERT OR UPDATE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.check_failing_risk();

-- Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_materials_subject ON public.study_materials(subject_id);
CREATE INDEX IF NOT EXISTS idx_materials_section ON public.study_materials(section_id);
CREATE INDEX IF NOT EXISTS idx_materials_published ON public.study_materials(is_published);
CREATE INDEX IF NOT EXISTS idx_checkins_student ON public.wellbeing_checkins(student_id);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON public.wellbeing_checkins(checkin_date);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_parent ON public.weekly_parent_reports(parent_id);
CREATE INDEX IF NOT EXISTS idx_certs_student ON public.academic_certificates(student_id);
