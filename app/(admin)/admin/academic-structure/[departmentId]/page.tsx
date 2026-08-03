// Save as: app/admin/academic-structure/[departmentId]/page.tsx
// (adjust the route group / folder name to match your other /admin
// pages, e.g. app/(admin)/admin/academic-structure/[departmentId]/page.tsx)

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { AdminDepartmentDetailClient } from "@/components/academic-structure/AdminDepartmentDetailClient";

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  await requireAdmin();
  const { departmentId } = await params;
  return <AdminDepartmentDetailClient departmentId={departmentId} />;
}
