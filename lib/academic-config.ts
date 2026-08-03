export interface ProgramConfig {
  name: string;
  maxYears: number;
}

export interface DepartmentConfig {
  name: string;
  programs: ProgramConfig[];
}

export const DEPARTMENTS: DepartmentConfig[] = [
  {
    name: "Computer Science",
    programs: [
      { name: "Software Engineering", maxYears: 4 },
      { name: "Information Systems", maxYears: 4 },
      { name: "Computer Networks", maxYears: 3 },
      { name: "Data Science", maxYears: 4 },
    ],
  },
  {
    name: "Business Administration",
    programs: [
      { name: "Management", maxYears: 4 },
      { name: "Finance and Banking", maxYears: 4 },
      { name: "Marketing", maxYears: 3 },
      { name: "Accounting", maxYears: 4 },
    ],
  },
  {
    name: "Economics",
    programs: [
      { name: "Applied Economics", maxYears: 4 },
      { name: "Development Economics", maxYears: 3 },
    ],
  },
  {
    name: "Education",
    programs: [
      { name: "Education Sciences", maxYears: 4 },
      { name: "Mathematics Education", maxYears: 4 },
    ],
  },
  {
    name: "Law",
    programs: [
      { name: "Law", maxYears: 4 },
    ],
  },
  {
    name: "Social Sciences",
    programs: [
      { name: "Sociology", maxYears: 3 },
      { name: "Political Science", maxYears: 4 },
    ],
  },
];

export function getDepartmentNames(): string[] {
  return DEPARTMENTS.map((d) => d.name);
}

export function getProgramsForDepartment(department: string | null): string[] {
  if (!department) return [];
  const dept = DEPARTMENTS.find((d) => d.name === department);
  return dept ? dept.programs.map((p) => p.name) : [];
}

export function getMaxYearsForProgram(
  department: string | null,
  program: string | null
): number {
  if (!department || !program) return 1;
  const dept = DEPARTMENTS.find((d) => d.name === department);
  const prog = dept?.programs.find((p) => p.name === program);
  return prog?.maxYears ?? 1;
}

export function getYearsForProgram(
  department: string | null,
  program: string | null
): number[] {
  const max = getMaxYearsForProgram(department, program);
  return Array.from({ length: max }, (_, i) => i + 1);
}

export function generateAcademicYears(count: number = 6): string[] {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const years: string[] = [];
  for (let i = Math.floor(count / 2); i >= -(Math.ceil(count / 2) - 1); i--) {
    const y1 = currentYear - i;
    const y2 = (y1 + 1).toString().slice(-2);
    years.push(`${y1}/${y2}`);
  }
  return years;
}

export const ACADEMIC_YEARS = generateAcademicYears(7);
