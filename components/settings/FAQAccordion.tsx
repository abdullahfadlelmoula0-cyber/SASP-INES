// Save as: components/settings/FAQAccordion.tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "How do I see the courses assigned to me?",
    answer:
      "Open \"My Courses\" from the sidebar or bottom navigation. You'll automatically see only the courses that match your department, academic plan, and year of study — no manual filtering needed.",
  },
  {
    question: "I can't find a document or past exam for my course.",
    answer:
      "Open the course from \"My Courses\", then check the Documents and Exams tabs. If nothing is uploaded yet, your instructor or department admin hasn't added it — reach out to them, or use Contact Administrator below.",
  },
  {
    question: "My department, program, or year of study is wrong.",
    answer:
      "Students cannot edit these fields directly — they're set by an administrator to keep course visibility accurate. Contact your department admin or a general administrator to have it corrected.",
  },
  {
    question: "How do announcements targeting work?",
    answer:
      "Some announcements are posted for all students, and some are targeted to a specific department's academic plan. You'll only ever see announcements meant for everyone or specifically for your own plan.",
  },
  {
    question: "How do I change my password?",
    answer:
      "Go to Settings → Account → Password & Security to update your password.",
  },
];

export function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i} className="rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
            >
              <span className="text-sm font-semibold text-foreground">{item.question}</span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
              />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed animate-accordion-down">
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
