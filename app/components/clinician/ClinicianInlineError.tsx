type ClinicianInlineErrorProps = {
  message: string;
  className?: string;
};

export function ClinicianInlineError({ message, className = "" }: ClinicianInlineErrorProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`rounded-[7px] border border-rose-400/20 bg-rose-400/6 px-4 py-3 text-xs text-rose-300 ${className}`.trim()}
    >
      {message}
    </div>
  );
}
