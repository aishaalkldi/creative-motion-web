"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useGlobalLanguage } from "@/app/components/GlobalLanguageProvider";
import type { ClinicianResultsResponse } from "@/app/api/clinician/results/route";
import { ClinicianMetricCard } from "@/app/components/clinician/ClinicianMetricCard";
import { getDashboardStats, type DashboardStats } from "@/app/lib/api";
import {
  fetchClinicianResults,
  fetchPatientsList,
} from "@/app/lib/api/demo-fallback-client";
import {
  formatDashboardAdherencePct,
  formatDashboardMetric,
  formatDashboardStatsTime,
} from "@/app/lib/clinician/dashboard-format";
import {
  buildPilotAttentionQueue,
  type PilotAttentionItem,
  type PilotAttentionPriority,
} from "@/app/lib/clinician/pilot-attention-queue";
import type { PatientRow } from "@/app/lib/validate-patient-ownership";

// ── Small metric icons ──────────────────────────────────────────────────────────

function PatientsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2.5-7L14 19l2.5-7H21" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 4.5h13.5l-2 3.75 2 3.75H3" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5l3-3a3.53 3.53 0 115 5l-3 3M10.5 13.5l-3 3a3.53 3.53 0 11-5-5l3-3M8.5 15.5l7-7" />
    </svg>
  );
}

// ── Static data ────────────────────────────────────────────────────────────────

const WORKFLOW_STEPS_EN = [
  { title: "1. Add Patient",          description: "Create a patient file from the clinician portal.",           href: "/clinician/patients/new" },
  { title: "2. Open Patient Profile", description: "Review details, send a remote link, or start in clinic.",   href: "/clinician/patients" },
  { title: "3. Start Assessment",     description: "Patient completes remotely or you document in clinic.",      href: "/clinician/assessment/start" },
  { title: "4. Review Report",        description: "Open the assessment summary and clinician notes.",           href: "/clinician/results" },
  { title: "5. Assign Plan",          description: "Build and assign a structured rehabilitation plan.",         href: "/clinician/plans/new" },
  { title: "6. Patient Portal",       description: "Patient completes home sessions and reports effort/pain.",   href: "/clinician/patients" },
  { title: "7. Track Progress",       description: "Review adherence, flags, and the review queue.",             href: "/clinician/results" },
];

const WORKFLOW_STEPS_AR = [
  { title: "1. إضافة مريض", description: "أنشئ ملف المريض من بوابة الطبيب.", href: "/clinician/patients/new" },
  { title: "2. فتح ملف المريض", description: "راجع التفاصيل، أرسل رابطًا عن بُعد، أو ابدأ داخل العيادة.", href: "/clinician/patients" },
  { title: "3. بدء التقييم", description: "يكتمل التقييم عن بُعد أو تُوثقه أنت داخل العيادة.", href: "/clinician/assessment/start" },
  { title: "4. مراجعة التقرير", description: "افتح ملخص التقييم وملاحظات الطبيب.", href: "/clinician/results" },
  { title: "5. تعيين الخطة", description: "أنشئ خطة إعادة تأهيل منظمة وخصصها.", href: "/clinician/plans/new" },
  { title: "6. بوابة المريض", description: "يُكمل المريض جلساته المنزلية ويبلغ عن الجهد والألم.", href: "/clinician/patients" },
  { title: "7. متابعة التقدم", description: "راجع الالتزام والإشارات وقائمة المتابعة.", href: "/clinician/results" },
];

// ── Components ─────────────────────────────────────────────────────────────────

function priorityBadgeClass(priority: PilotAttentionPriority): string {
  if (priority === "high") {
    return "border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]";
  }
  if (priority === "medium") {
    return "border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)]";
  }
  return "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--muted)]";
}

function PilotAttentionQueueRow({ item, isArabic }: { item: PilotAttentionItem; isArabic: boolean }) {
  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 transition hover:border-[var(--brand)]/30"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-[var(--foreground)]">{item.patientName}</p>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityBadgeClass(item.priority)}`}
          >
            {item.priority}
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">{item.reason}</p>
      </div>
      <Link
        href={item.href}
        className="shrink-0 rounded-[8px] border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)] transition hover:border-[var(--brand)]/50"
      >
        {item.actionLabel}
      </Link>
    </div>
  );
}

export default function ClinicianDashboardPage() {
  const { language } = useGlobalLanguage();
  const isArabic = language === "ar";
  const workflowSteps = isArabic ? WORKFLOW_STEPS_AR : WORKFLOW_STEPS_EN;
  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [results, setResults] = useState<ClinicianResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getDashboardStats().catch(() => null),
      fetchPatientsList().catch(() => ({
        patients: [] as PatientRow[],
        demoMode: false,
        demoNotice: null,
      })),
      fetchClinicianResults().catch(() => null),
    ])
      .then(([statsData, patientsPayload, resultsData]) => {
        if (!isMounted) return;
        setStats(statsData);
        setPatients(patientsPayload.patients);
        setResults(resultsData);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const metricCards = [
    { title: isArabic ? "إجمالي المرضى" : "Total Patients", value: formatDashboardMetric(stats?.totalPatients, loading), subtitle: isArabic ? "سجلات المرضى المرتبطة" : "Connected patient records", attention: false, icon: <PatientsIcon /> },
    { title: isArabic ? "الحالات النشطة" : "Active Cases", value: formatDashboardMetric(stats?.activeCases, loading), subtitle: isArabic ? "مرضى لديهم خطط إعادة تأهيل نشطة" : "Patients with active rehabilitation plans", attention: false, icon: <ActivityIcon /> },
    { title: isArabic ? "المراجعات المعلقة" : "Pending Reviews", value: formatDashboardMetric(stats?.pendingReviews, loading), subtitle: isArabic ? "علامات مراجعة سريرية غير مراجعة" : "Unreviewed clinical review flags", attention: true, icon: <FlagIcon /> },
    { title: isArabic ? "التقييمات عن بُعد المعلقة" : "Remote Assessments Pending", value: formatDashboardMetric(stats?.remoteAssessmentsPending, loading), subtitle: isArabic ? "روابط تقييم بانتظار الرد" : "Assessment links awaiting response", attention: false, icon: <LinkIcon /> },
  ];

  const operationalKpiCards = [
    { title: isArabic ? "الجلسات هذا الأسبوع" : "Sessions This Week", value: formatDashboardMetric(stats?.sessionsCompletedThisWeek, loading), subtitle: isArabic ? "تم تسجيل جلسات منزلية/عيادية مكتملة" : "Completed home/clinic sessions logged", attention: false },
    { title: isArabic ? "متوسط الالتزام بالخطة" : "Avg Plan Adherence", value: formatDashboardAdherencePct(stats?.averagePlanAdherencePct, loading), subtitle: isArabic ? "متوسط الإنجاز عبر الخطط النشطة" : "Mean completion across active plans", attention: false },
    { title: isArabic ? "التقييمات هذا الشهر" : "Assessments This Month", value: formatDashboardMetric(stats?.assessmentsSubmittedThisMonth, loading), subtitle: isArabic ? "سجلات تقييم تم تقديمها" : "Submitted assessment records", attention: false },
    { title: isArabic ? "لقطات CV هذا الشهر" : "CV Captures This Month", value: formatDashboardMetric(stats?.cvCapturesThisMonth, loading), subtitle: isArabic ? "تم حفظ مقاييس جلسات بمساعدة الكاميرا" : "Camera-assisted session metrics saved", attention: false },
  ];

  const statsUpdatedAt = formatDashboardStatsTime(stats?.generatedAt);

  const attentionQueue = useMemo(
    () =>
      buildPilotAttentionQueue({
        patients,
        stats,
        results,
        limit: 8,
        language: isArabic ? "ar" : "en",
      }),
    [patients, stats, results, isArabic],
  );

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl">

        {/* ── Header ── */}
        <div className="relative mb-8 overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-60 blur-3xl"
            style={{ background: "radial-gradient(circle, var(--brand-glow), transparent 70%)" }}
            aria-hidden
          />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{isArabic ? "مساحة مقدم الخدمة" : "Provider workspace"}</p>
              <h1 className="mt-2 text-[32px] font-bold leading-tight tracking-[-0.02em] text-[var(--foreground)]">{isArabic ? "لوحة التحكم" : "Dashboard"}</h1>
              <p className="mt-1.5 max-w-xl text-sm text-[var(--muted)]">
                {isArabic ? "إدارة المرضى والتقييمات وخطط إعادة التأهيل من مكان واحد." : "Manage patients, assessments, and rehabilitation plans from one place."}
              </p>
              {!loading && statsUpdatedAt && (
                <p className="mt-2 text-[11px] text-[var(--muted-soft)]">
                  {isArabic ? "تم تحديث البيانات:" : "Data updated:"} {statsUpdatedAt}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/clinician/patients/new" className="rounded-[11px] bg-[var(--brand)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-dark)] hover:shadow-[0_4px_14px_var(--brand-glow)]">
                {isArabic ? "+ إضافة مريض" : "+ Add Patient"}
              </Link>
              <Link href="/clinician/results" className="rounded-[11px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--brand)]/40 hover:text-[var(--brand)]">
                {isArabic ? "مراجعة النتائج" : "Review Results"}
              </Link>
              <Link href="/clinician/assessment/start" className="rounded-[11px] border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--brand)]/40 hover:text-[var(--brand)]">
                {isArabic ? "بدء التقييم" : "Start Assessment"}
              </Link>
              <Link href="/clinician/request" className="rounded-[11px] border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--brand)]/40 hover:text-[var(--brand)]">
                {isArabic ? "إنشاء رابط عن بُعد" : "Generate Remote Link"}
              </Link>
            </div>
          </div>
        </div>

        {/* ── Metric cards ── */}
        <section className="mb-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metricCards.map((c) => (
              <ClinicianMetricCard key={c.title} title={c.title} value={c.value} subtitle={c.subtitle} attention={c.attention} icon={c.icon} />
            ))}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            {isArabic ? "مؤشرات الأداء التشغيلية" : "Operational KPIs"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {operationalKpiCards.map((c) => (
              <ClinicianMetricCard key={c.title} title={c.title} value={c.value} subtitle={c.subtitle} attention={c.attention} />
            ))}
          </div>
        </section>

        {/* ── Main columns ── */}
        <section className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">

          {/* Attention queue */}
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[var(--foreground)]">{isArabic ? "قائمة المتابعة" : "Attention Queue"}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {isArabic ? "متابعة قابلة للتنفيذ من التقييمات والخطط ونشاط الجلسات." : "Actionable follow-up from assessments, plans, and session activity."}
                </p>
              </div>
              <Link
                href="/clinician/results"
                className="shrink-0 text-xs font-semibold text-[var(--brand)] transition hover:text-[var(--brand-dark)]"
              >
                {isArabic ? "عرض قائمة النتائج كاملة →" : "View full results queue →"}
              </Link>
            </div>
            <div className="mt-4 space-y-2">
              {loading ? (
                <p className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--muted)]">
                  {isArabic ? "جارٍ تحميل قائمة المتابعة…" : "Loading follow-up queue…"}
                </p>
              ) : attentionQueue.length === 0 ? (
                <p className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-sm leading-relaxed text-[var(--muted)]">
                  {isArabic ? "لا توجد عناصر متابعة نشطة. تابع مراقبة نشاط المرضى والتقييمات المقدمة." : "No active follow-up items. Continue monitoring patient activity and submitted assessments."}
                </p>
              ) : (
                attentionQueue.map((item) => (
                  <PilotAttentionQueueRow
                    key={`${item.patientId || "aggregate"}-${item.source}-${item.reason}`}
                    item={item}
                    isArabic={isArabic}
                  />
                ))
              )}
            </div>
          </div>

          {/* Workflow map */}
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-bold text-[var(--foreground)]">{isArabic ? "خريطة سير العمل" : "Workflow Map"}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{isArabic ? "التسلسل السريري الموصى به من الاستلام إلى النتيجة." : "Recommended clinical sequence from intake to outcome."}</p>

            <div className="mt-4 space-y-3">
              {workflowSteps.map((step, i) => (
                <div key={step.title} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--brand)]/30 bg-[var(--brand-soft)] text-[11px] font-bold text-[var(--brand)]">
                      {i + 1}
                    </span>
                    {i < workflowSteps.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-[var(--border)]" />
                    )}
                  </div>
                  <div className="min-w-0 pb-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{step.title.replace(/^\d+\. /, "")}</p>
                    <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">{step.description}</p>
                    {step.href && (
                      <Link href={step.href} className="mt-1 inline-block text-xs font-semibold text-[var(--brand)] hover:text-[var(--brand-dark)]">
                        {isArabic ? "فتح →" : "Open →"}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
