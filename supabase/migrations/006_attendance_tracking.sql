-- ============================================================
-- Migration 006: نظام متابعة تسجيل الحضور — المعلمون المتغيبون عن التسجيل
-- ============================================================

-- ============================================================
-- 1. جدول سجل متابعة الحضور (تتبع من سجّل ومن لم يسجّل)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_tracking (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE NOT NULL,
  tracking_date DATE NOT NULL,
  period INTEGER NOT NULL,
  -- حالة التسجيل
  is_recorded BOOLEAN DEFAULT FALSE,
  recorded_at TIMESTAMPTZ,
  students_count INTEGER DEFAULT 0,  -- عدد طلاب الفصل
  present_count INTEGER DEFAULT 0,   -- عدد الحاضرين
  absent_count INTEGER DEFAULT 0,    -- عدد الغائبين
  late_count INTEGER DEFAULT 0,      -- عدد المتأخرين
  -- الإشعارات المُرسلة
  reminder_sent BOOLEAN DEFAULT FALSE,
  reminder_sent_at TIMESTAMPTZ,
  reminder_count INTEGER DEFAULT 0,  -- عدد مرات الإرسال
  -- ملاحظات
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(teacher_id, section_id, subject_id, tracking_date, period)
);

-- Trigger لتحديث updated_at
CREATE TRIGGER update_attendance_tracking_modtime
  BEFORE UPDATE ON public.attendance_tracking
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- RLS
ALTER TABLE public.attendance_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracking_select_admin" ON public.attendance_tracking FOR SELECT
  USING (get_user_role() IN ('admin', 'management'));

CREATE POLICY "tracking_select_teacher" ON public.attendance_tracking FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "tracking_manage_admin" ON public.attendance_tracking FOR ALL
  USING (get_user_role() IN ('admin', 'management'));

CREATE POLICY "tracking_update_teacher" ON public.attendance_tracking FOR UPDATE
  USING (teacher_id = auth.uid());

-- ============================================================
-- 2. دالة: توليد سجلات التتبع اليومية من الجدول الدراسي
-- تُنفَّذ يومياً (يدوياً أو عبر cron في Supabase)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_daily_attendance_tracking(p_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_of_week INTEGER;
  v_inserted INTEGER := 0;
  v_schedule RECORD;
  v_student_count INTEGER;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date);

  -- لكل حصة في الجدول في هذا اليوم
  FOR v_schedule IN
    SELECT
      s.id AS schedule_id,
      s.teacher_id,
      s.section_id,
      s.subject_id,
      s.period,
      s.day_of_week
    FROM public.schedules s
    WHERE s.day_of_week = v_day_of_week
  LOOP
    -- عدد طلاب الفصل
    SELECT COUNT(*) INTO v_student_count
    FROM public.students
    WHERE section_id = v_schedule.section_id;

    -- إدراج سجل تتبع إذا لم يكن موجوداً
    INSERT INTO public.attendance_tracking (
      teacher_id, section_id, subject_id, schedule_id,
      tracking_date, period, is_recorded, students_count
    ) VALUES (
      v_schedule.teacher_id,
      v_schedule.section_id,
      v_schedule.subject_id,
      v_schedule.schedule_id,
      p_date,
      v_schedule.period,
      FALSE,
      v_student_count
    )
    ON CONFLICT (teacher_id, section_id, subject_id, tracking_date, period) DO NOTHING;

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_daily_attendance_tracking(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_daily_attendance_tracking(DATE) TO service_role;

-- ============================================================
-- 3. دالة: تحديث سجل التتبع عند تسجيل الحضور
-- تُستدعى تلقائياً عند INSERT/UPDATE في جدول attendance
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_attendance_tracking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_present INTEGER;
  v_absent  INTEGER;
  v_late    INTEGER;
  v_total   INTEGER;
BEGIN
  -- حساب إحصائيات الحضور لهذه الحصة
  SELECT
    COUNT(*) FILTER (WHERE status = 'present'),
    COUNT(*) FILTER (WHERE status = 'absent'),
    COUNT(*) FILTER (WHERE status = 'late'),
    COUNT(*)
  INTO v_present, v_absent, v_late, v_total
  FROM public.attendance
  WHERE
    section_id = NEW.section_id
    AND subject_id = NEW.subject_id
    AND date = NEW.date
    AND period = NEW.period;

  -- تحديث سجل التتبع
  UPDATE public.attendance_tracking SET
    is_recorded = TRUE,
    recorded_at = COALESCE(recorded_at, NOW()),
    present_count = v_present,
    absent_count = v_absent,
    late_count = v_late,
    students_count = GREATEST(students_count, v_total),
    updated_at = NOW()
  WHERE
    section_id = NEW.section_id
    AND subject_id = NEW.subject_id
    AND tracking_date = NEW.date
    AND period = NEW.period;

  -- إذا لم يوجد سجل تتبع، نُنشئه
  IF NOT FOUND THEN
    INSERT INTO public.attendance_tracking (
      teacher_id, section_id, subject_id, schedule_id,
      tracking_date, period, is_recorded, recorded_at,
      present_count, absent_count, late_count, students_count
    )
    SELECT
      sch.teacher_id, NEW.section_id, NEW.subject_id, sch.id,
      NEW.date, NEW.period, TRUE, NOW(),
      v_present, v_absent, v_late, v_total
    FROM public.schedules sch
    WHERE
      sch.section_id = NEW.section_id
      AND sch.subject_id = NEW.subject_id
      AND sch.day_of_week = EXTRACT(DOW FROM NEW.date)
      AND sch.period = NEW.period
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_attendance_recorded ON public.attendance;
CREATE TRIGGER on_attendance_recorded
  AFTER INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_attendance_tracking();

-- ============================================================
-- 4. دالة: إرسال إشعارات للمعلمين الذين لم يسجلوا الحضور
-- تُنفَّذ بعد انتهاء كل حصة (يدوياً أو cron)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_teachers_missing_attendance(
  p_date DATE DEFAULT CURRENT_DATE,
  p_period INTEGER DEFAULT NULL  -- NULL = كل الحصص المنتهية
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tracking RECORD;
  v_teacher_name TEXT;
  v_section_name TEXT;
  v_subject_name TEXT;
  v_class_name TEXT;
  v_notified INTEGER := 0;
  v_current_period INTEGER;
BEGIN
  -- تحديد الحصص المنتهية بناءً على الوقت الحالي
  -- نفترض كل حصة 45 دقيقة، تبدأ الدوام 8:00
  -- الحصة 1: 8:00-8:45، 2: 8:50-9:35، إلخ...
  v_current_period := CASE
    WHEN CURRENT_TIME < '08:45' THEN 0
    WHEN CURRENT_TIME < '09:35' THEN 1
    WHEN CURRENT_TIME < '10:25' THEN 2
    WHEN CURRENT_TIME < '11:25' THEN 3  -- استراحة
    WHEN CURRENT_TIME < '12:15' THEN 4
    WHEN CURRENT_TIME < '13:05' THEN 5
    WHEN CURRENT_TIME < '13:55' THEN 6
    ELSE 7
  END;

  FOR v_tracking IN
    SELECT
      at.*,
      u.full_name AS teacher_name,
      sec.name AS section_name,
      cl.name AS class_name,
      sub.name AS subject_name,
      sch.start_time
    FROM public.attendance_tracking at
    JOIN public.teachers t ON t.id = at.teacher_id
    JOIN public.users u ON u.id = at.teacher_id
    JOIN public.sections sec ON sec.id = at.section_id
    JOIN public.classes cl ON cl.id = sec.class_id
    JOIN public.subjects sub ON sub.id = at.subject_id
    LEFT JOIN public.schedules sch ON sch.id = at.schedule_id
    WHERE
      at.tracking_date = p_date
      AND at.is_recorded = FALSE
      AND at.students_count > 0
      AND (p_period IS NULL OR at.period = p_period)
      AND (p_period IS NOT NULL OR at.period <= v_current_period)
      AND at.reminder_count < 3  -- لا يزيد عن 3 تذكيرات
  LOOP
    -- إرسال إشعار للمعلم
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_tracking.teacher_id,
      '⚠️ تذكير: لم تُسجّل الحضور',
      'لم يتم تسجيل حضور الحصة ' || v_tracking.period ||
      ' — ' || v_tracking.subject_name ||
      ' — ' || v_tracking.class_name || ' شعبة ' || v_tracking.section_name ||
      ' بتاريخ ' || TO_CHAR(p_date, 'DD/MM/YYYY') ||
      '. يرجى تسجيل الحضور فوراً.',
      'warning',
      '/dashboard/teacher/attendance'
    );

    -- تحديث سجل التتبع
    UPDATE public.attendance_tracking SET
      reminder_sent = TRUE,
      reminder_sent_at = NOW(),
      reminder_count = reminder_count + 1,
      updated_at = NOW()
    WHERE id = v_tracking.id;

    v_notified := v_notified + 1;
  END LOOP;

  RETURN v_notified;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_teachers_missing_attendance(DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_teachers_missing_attendance(DATE, INTEGER) TO service_role;

-- ============================================================
-- 5. View: إحصائيات شاملة للمدير عن حالة التسجيل
-- ============================================================
CREATE OR REPLACE VIEW public.attendance_tracking_summary AS
SELECT
  at.tracking_date,
  at.period,
  u.full_name AS teacher_name,
  u.id AS teacher_id,
  u.email AS teacher_email,
  u.phone AS teacher_phone,
  sub.name AS subject_name,
  cl.name AS class_name,
  sec.name AS section_name,
  at.is_recorded,
  at.recorded_at,
  at.students_count,
  at.present_count,
  at.absent_count,
  at.late_count,
  CASE WHEN at.students_count > 0
    THEN ROUND((at.present_count::NUMERIC / at.students_count) * 100, 1)
    ELSE 0
  END AS attendance_rate,
  at.reminder_sent,
  at.reminder_count,
  at.reminder_sent_at,
  -- وقت الحصة من الجدول
  sch.start_time AS period_start,
  sch.end_time AS period_end,
  at.id AS tracking_id
FROM public.attendance_tracking at
JOIN public.users u ON u.id = at.teacher_id
JOIN public.subjects sub ON sub.id = at.subject_id
JOIN public.sections sec ON sec.id = at.section_id
JOIN public.classes cl ON cl.id = sec.class_id
LEFT JOIN public.schedules sch ON sch.id = at.schedule_id;

-- RLS للـ View
CREATE OR REPLACE FUNCTION public.get_attendance_tracking_summary(p_date DATE)
RETURNS TABLE (
  tracking_date DATE, period INTEGER, teacher_name TEXT, teacher_id UUID,
  teacher_email TEXT, teacher_phone TEXT, subject_name TEXT, class_name TEXT,
  section_name TEXT, is_recorded BOOLEAN, recorded_at TIMESTAMPTZ,
  students_count INTEGER, present_count INTEGER, absent_count INTEGER,
  late_count INTEGER, attendance_rate NUMERIC, reminder_sent BOOLEAN,
  reminder_count INTEGER, period_start TIME, period_end TIME, tracking_id UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tracking_date, period, teacher_name, teacher_id, teacher_email, teacher_phone,
    subject_name, class_name, section_name, is_recorded, recorded_at,
    students_count, present_count, absent_count, late_count,
    attendance_rate, reminder_sent, reminder_count, period_start, period_end, tracking_id
  FROM public.attendance_tracking_summary
  WHERE tracking_date = p_date
  ORDER BY period, is_recorded, teacher_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_attendance_tracking_summary(DATE) TO authenticated;

-- ============================================================
-- 6. دالة: إحصائيات أسبوعية/شهرية للمدير
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_teacher_attendance_stats(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  teacher_id UUID,
  teacher_name TEXT,
  teacher_email TEXT,
  total_scheduled INTEGER,
  total_recorded INTEGER,
  total_missed INTEGER,
  recording_rate NUMERIC,
  total_reminders INTEGER,
  avg_attendance_rate NUMERIC,
  total_students_handled INTEGER,
  last_recorded_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    at.teacher_id,
    u.full_name AS teacher_name,
    u.email AS teacher_email,
    COUNT(*)::INTEGER AS total_scheduled,
    COUNT(*) FILTER (WHERE at.is_recorded = TRUE)::INTEGER AS total_recorded,
    COUNT(*) FILTER (WHERE at.is_recorded = FALSE)::INTEGER AS total_missed,
    CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE at.is_recorded = TRUE)::NUMERIC / COUNT(*)) * 100, 1)
      ELSE 0
    END AS recording_rate,
    COALESCE(SUM(at.reminder_count), 0)::INTEGER AS total_reminders,
    ROUND(AVG(CASE WHEN at.is_recorded AND at.students_count > 0
      THEN (at.present_count::NUMERIC / at.students_count) * 100 ELSE NULL END), 1) AS avg_attendance_rate,
    COALESCE(SUM(at.students_count), 0)::INTEGER AS total_students_handled,
    MAX(at.recorded_at) AS last_recorded_at
  FROM public.attendance_tracking at
  JOIN public.users u ON u.id = at.teacher_id
  WHERE at.tracking_date BETWEEN p_from AND p_to
  GROUP BY at.teacher_id, u.full_name, u.email
  ORDER BY recording_rate ASC, total_missed DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_attendance_stats(DATE, DATE) TO authenticated;

-- ============================================================
-- 7. دالة: تفاصيل معلم محدد
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_teacher_attendance_detail(
  p_teacher_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  tracking_date DATE, period INTEGER, subject_name TEXT,
  class_name TEXT, section_name TEXT, is_recorded BOOLEAN,
  recorded_at TIMESTAMPTZ, students_count INTEGER,
  present_count INTEGER, absent_count INTEGER, late_count INTEGER,
  attendance_rate NUMERIC, reminder_count INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    at.tracking_date, at.period, sub.name, cl.name, sec.name,
    at.is_recorded, at.recorded_at, at.students_count,
    at.present_count, at.absent_count, at.late_count,
    CASE WHEN at.students_count > 0
      THEN ROUND((at.present_count::NUMERIC / at.students_count) * 100, 1) ELSE 0
    END,
    at.reminder_count
  FROM public.attendance_tracking at
  JOIN public.subjects sub ON sub.id = at.subject_id
  JOIN public.sections sec ON sec.id = at.section_id
  JOIN public.classes cl ON cl.id = sec.class_id
  WHERE at.teacher_id = p_teacher_id
    AND at.tracking_date BETWEEN p_from AND p_to
  ORDER BY at.tracking_date DESC, at.period;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_attendance_detail(UUID, DATE, DATE) TO authenticated;

-- ============================================================
-- 8. دالة: إرسال تذكير لمعلم محدد (من المدير)
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_attendance_reminder(p_tracking_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  -- فقط Admin و Management يمكنهم استخدام هذه الدالة
  IF get_user_role() NOT IN ('admin', 'management') THEN
    RETURN FALSE;
  END IF;

  SELECT at.*, u.full_name AS teacher_name, sub.name AS subject_name,
    sec.name AS section_name, cl.name AS class_name
  INTO v_rec
  FROM public.attendance_tracking at
  JOIN public.users u ON u.id = at.teacher_id
  JOIN public.subjects sub ON sub.id = at.subject_id
  JOIN public.sections sec ON sec.id = at.section_id
  JOIN public.classes cl ON cl.id = sec.class_id
  WHERE at.id = p_tracking_id AND at.is_recorded = FALSE;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    v_rec.teacher_id,
    '🔔 تذكير من الإدارة: الحضور',
    'الإدارة تطلب منك تسجيل حضور حصة ' || v_rec.period ||
    ' — ' || v_rec.subject_name || ' — ' || v_rec.class_name ||
    ' شعبة ' || v_rec.section_name ||
    ' بتاريخ ' || TO_CHAR(v_rec.tracking_date, 'DD/MM/YYYY'),
    'error',
    '/dashboard/teacher/attendance'
  );

  UPDATE public.attendance_tracking SET
    reminder_sent = TRUE, reminder_sent_at = NOW(),
    reminder_count = reminder_count + 1, updated_at = NOW()
  WHERE id = p_tracking_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_attendance_reminder(UUID) TO authenticated;

-- ============================================================
-- 9. إجراء يومي تلقائي (يُشغَّل بواسطة Supabase Cron أو يدوياً)
-- ============================================================
CREATE OR REPLACE FUNCTION public.daily_attendance_maintenance()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generated INTEGER;
  v_notified INTEGER;
BEGIN
  -- 1. توليد سجلات التتبع لليوم الحالي
  SELECT public.generate_daily_attendance_tracking(CURRENT_DATE) INTO v_generated;

  -- 2. إرسال إشعارات للمعلمين الذين فاتتهم الحصص
  SELECT public.notify_teachers_missing_attendance(CURRENT_DATE, NULL) INTO v_notified;

  RETURN 'Generated: ' || v_generated || ' records. Notified: ' || v_notified || ' teachers.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.daily_attendance_maintenance() TO service_role;
