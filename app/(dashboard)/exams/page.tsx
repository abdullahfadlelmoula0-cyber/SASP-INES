// Save as: app/(dashboard)/exams/page.tsx
// This standalone page is retired — previous exams now live inside each
// course's detail page (Documents/Exams tabs). Redirect any old links.
import { redirect } from "next/navigation";

export default function ExamsPageRedirect() {
  redirect("/courses");
}
