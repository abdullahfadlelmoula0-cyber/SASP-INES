// Save as: types/academic-structure.ts

export interface Department {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface AcademicPlan {
  id: string;
  department_id: string;
  name: string;
  shared_years: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Specialization {
  id: string;
  academic_plan_id: string;
  name: string;
  total_duration_years: number;
  created_at: string;
  updated_at: string;
}

export interface DepartmentWithPlans extends Department {
  academic_plans: AcademicPlan[];
}

export interface AcademicPlanWithSpecializations extends AcademicPlan {
  specializations: Specialization[];
}

export interface DepartmentDetail {
  department: Department;
  plans: AcademicPlanWithSpecializations[];
}
