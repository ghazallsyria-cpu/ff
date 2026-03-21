-- ============================================================
-- Migration 002: الدوال والـ Triggers
-- ============================================================

-- دالة تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ✅ دالة get_user_role() الآمنة (بدون SET ROLE postgres)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT role::text FROM public.users WHERE id = auth.uid(); $$;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon;

-- دالة للتحقق من صلاحية المعلم على شعبة معينة
CREATE OR REPLACE FUNCTION public.teacher_has_section(p_section_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_sections
    WHERE teacher_id = auth.uid() AND section_id = p_section_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.teacher_has_section(UUID) TO authenticated;

-- دالة لجلب section_id الطالب الحالي
CREATE OR REPLACE FUNCTION public.get_student_section()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT section_id FROM public.students WHERE id = auth.uid(); $$;

GRANT EXECUTE ON FUNCTION public.get_student_section() TO authenticated;

-- مزامنة مستخدم جديد من auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, must_reset_password)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'::user_role),
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة التصحيح التلقائي للاختبارات
CREATE OR REPLACE FUNCTION public.auto_grade_attempt(p_attempt_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_score NUMERIC := 0;
  v_exam_id UUID;
  v_max_score NUMERIC;
  v_percentage NUMERIC;
BEGIN
  SELECT exam_id INTO v_exam_id FROM public.exam_attempts WHERE id = p_attempt_id;

  -- تحديث is_correct و points_earned لكل إجابة
  UPDATE public.student_answers sa
  SET
    is_correct = (
      SELECT COALESCE(qo.is_correct, FALSE)
      FROM public.question_options qo
      WHERE qo.id = sa.selected_option_id
    ),
    points_earned = CASE
      WHEN (SELECT qo.is_correct FROM public.question_options qo WHERE qo.id = sa.selected_option_id) = TRUE
      THEN (SELECT q.points FROM public.questions q WHERE q.id = sa.question_id)
      ELSE 0
    END
  WHERE sa.attempt_id = p_attempt_id;

  -- حساب المجموع
  SELECT COALESCE(SUM(points_earned), 0) INTO v_total_score
  FROM public.student_answers WHERE attempt_id = p_attempt_id;

  SELECT COALESCE(SUM(points), 0) INTO v_max_score
  FROM public.questions WHERE exam_id = v_exam_id;

  v_percentage := CASE WHEN v_max_score > 0 THEN (v_total_score / v_max_score) * 100 ELSE 0 END;

  -- تحديث المحاولة
  UPDATE public.exam_attempts
  SET score = v_percentage, status = 'completed', completed_at = NOW()
  WHERE id = p_attempt_id;

  -- إدراج في جدول grades
  INSERT INTO public.grades (exam_id, student_id, score)
  SELECT v_exam_id, student_id, v_percentage
  FROM public.exam_attempts WHERE id = p_attempt_id
  ON CONFLICT (exam_id, student_id) DO UPDATE SET score = EXCLUDED.score, updated_at = NOW();

  RETURN v_percentage;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_grade_attempt(UUID) TO authenticated;

-- ============ Triggers ============

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers updated_at
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','classes','sections','subjects','parents','students',
    'teachers','attendance','exams','grades','assignments','schedules','announcements'] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%s_modtime ON public.%s;
      CREATE TRIGGER update_%s_modtime
        BEFORE UPDATE ON public.%s
        FOR EACH ROW EXECUTE FUNCTION update_modified_column();
    ', t, t, t, t);
  END LOOP;
END $$;
