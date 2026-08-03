import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function AdminNotFound() {
  return (
    <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-muted p-4">
        <FileQuestion className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Page Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The admin page you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
      <Button asChild variant="default" className="mt-2">
        <Link href="/admin">Return to Dashboard</Link>
      </Button>
    </div>
  );
}
