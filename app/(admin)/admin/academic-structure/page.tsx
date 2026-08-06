// Save as: app/admin/academic-structure/page.tsx
// (adjust the route group / folder name to match how your other
// /admin pages are nested, e.g. app/(admin)/admin/academic-structure/page.tsx)

import { requireAdminOrDepartmentAdmin } from "@/lib/auth/requireAdminOrDepartmentAdmin";
import { redirect } from "next/navigation";
import { AdminAcademicStructureClient } from "@/components/academic-structure/AdminAcademicStructureClient";

export default async function AcademicStructurePage() {
  const profile = await requireAdminOrDepartmentAdmin();

  // department_admin accounts manage exactly one department — send them
  // straight there instead of the full cross-department index (which
  // stays browsable, but only admin should land on it by default).
  if (profile.role === "department_admin" && profile.managed_department_id) {
    redirect(`/admin/academic-structure/${profile.managed_department_id}`);
  }

  return <AdminAcademicStructureClient />;
}
