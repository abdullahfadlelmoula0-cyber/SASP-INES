// Save as: app/(dashboard)/documents/page.tsx
// This standalone page is retired — documents now live inside each
// course's detail page (Documents/Exams tabs). Redirect any old links.
import { redirect } from "next/navigation";

export default function DocumentsPageRedirect() {
  redirect("/courses");
}
