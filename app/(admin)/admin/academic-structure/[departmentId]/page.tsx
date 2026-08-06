// Save as: app/admin/academic-structure/[departmentId]/page.tsx
// (adjust the route group / folder name to match how your other /admin
// pages are nested, e.g. app/(admin)/admin/academic-structure/[departmentId]/page.tsx)

import { requireAdminOrDepartmentAdmin } from "@/lib/auth/requireAdminOrDepartmentAdmin";
import { redirect } from "next/navigation";
import { AdminDepartmentDetailClient } from "@/components/academic-structure/AdminDepartmentDetailClient";

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const profile = await requireAdminOrDepartmentAdmin();
  const { departmentId } = await params;

  // Department admins can only access their own department
  if (profile.role === "department_admin" && profile.managed_department_id !== departmentId) {
    redirect(`/admin/academic-structure/${profile.managed_department_id}`);
  }

  return <AdminDepartmentDetailClient departmentId={departmentId} />;
}
