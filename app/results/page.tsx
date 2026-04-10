import Link from "next/link";

type ResultsPageProps = {
  searchParams: Promise<{
    patientId?: string;
    patientName?: string;
    test?: string;
    score?: string;
    status?: string;
    assessmentId?: string;
  }>;
};

function getTestLabel(test?: string) {
  switch (test) {
    case "balance":
      return "Balance Test";
    case "squat":
      return "Squat Analysis";
    case "gait":
      return "Gait Screening";
    case "posture":
      return "Posture Analysis";
    default:
      return "Assessment Result";
  }
}

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const params = await searchParams;

  const patientId = params.patientId || "PT-1001";
  const patientName = params.patientName || "Sara Ali";
  const test = params.test || "posture";
  const score = params.score || "82";
  const status = params.status || "Completed";
  const assessmentId = params.assessmentId || "AX-1001";

  const testLabel = getTestLabel(test);

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-20 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="mb-3 inline-block rounded-full bg-cyan-400/10 px-4 py-1 text-sm text-cyan-300">
            Assessment Results
          </p>
          <h1 className="text-4xl font-bold text-cyan-300">{testLabel}</h1>
          <p className="mt-2 max-w-3xl leading-7 text-slate-300">
            Review the latest assessment summary and continue the rehabilitation
            workflow from clinician review to patient follow-up.
          </p>
        </div>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Patient Name" value={patientName} />
            <MetricCard label="Patient ID" value={patientId} />
            <MetricCard label="Assessment ID" value={assessmentId} />
            <MetricCard label="Status" value={status} />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md lg:col-span-2">
            <h2 className="mb-5 text-2xl font-semibold text-white">
              Result Summary
            </h2>

            <div className="mb-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">
              <p className="text-sm text-cyan-200">Overall Performance Score</p>
              <h3 className="mt-2 text-5xl font-bold text-cyan-300">{score}%</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                The patient completed the assessment with acceptable movement
                quality. Mild compensatory behavior may still need follow-up in
                the next session.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <MiniResultCard title="Movement Quality" value="Good" />
              <MiniResultCard title="Alignment Control" value="Moderate" />
              <MiniResultCard title="Compensation Risk" value="Low" />
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-[#0F172A] p-5">
              <h3 className="text-lg font-semibold text-white">
                Clinical Interpretation
              </h3>
              <p className="mt-3 leading-7 text-slate-300">
                This result suggests that the patient is progressing, but still
                requires continued monitoring for posture control, symmetry, and
                movement consistency during functional tasks.
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <h2 className="mb-5 text-2xl font-semibold text-white">
              Next Actions
            </h2>

            <div className="space-y-3">
              <Link
                href={`/clinician/patients/${patientId}?name=${encodeURIComponent(
                  patientName
                )}&latestScore=${encodeURIComponent(
                  score
                )}&latestTest=${encodeURIComponent(test)}`}
                className="block rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-center font-semibold text-black transition hover:scale-[1.02]"
              >
                Back to Patient Profile
              </Link>

              <Link
                href={`/body-axis-ai?patientId=${patientId}&patientName=${encodeURIComponent(
                  patientName
                )}&test=${test}&assessmentId=${assessmentId}`}
                className="block rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
              >
                Repeat Assessment
              </Link>

              <Link
                href="/sessions"
                className="block rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
              >
                Create Rehab Session
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function MiniResultCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 font-semibold text-cyan-300">{value}</p>
    </div>
  );
}