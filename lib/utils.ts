import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes safely, resolving conflicts.
 * Used by all shadcn/ui components.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date string into a human-readable format.
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "N/A";
  
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsedDate);
}

/**
 * Returns the user's initials from their full name.
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Formats a date as relative time from now (e.g., "2 hours ago", "in 3 days")
 */
export function formatDistanceToNow(date: string | Date | null | undefined): string {
  if (!date) return "unknown";
  
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return "unknown";
  
  const now = new Date();
  const diffMs = parsedDate.getTime() - now.getTime();
  const diffSec = Math.floor(Math.abs(diffMs) / 1000);
  const isPast = diffMs < 0;
  
  const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "week", seconds: 604800 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
    { label: "second", seconds: 1 },
  ];
  
  for (const interval of intervals) {
    const count = Math.floor(diffSec / interval.seconds);
    if (count >= 1) {
      const suffix = count === 1 ? "" : "s";
      return isPast 
        ? `${count} ${interval.label}${suffix} ago`
        : `in ${count} ${interval.label}${suffix}`;
    }
  }
  
  return "just now";
}
