import Link from "next/link";

export default function PatientPage() {
  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-20 text-white">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-10 fade-in">
          <p className="mb-3 inline-block rounded-full bg-cyan-400/10 px-4 py-1 text-sm text-cyan-300">
            Patient Portal
          </p>
          <h1 className="text-4xl font-bold text-cyan-300">
            Welcome Back
          </h1>
          <p className="mt-2 max-w-2xl text-slate-300 leading-7">
            Manage your rehabilitation journey, appointments, progress, results,
            and treatment plan in one place.
          </p>
        </div>

        {/* Top Summary Cards */}
        <div className="mb-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm fade-in">
            <h2 className="mb-2 text-lg font-semibold text-cyan-300">
              Appointments
            </h2>
            <p className="text-sm leading-7 text-slate-300">
              Your next appointment is scheduled for Monday at 5:00 PM.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm fade-in">
            <h2 className="mb-2 text-lg font-semibold text-cyan-300">
              Progress
            </h2>
            <p className="text-sm leading-7 text-slate-300">
              You have completed 68% of your current rehabilitation pathway.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm fade-in">
            <h2 className="mb-2 text-lg font-semibold text-cyan-300">
              Results
            </h2>
            <p className="text-sm leading-7 text-slate-300">
              Your latest assessment shows improvement in posture and control.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm fade-in">
            <h2 className="mb-2 text-lg font-semibold text-cyan-300">
              My Plan
            </h2>
            <p className="text-sm leading-7 text-slate-300">
              Continue your guided recovery plan with therapy sessions and home exercises.
            </p>
          </div>
        </div>

        {/* Main Dashboard Sections */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Appointments */}
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md fade-in">
            <h2 className="mb-4 text-2xl font-bold text-cyan-300">
              Appointments
            </h2>
            <p className="mb-4 text-slate-300 leading-7">
              View your upcoming sessions, appointment times, and session details.
            </p>
            <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4">
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-white">Next Session:</span>{" "}
                Monday, 5:00 PM with your clinician
              </p>
            </div>
          </section>

          {/* Progress */}
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md fade-in">
            <h2 className="mb-4 text-2xl font-bold text-cyan-300">
              Progress
            </h2>
            <p className="mb-4 text-slate-300 leading-7">
              Track your progress across sessions, exercises, and adherence over time.
            </p>
            <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4">
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-white">Overall Progress:</span>{" "}
                68% completed
              </p>
            </div>
          </section>

          {/* Results */}
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md fade-in">
            <h2 className="mb-4 text-2xl font-bold text-cyan-300">
              Results
            </h2>
            <p className="mb-4 text-slate-300 leading-7">
              Review your latest assessments, reports, and measurable outcomes.
            </p>
            <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4">
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-white">Latest Result:</span>{" "}
                Improved posture alignment and better movement control
              </p>
            </div>
          </section>

          {/* Plan */}
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md fade-in">
            <h2 className="mb-4 text-2xl font-bold text-cyan-300">
              My Plan
            </h2>
            <p className="mb-4 text-slate-300 leading-7">
              Access your rehabilitation plan, assigned sessions, and next treatment steps.
            </p>
            <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4">
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-white">Current Plan:</span>{" "}
                Shoulder rehabilitation pathway with guided XR exercises
              </p>
            </div>
          </section>
        </div>

        {/* Tools & Access */}
        <section className="mt-12 fade-in">
          <h2 className="mb-6 text-2xl font-bold text-cyan-300">
            Tools & Access
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            <Link
              href="/body-axis-ai"
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:scale-105 hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)]"
            >
              <h3 className="mb-3 text-xl font-semibold text-cyan-300">
                Body Axis AI
              </h3>
              <p className="text-slate-300 leading-7">
                Start or review your movement assessment and posture analysis.
              </p>
            </Link>

            <Link
              href="/library"
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:scale-105 hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)]"
            >
              <h3 className="mb-3 text-xl font-semibold text-cyan-300">
                XR Therapy Library
              </h3>
              <p className="text-slate-300 leading-7">
                Access your therapy programs and guided rehabilitation exercises.
              </p>
            </Link>

            <Link
              href="/sessions"
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:scale-105 hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)]"
            >
              <h3 className="mb-3 text-xl font-semibold text-cyan-300">
                Online Sessions
              </h3>
              <p className="text-slate-300 leading-7">
                View session links, schedules, and upcoming digital appointments.
              </p>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}