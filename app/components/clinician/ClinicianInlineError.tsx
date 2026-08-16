type ClinicianInlineErrorProps = {
  message: string;
  className?: string;
};

export function ClinicianInlineError({ message, className = "" }: ClinicianInlineErrorProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`rounded-[10px] border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-4 py-3 text-xs text-[var(--danger)] ${className}`.trim()}
    >
      {message}
    </div>
  );
}
