// Save as: app/admin/academic-structure/page.tsx
// (adjust the route group / folder name to match how your other
// /admin pages are nested, e.g. app/(admin)/admin/academic-structure/page.tsx)

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { AdminAcademicStructureClient } from "@/components/academic-structure/AdminAcademicStructureClient";

export default async function AcademicStructurePage() {
  await requireAdmin();
  return <AdminAcademicStructureClient />;
}
