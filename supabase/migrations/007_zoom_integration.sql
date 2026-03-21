-- ============================================================
-- Migration 007: تكامل Zoom الذكي — بدون Zoom API
-- الحل: كل شيء يُدار داخل المنصة حول الرابط الثابت
-- ============================================================

-- ============================================================
-- 1. إضافة zoom_link لجدول teachers (إذا لم يكن موجوداً)
-- ============================================================
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS zoom_link TEXT,
  ADD COLUMN IF NOT EXISTS zoom_personal_id TEXT,  -- آخر 9-11 رقم من الرابط
  ADD COLUMN IF NOT EXISTS zoom_password TEXT;      -- كلمة مرور الغرفة (اختياري)

-- ============================================================
-- 2. جدول جلسات الحصص المباشرة (Live Sessions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  session_date DATE NOT NULL,
  period INTEGER NOT NULL,
  -- حالة الجلسة
  status TEXT DEFAULT 'scheduled' 
    CHECK (status IN ('scheduled','announced','live','ended','cancelled')),
  -- توقيت فعلي
  announced_at TIMESTAMPTZ,   -- وقت إرسال إشعار الرابط
  started_at TIMESTAMPTZ,     -- وقت بدء الحصة الفعلي
  ended_at TIMESTAMPTZ,       -- وقت انتهاء الحصة
  -- رابط الجلسة
  zoom_link TEXT NOT NULL,
  zoom_password TEXT,
  -- تسجيل الحصة (يرفعه المعلم يدوياً أو رابط)
  recording_url TEXT,
  recording_uploaded_at TIMESTAMPTZ,
  recording_duration_minutes INTEGER,
  -- ملاحظات المعلم للحصة
  session_notes TEXT,
  -- إحصائيات الحضور
  expected_students INTEGER DEFAULT 0,
  checked_in_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, section_id, subject_id, session_date, period)
);

CREATE TRIGGER update_live_sessions_modtime
  BEFORE UPDATE ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ============================================================
-- 3. جدول تسجيل الحضور الذاتي (Self Check-in)
-- الطالب يضغط "دخلت الحصة" عند فتح Zoom
-- ============================================================
CREATE TABLE IF NOT EXISTS public.session_checkins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES public.live_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  -- توقيت الحضور
  checked_in_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  checked_out_at TIMESTAMPTZ,
  duration_minutes INTEGER,  -- يُحسب تلقائياً
  -- الحالة
  status TEXT DEFAULT 'present' 
    CHECK (status IN ('present','late','left_early')),
  -- هل تأخر عن بداية الحصة؟
  late_minutes INTEGER DEFAULT 0,
  -- جهاز الطالب (للإحصاءات)
  device_type TEXT,  -- mobile/desktop/tablet
  UNIQUE(session_id, student_id)
);

-- ============================================================
-- 4. جدول تسجيلات الحصص
-- ============================================================
CREATE TABLE IF NOT EXISTS public.session_recordings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES public.live_sessions(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
  -- الرابط
  recording_url TEXT NOT NULL,
  recording_type TEXT DEFAULT 'zoom_cloud' 
    CHECK (recording_type IN ('zoom_cloud','zoom_local','youtube','drive','other')),
  -- تفاصيل
  title TEXT,
  duration_minutes INTEGER,
  file_size_mb NUMERIC,
  -- إتاحة
  is_available BOOLEAN DEFAULT TRUE,
  available_until DATE,  -- NULL = متاح دائماً
  -- إحصاء المشاهدات
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_session_recordings_modtime
  BEFORE UPDATE ON public.session_recordings
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ============================================================
-- 5. جدول مشاهدات التسجيلات
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recording_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recording_id UUID REFERENCES public.session_recordings(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  duration_watched_minutes INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  UNIQUE(recording_id, student_id)
);

-- ============================================================
-- 6. RLS Policies
-- ============================================================
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_views ENABLE ROW LEVEL SECURITY;

-- live_sessions
CREATE POLICY "sessions_select_all_users" ON public.live_sessions FOR SELECT
  USING (
    get_user_role() IN ('admin','management') OR
    teacher_id = auth.uid() OR
    section_id IN (SELECT section_id FROM public.students WHERE id = auth.uid()) OR
    section_id IN (SELECT section_id FROM public.students WHERE parent_id = auth.uid()) OR
    section_id IN (SELECT section_id FROM public.teacher_sections WHERE teacher_id = auth.uid())
  );

CREATE POLICY "sessions_insert_teacher" ON public.live_sessions FOR INSERT
  WITH CHECK (teacher_id = auth.uid() OR get_user_role() IN ('admin','management'));

CREATE POLICY "sessions_update_teacher" ON public.live_sessions FOR UPDATE
  USING (teacher_id = auth.uid() OR get_user_role() IN ('admin','management'));

-- session_checkins
CREATE POLICY "checkins_select" ON public.session_checkins FOR SELECT
  USING (
    student_id = auth.uid() OR
    get_user_role() IN ('admin','management','teacher') OR
    student_id IN (SELECT id FROM public.students WHERE parent_id = auth.uid())
  );

CREATE POLICY "checkins_insert_student" ON public.session_checkins FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "checkins_update_student" ON public.session_checkins FOR UPDATE
  USING (student_id = auth.uid());

-- session_recordings
CREATE POLICY "recordings_select" ON public.session_recordings FOR SELECT
  USING (
    get_user_role() IN ('admin','management') OR
    teacher_id = auth.uid() OR
    -- الطالب يرى تسجيلات فصله فقط
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      JOIN public.students s ON s.section_id = ls.section_id
      WHERE ls.id = session_id AND s.id = auth.uid()
    ) OR
    -- ولي الأمر يرى تسجيلات أبنائه
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      JOIN public.students s ON s.section_id = ls.section_id
      WHERE ls.id = session_id AND s.parent_id = auth.uid()
    )
  );

CREATE POLICY "recordings_manage_teacher" ON public.session_recordings FOR ALL
  USING (teacher_id = auth.uid() OR get_user_role() IN ('admin','management'));

-- recording_views
CREATE POLICY "views_own" ON public.recording_views FOR ALL
  USING (student_id = auth.uid() OR get_user_role() IN ('admin','management','teacher'));

-- ============================================================
-- 7. دالة: إنشاء جلسات اليوم تلقائياً من الجدول
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_daily_sessions(p_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_day INTEGER;
  v_inserted INTEGER := 0;
  v_sched RECORD;
  v_zoom_link TEXT;
  v_zoom_pass TEXT;
  v_student_count INTEGER;
BEGIN
  v_day := EXTRACT(DOW FROM p_date);
  
  FOR v_sched IN
    SELECT s.id, s.teacher_id, s.section_id, s.subject_id, s.period
    FROM public.schedules s
    WHERE s.day_of_week = v_day
  LOOP
    -- احضر رابط Zoom للمعلم
    SELECT zoom_link, zoom_password INTO v_zoom_link, v_zoom_pass
    FROM public.teachers WHERE id = v_sched.teacher_id;
    
    IF v_zoom_link IS NULL THEN CONTINUE; END IF;
    
    -- عدد طلاب الفصل
    SELECT COUNT(*) INTO v_student_count
    FROM public.students WHERE section_id = v_sched.section_id;
    
    INSERT INTO public.live_sessions (
      schedule_id, teacher_id, section_id, subject_id,
      session_date, period, status,
      zoom_link, zoom_password, expected_students
    ) VALUES (
      v_sched.id, v_sched.teacher_id, v_sched.section_id, v_sched.subject_id,
      p_date, v_sched.period, 'scheduled',
      v_zoom_link, v_zoom_pass, v_student_count
    )
    ON CONFLICT (teacher_id, section_id, subject_id, session_date, period) DO NOTHING;
    
    v_inserted := v_inserted + 1;
  END LOOP;
  
  RETURN v_inserted;
END;
$$;

-- ============================================================
-- 8. دالة: إرسال إشعار رابط الحصة قبل 5 دقائق
-- ============================================================
CREATE OR REPLACE FUNCTION public.announce_upcoming_sessions()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session RECORD;
  v_student RECORD;
  v_teacher_name TEXT;
  v_subject_name TEXT;
  v_section_name TEXT;
  v_class_name TEXT;
  v_notified INTEGER := 0;
BEGIN
  FOR v_session IN
    SELECT ls.*,
           sch.start_time,
           u.full_name AS teacher_name,
           sub.name AS subject_name,
           sec.name AS section_name,
           cl.name AS class_name
    FROM public.live_sessions ls
    JOIN public.schedules sch ON sch.id = ls.schedule_id
    JOIN public.users u ON u.id = ls.teacher_id
    JOIN public.subjects sub ON sub.id = ls.subject_id
    JOIN public.sections sec ON sec.id = ls.section_id
    JOIN public.classes cl ON cl.id = sec.class_id
    WHERE ls.session_date = CURRENT_DATE
      AND ls.status = 'scheduled'
      AND sch.start_time IS NOT NULL
      AND (sch.start_time::TIME - INTERVAL '5 minutes') <= CURRENT_TIME
      AND sch.start_time::TIME > CURRENT_TIME
  LOOP
    -- إشعار للمعلم
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_session.teacher_id,
      '🔔 حصتك تبدأ خلال 5 دقائق',
      'حصة ' || v_session.subject_name || ' — ' || v_session.class_name || ' شعبة ' || v_session.section_name ||
      ' | انقر لبدء الجلسة وإرسال الرابط للطلاب',
      'info', '/dashboard/teacher/live'
    );
    
    -- إشعار لكل طلاب الفصل
    FOR v_student IN
      SELECT s.id AS student_id, s.parent_id, u.full_name
      FROM public.students s
      JOIN public.users u ON u.id = s.id
      WHERE s.section_id = v_session.section_id
    LOOP
      -- إشعار الطالب
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_student.student_id,
        '📹 حصة ' || v_session.subject_name || ' تبدأ قريباً!',
        'تبدأ خلال 5 دقائق — المعلم: ' || v_session.teacher_name ||
        ' | اضغط هنا للدخول',
        'info', '/dashboard/student/live'
      );
      
      -- إشعار ولي الأمر
      IF v_student.parent_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
          v_student.parent_id,
          '📹 حصة ' || v_session.subject_name || ' لابنك',
          v_student.full_name || ' لديه حصة ' || v_session.subject_name ||
          ' مع ' || v_session.teacher_name || ' خلال 5 دقائق',
          'info', '/dashboard/parent'
        ) ON CONFLICT DO NOTHING;
      END IF;
      
      v_notified := v_notified + 1;
    END LOOP;
    
    -- تحديث حالة الجلسة
    UPDATE public.live_sessions SET
      status = 'announced',
      announced_at = NOW()
    WHERE id = v_session.id;
    
  END LOOP;
  
  RETURN v_notified;
END;
$$;

GRANT EXECUTE ON FUNCTION public.announce_upcoming_sessions() TO authenticated, service_role;

-- ============================================================
-- 9. دالة: تسجيل Check-in الطالب + تحديث الحضور تلقائياً
-- ============================================================
CREATE OR REPLACE FUNCTION public.student_checkin(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_session RECORD;
  v_late_minutes INTEGER := 0;
  v_status TEXT := 'present';
  v_checkin RECORD;
BEGIN
  -- احضر بيانات الجلسة
  SELECT ls.*, sch.start_time
  INTO v_session
  FROM public.live_sessions ls
  LEFT JOIN public.schedules sch ON sch.id = ls.schedule_id
  WHERE ls.id = p_session_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;
  
  -- حساب التأخر
  IF v_session.start_time IS NOT NULL THEN
    v_late_minutes := GREATEST(0, EXTRACT(EPOCH FROM (NOW() - (v_session.session_date + v_session.start_time::TIME))) / 60)::INTEGER;
    IF v_late_minutes > 10 THEN v_status := 'late'; END IF;
  END IF;
  
  -- تسجيل الدخول
  INSERT INTO public.session_checkins (
    session_id, student_id, status, late_minutes, checked_in_at
  ) VALUES (
    p_session_id, v_student_id, v_status, v_late_minutes, NOW()
  )
  ON CONFLICT (session_id, student_id) DO UPDATE
    SET checked_in_at = NOW(), status = v_status
  RETURNING * INTO v_checkin;
  
  -- تحديث جدول الحضور الرئيسي تلقائياً
  INSERT INTO public.attendance (
    student_id, section_id, subject_id, teacher_id,
    date, period, status
  )
  SELECT
    v_student_id, v_session.section_id, v_session.subject_id, v_session.teacher_id,
    v_session.session_date, v_session.period, v_status
  ON CONFLICT (student_id, subject_id, date, period) 
  DO UPDATE SET status = v_status;
  
  -- تحديث عداد الحضور في الجلسة
  UPDATE public.live_sessions SET
    checked_in_count = (
      SELECT COUNT(*) FROM public.session_checkins WHERE session_id = p_session_id
    ),
    status = CASE WHEN status = 'announced' THEN 'live' ELSE status END,
    started_at = COALESCE(started_at, NOW())
  WHERE id = p_session_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'status', v_status,
    'late_minutes', v_late_minutes,
    'message', CASE v_status WHEN 'late' THEN 'تم تسجيلك متأخراً بـ ' || v_late_minutes || ' دقيقة' ELSE 'تم تسجيل حضورك بنجاح ✅' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.student_checkin(UUID) TO authenticated;

-- ============================================================
-- 10. دالة: تسجيل خروج الطالب (checkout)
-- ============================================================
CREATE OR REPLACE FUNCTION public.student_checkout(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_duration INTEGER;
BEGIN
  UPDATE public.session_checkins SET
    checked_out_at = NOW(),
    duration_minutes = EXTRACT(EPOCH FROM (NOW() - checked_in_at)) / 60,
    status = CASE 
      WHEN duration_minutes < 30 THEN 'left_early'
      ELSE status
    END
  WHERE session_id = p_session_id AND student_id = v_student_id
  RETURNING duration_minutes INTO v_duration;
  
  RETURN jsonb_build_object('success', true, 'duration_minutes', v_duration);
END;
$$;

GRANT EXECUTE ON FUNCTION public.student_checkout(UUID) TO authenticated;

-- ============================================================
-- 11. دالة: المعلم يبدأ الجلسة رسمياً
-- ============================================================
CREATE OR REPLACE FUNCTION public.teacher_start_session(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.live_sessions WHERE id = p_session_id AND teacher_id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  
  UPDATE public.live_sessions SET
    status = 'live', started_at = NOW()
  WHERE id = p_session_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.teacher_start_session(UUID) TO authenticated;

-- ============================================================
-- 12. دالة: المعلم ينهي الجلسة + ينقل الغياب تلقائياً
-- ============================================================
CREATE OR REPLACE FUNCTION public.teacher_end_session(p_session_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session RECORD;
  v_absent_count INTEGER := 0;
  v_student RECORD;
BEGIN
  SELECT * INTO v_session FROM public.live_sessions WHERE id = p_session_id AND teacher_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  
  -- تسجيل غياب من لم يسجل حضوره
  FOR v_student IN
    SELECT s.id
    FROM public.students s
    WHERE s.section_id = v_session.section_id
      AND NOT EXISTS (
        SELECT 1 FROM public.session_checkins sc
        WHERE sc.session_id = p_session_id AND sc.student_id = s.id
      )
  LOOP
    -- تسجيل غائب في جدول الحضور
    INSERT INTO public.attendance (
      student_id, section_id, subject_id, teacher_id, date, period, status
    ) VALUES (
      v_student.id, v_session.section_id, v_session.subject_id, v_session.teacher_id,
      v_session.session_date, v_session.period, 'absent'
    ) ON CONFLICT (student_id, subject_id, date, period) DO NOTHING;
    
    v_absent_count := v_absent_count + 1;
  END LOOP;
  
  -- إنهاء الجلسة
  UPDATE public.live_sessions SET
    status = 'ended', ended_at = NOW(), session_notes = p_notes,
    checked_in_count = (SELECT COUNT(*) FROM public.session_checkins WHERE session_id = p_session_id)
  WHERE id = p_session_id;
  
  -- تحديث سجل التتبع
  UPDATE public.attendance_tracking SET
    is_recorded = TRUE, recorded_at = NOW()
  WHERE teacher_id = v_session.teacher_id
    AND section_id = v_session.section_id
    AND subject_id = v_session.subject_id
    AND tracking_date = v_session.session_date
    AND period = v_session.period;
  
  RETURN jsonb_build_object(
    'success', true,
    'present', v_session.checked_in_count,
    'absent', v_absent_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.teacher_end_session(UUID, TEXT) TO authenticated;

-- ============================================================
-- 13. View: الحصص المباشرة الحالية للمدير
-- ============================================================
CREATE OR REPLACE VIEW public.live_sessions_overview AS
SELECT
  ls.*,
  u.full_name AS teacher_name,
  sub.name AS subject_name,
  sec.name AS section_name,
  cl.name AS class_name,
  sch.start_time,
  sch.end_time,
  ROUND(ls.checked_in_count::NUMERIC / NULLIF(ls.expected_students, 0) * 100, 1) AS attendance_pct
FROM public.live_sessions ls
JOIN public.users u ON u.id = ls.teacher_id
JOIN public.subjects sub ON sub.id = ls.subject_id
JOIN public.sections sec ON sec.id = ls.section_id
JOIN public.classes cl ON cl.id = sec.class_id
LEFT JOIN public.schedules sch ON sch.id = ls.schedule_id;

-- ============================================================
-- 14. Index للأداء
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_live_sessions_date ON public.live_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON public.live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_checkins_session ON public.session_checkins(session_id);
CREATE INDEX IF NOT EXISTS idx_checkins_student ON public.session_checkins(student_id);
CREATE INDEX IF NOT EXISTS idx_recordings_session ON public.session_recordings(session_id);
