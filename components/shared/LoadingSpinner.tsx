interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizeClasses = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-2",
  lg: "w-12 h-12 border-[3px]",
};

/**
 * Generic loading spinner used during data fetching states.
 */
export function LoadingSpinner({
  size = "md",
  label = "Loading…",
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex flex-col items-center justify-center gap-3 py-12"
    >
      <span
        className={`rounded-full border-primary border-t-transparent animate-spin ${sizeClasses[size]}`}
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
