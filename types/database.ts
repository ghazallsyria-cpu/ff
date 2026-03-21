export type UserRole = 'admin' | 'management' | 'teacher' | 'student' | 'parent'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type ExamStatus = 'draft' | 'published' | 'archived'
export type AttemptStatus = 'ongoing' | 'completed' | 'graded'
export type QuestionType = 'multiple_choice' | 'true_false' | 'essay' | 'fill_in_blank'
export type AnnouncementTarget = 'all' | 'admin' | 'management' | 'teacher' | 'student' | 'parent'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  phone?: string
  avatar_url?: string
  must_reset_password: boolean
  created_at: string
  updated_at: string
}

export interface Class {
  id: string
  name: string
  level: number
  academic_year_id?: string
  created_at: string
  updated_at: string
}

export interface Section {
  id: string
  class_id: string
  name: string
  capacity: number
  homeroom_teacher_id?: string
  created_at: string
  updated_at: string
  classes?: Class
}

export interface Subject {
  id: string
  name: string
  code?: string
  created_at: string
  updated_at: string
}

export interface Teacher {
  id: string
  national_id: string
  specialization?: string
  hire_date: string
  zoom_link?: string
  created_at: string
  updated_at: string
  users?: User
}

export interface Student {
  id: string
  national_id: string
  parent_id?: string
  section_id?: string
  date_of_birth?: string
  gender?: 'male' | 'female'
  address?: string
  enrollment_date: string
  created_at: string
  updated_at: string
  users?: User
  sections?: Section
  parents?: Parent
}

export interface Parent {
  id: string
  national_id?: string
  address?: string
  job_title?: string
  created_at: string
  updated_at: string
  users?: User
}

export interface TeacherSection {
  id: string
  teacher_id: string
  section_id: string
  subject_id: string
  teachers?: Teacher
  sections?: Section
  subjects?: Subject
}

export interface Attendance {
  id: string
  student_id: string
  section_id: string
  subject_id: string
  date: string
  period: number
  status: AttendanceStatus
  notes?: string
  recorded_by?: string
  created_at: string
  updated_at: string
  students?: Student
  subjects?: Subject
}

export interface Exam {
  id: string
  teacher_id: string
  subject_id: string
  section_id?: string
  title: string
  description?: string
  duration?: number
  max_attempts: number
  pass_score: number
  start_at?: string
  end_at?: string
  settings: {
    shuffle_questions: boolean
    shuffle_options: boolean
    show_result_immediately: boolean
    allow_backtracking: boolean
  }
  status: ExamStatus
  created_at: string
  updated_at: string
  subjects?: Subject
  sections?: Section
  teachers?: Teacher
}

export interface Question {
  id: string
  exam_id: string
  type: QuestionType
  content: string
  media_url?: string
  points: number
  order_index: number
  explanation?: string
  created_at: string
  question_options?: QuestionOption[]
}

export interface QuestionOption {
  id: string
  question_id: string
  content: string
  is_correct: boolean
  order_index: number
}

export interface ExamAttempt {
  id: string
  exam_id: string
  student_id: string
  started_at: string
  completed_at?: string
  score: number
  status: AttemptStatus
  feedback?: string
  exams?: Exam
}

export interface StudentAnswer {
  id: string
  attempt_id: string
  question_id: string
  selected_option_id?: string
  text_answer?: string
  is_correct?: boolean
  points_earned: number
  created_at: string
}

export interface Grade {
  id: string
  exam_id: string
  student_id: string
  score: number
  notes?: string
  created_at: string
  updated_at: string
  exams?: Exam
  students?: Student
}

export interface Assignment {
  id: string
  title: string
  description?: string
  subject_id: string
  section_id: string
  teacher_id: string
  due_date: string
  file_url?: string
  created_at: string
  updated_at: string
  subjects?: Subject
  sections?: Section
  teachers?: Teacher
}

export interface AssignmentSubmission {
  id: string
  assignment_id: string
  student_id: string
  content?: string
  file_url?: string
  status: 'submitted' | 'graded'
  grade?: number
  feedback?: string
  submitted_at: string
  assignments?: Assignment
  students?: Student
}

export interface Schedule {
  id: string
  section_id: string
  subject_id: string
  teacher_id: string
  day_of_week: number
  period: number
  start_time?: string
  end_time?: string
  created_at: string
  updated_at: string
  subjects?: Subject
  teachers?: Teacher
  sections?: Section
}

export interface Announcement {
  id: string
  title: string
  content: string
  author_id?: string
  target_role?: AnnouncementTarget
  created_at: string
  updated_at: string
  users?: User
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  subject?: string
  content: string
  is_read: boolean
  created_at: string
  sender?: User
  receiver?: User
}

export interface AcademicYear {
  id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  created_at: string
}

// Extended types for dashboard data
export interface StudentWithDetails extends Student {
  users: User
  sections: Section & { classes: Class }
}

export interface DashboardStats {
  total_students: number
  total_teachers: number
  total_classes: number
  total_sections: number
  attendance_today: number
  active_exams: number
}
