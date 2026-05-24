type Props = {
  generatedAt?: string;
  className?: string;
};

function formatGeneratedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function AILabel({ generatedAt, className = "" }: Props) {
  return (
    <p
      className={`text-[10px] italic text-[#9CA3AF] print:text-gray-500 ${className}`.trim()}
    >
      AI-assisted translation · Clinician review required before clinical use
      {generatedAt ? (
        <span className="print:hidden">{` · ${formatGeneratedAt(generatedAt)}`}</span>
      ) : null}
    </p>
  );
}
