import Link from "next/link";

type TherapyCard = {
  title: string;
  description: string;
  duration: string;
  level: string;
  tag: string;
};

type TherapyCategory = {
  id: string;
  title: string;
  icon: string;
  colorClass: string;
  sessions: TherapyCard[];
};

const therapyLibrary: TherapyCategory[] = [
  {
    id: "orthopedic",
    title: "Orthopedic Rehabilitation",
    icon: "🦴",
    colorClass: "bg-sky-100 text-sky-800",
    sessions: [
      {
        title: "Knee Joint Mobility",
        description:
          "Progressive exercises to restore range of motion after knee surgery or injury.",
        duration: "30 min",
        level: "Beginner",
        tag: "VR Session",
      },
      {
        title: "Shoulder Recovery",
        description:
          "Guided shoulder rehabilitation exercises for post-operative recovery.",
        duration: "25 min",
        level: "Intermediate",
        tag: "VR Session",
      },
      {
        title: "Hip Replacement Rehab",
        description:
          "Structured program for hip replacement recovery with progressive loading.",
        duration: "35 min",
        level: "Beginner",
        tag: "Guided",
      },
    ],
  },
  {
    id: "neurological",
    title: "Neurological Rehabilitation",
    icon: "🧠",
    colorClass: "bg-indigo-100 text-indigo-800",
    sessions: [
      {
        title: "Stroke Recovery - Upper Limb",
        description:
          "Immersive exercises targeting upper limb function recovery after stroke.",
        duration: "20 min",
        level: "Adaptive",
        tag: "VR Session",
      },
      {
        title: "Balance & Coordination",
        description:
          "AI-guided balance training for neurological conditions with real-time feedback.",
        duration: "25 min",
        level: "Intermediate",
        tag: "AI-Assisted",
      },
      {
        title: "Cognitive Motor Training",
        description:
          "Combined cognitive and motor tasks to improve coordination and dual-task performance.",
        duration: "30 min",
        level: "Beginner",
        tag: "Guided",
      },
    ],
  },
  {
    id: "sports",
    title: "Sports Rehabilitation",
    icon: "🏃",
    colorClass: "bg-emerald-100 text-emerald-800",
    sessions: [
      {
        title: "ACL Recovery Program",
        description:
          "Phase-based ACL rehabilitation with sport-specific movement patterns.",
        duration: "40 min",
        level: "Advanced",
        tag: "VR Session",
      },
      {
        title: "Ankle Stability Training",
        description:
          "Dynamic ankle rehabilitation with proprioceptive and control challenges.",
        duration: "25 min",
        level: "Intermediate",
        tag: "AI-Assisted",
      },
      {
        title: "Return to Sport Assessment",
        description:
          "Comprehensive movement assessment to evaluate readiness for sport return.",
        duration: "45 min",
        level: "Advanced",
        tag: "VR Session",
      },
    ],
  },
  {
    id: "cognitive",
    title: "Cognitive Training",
    icon: "🎯",
    colorClass: "bg-violet-100 text-violet-800",
    sessions: [
      {
        title: "Attention Training",
        description:
          "Interactive XR tasks designed to improve focus, tracking, and sustained attention.",
        duration: "15 min",
        level: "Beginner",
        tag: "Guided",
      },
      {
        title: "Reaction & Coordination",
        description:
          "Fast-response visual and movement tasks to enhance timing and motor planning.",
        duration: "20 min",
        level: "Intermediate",
        tag: "AI-Assisted",
      },
      {
        title: "Dual Task Challenge",
        description:
          "Cognitive-motor activities combining physical movement with mental processing.",
        duration: "25 min",
        level: "Intermediate",
        tag: "VR Session",
      },
    ],
  },
  {
    id: "wellness",
    title: "Mental Wellness",
    icon: "🍃",
    colorClass: "bg-amber-100 text-amber-800",
    sessions: [
      {
        title: "Mindful Movement",
        description:
          "Guided relaxation and gentle movement in calming virtual environments.",
        duration: "20 min",
        level: "Beginner",
        tag: "VR Session",
      },
      {
        title: "Pain Management Meditation",
        description:
          "Immersive meditation sessions designed to help manage chronic pain.",
        duration: "15 min",
        level: "Beginner",
        tag: "Guided",
      },
      {
        title: "Stress Relief Therapy",
        description:
          "Virtual nature environments combined with breathing exercises for stress relief.",
        duration: "20 min",
        level: "Beginner",
        tag: "VR Session",
      },
    ],
  },
];

export default function LibraryPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="bg-gradient-to-r from-sky-950 via-sky-900 to-teal-800 text-white">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-xl font-bold tracking-tight text-white hover:opacity-90"
            >
              Creative <span className="text-lime-300">Motion</span>
            </Link>

            <nav className="hidden gap-6 text-sm text-sky-100 md:flex">
              <Link href="/" className="hover:text-white">
                Home
              </Link>
              <Link href="/library" className="font-semibold text-white">
                Library
              </Link>
              <Link href="/login" className="hover:text-white">
                Clinician Login
              </Link>
            </nav>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-16 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-sky-200">
            XR Therapy Library
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Therapy Sessions Library
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base text-sky-100 md:text-xl">
            Explore our structured collection of XR rehabilitation programs,
            guided protocols, and therapeutic sessions for orthopedic,
            neurological, sports, cognitive, and wellness care.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10 grid gap-6 md:grid-cols-3">
          <FeatureCard
            title="Clinical Structure"
            description="Condition-specific rehabilitation categories organized for clear clinical navigation."
          />
          <FeatureCard
            title="Progressive Protocols"
            description="Programs designed with duration, level, and session type to support progression."
          />
          <FeatureCard
            title="Scalable XR Content"
            description="A library built to grow into a full clinical protocol and therapy session system."
          />
        </div>

        <div className="space-y-14">
          {therapyLibrary.map((category) => (
            <section key={category.id}>
              <div className="mb-6 flex items-center gap-4">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${category.colorClass}`}
                >
                  {category.icon}
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">
                    {category.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Structured XR rehabilitation content for this category.
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {category.sessions.map((session) => (
                  <SessionCard key={session.title} session={session} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function SessionCard({ session }: { session: TherapyCard }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <span className="inline-flex rounded-full bg-lime-100 px-3 py-1 text-xs font-semibold text-lime-800">
        {session.tag}
      </span>

      <h3 className="mt-4 text-2xl font-bold text-slate-900">{session.title}</h3>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {session.description}
      </p>

      <div className="mt-5 flex items-center gap-4 text-sm text-slate-500">
        <span>🕒 {session.duration}</span>
        <span>📈 {session.level}</span>
      </div>
    </article>
  );
}