"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useGlobalLanguage } from "@/app/components/GlobalLanguageProvider";
import {
  formatLastSessionLine,
  formatSessionsLine,
  OPERATIONAL_STATUS_ONLY,
  shouldShowNoRecentSessionBadge,
} from "@/app/lib/clinician/adherence-display";
import {
  buildPatientOperationalSummaries,
  type PatientOperationalBadge,
} from "@/app/lib/clinician/pilot-attention-queue";
import type { PatientRow } from "../../lib/validate-patient-ownership";
import ConfirmModal from "../../components/ConfirmModal";
import { DemoOfflineBanner } from "@/app/components/clinician/DemoOfflineBanner";
import { ClinicianInlineError } from "@/app/components/clinician/ClinicianInlineError";
import { useClinicianPatientsAndResults } from "@/app/hooks/useClinicianPatientsAndResults";

/* ─── Badge helpers ──────────────────────────────────────────────────────── */

function OperationalBadge({ badge }: { badge: PatientOperationalBadge }) {
  const cls =
    badge.tone === "review"
      ? "border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)]"
      : badge.tone === "rehab"
        ? "border-[var(--brand)]/25 bg-[var(--brand-soft)] text-[var(--brand)]"
        : badge.tone === "assessment"
          ? "border-[var(--info)]/25 bg-[var(--info-soft)] text-[var(--info)]"
          : badge.tone === "plan"
            ? "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--muted)]"
            : "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--muted-soft)]";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {badge.label}
    </span>
  );
}

function NoRecentSessionBadge({ isArabic }: { isArabic: boolean }) {
  return (
    <span className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
      {isArabic ? "لا توجد جلسة حديثة" : "No recent session"}
    </span>
  );
}

function StatusBadge({ status, isArabic }: { status: string | null; isArabic: boolean }) {
  const s = status ?? "";
  const normalized = s.toLowerCase();
  const cls =
    normalized === "active"
      ? "border-[var(--brand)]/25 bg-[var(--brand-soft)] text-[var(--brand)]"
      : normalized === "review"
      ? "border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)]"
      : "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--muted-soft)]";

  const label =
    normalized === "review"
      ? (isArabic ? "مراجعة" : "Review")
      : normalized === "active"
        ? (isArabic ? "نشط" : "Active")
        : (isArabic ? "نشط" : "Active");

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      {s || label}
    </span>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function PatientsPage() {
  const { language } = useGlobalLanguage();
  const isArabic = language === "ar";
  const {
    patients,
    setPatients,
    results,
    loading: isLoading,
    error,
    demoMode,
    demoNotice,
  } = useClinicianPatientsAndResults({ strictPatients: true });
  const [search, setSearch]         = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<PatientRow | null>(null);

  const operationalByPatient = useMemo(
    () => buildPatientOperationalSummaries(patients, results),
    [patients, results],
  );

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    setDeletingId(confirmTarget.id);
    try {
      const res = await fetch(`/api/patients/${confirmTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Delete failed (${res.status})`);
      }
      setPatients((prev) => prev.filter((p) => p.id !== confirmTarget.id));
      setConfirmTarget(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete patient.");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = useMemo(
    () =>
      patients.filter((p) =>
        `${p.full_name} ${p.id} ${p.phone ?? ""} ${p.diagnosis ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [patients, search],
  );

  const activeCount = useMemo(
    () => patients.filter((p) => (p.status ?? "").toLowerCase() === "active").length,
    [patients],
  );

  return (
    <>
      <ConfirmModal
        open={!!confirmTarget}
        title={language === "ar" ? "حذف المريض" : "Delete Patient"}
        message={
          language === "ar"
            ? `سيتم حذف "${confirmTarget?.full_name}" نهائيًا. لا يمكن التراجع عن هذا الإجراء.`
            : `"${confirmTarget?.full_name}" will be permanently removed. This cannot be undone.`
        }
        confirmLabel={language === "ar" ? "نعم، احذف" : "Yes, Delete"}
        loading={deletingId !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />

      <div className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] md:px-6 md:py-8">
        <div className="mx-auto max-w-6xl space-y-5">

          <DemoOfflineBanner visible={demoMode} notice={demoNotice} />

          {/* ── Header ── */}
          <div
            className="flex flex-wrap items-start justify-between gap-4 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]"
            dir={isArabic ? "rtl" : "ltr"}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                {isArabic ? "مساحة مقدم الخدمة" : "Provider workspace"}
              </p>
              <h1 className="mt-2 text-[28px] font-bold tracking-[-0.02em] text-[var(--foreground)]">{isArabic ? "المرضى" : "Patients"}</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {isArabic
                  ? `${patients.length} سجل · ${activeCount} نشط`
                  : `${patients.length} records · ${activeCount} active`}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Link
                href="/clinician/patients/new"
                className="rounded-[11px] bg-[var(--brand)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-dark)]"
              >
                {isArabic ? "إضافة مريض" : "Add Patient"}
              </Link>
              <Link
                href="/clinician/assessment/new"
                className="rounded-[11px] border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
              >
                {isArabic ? "تقييم جديد" : "New Assessment"}
              </Link>
            </div>
          </div>

          {/* ── Error banner ── */}
          {error && (
            <ClinicianInlineError message={isArabic ? `تعذّر تحميل المرضى. ${error}` : `Could not load patients. ${error}`} />
          )}

          {/* ── Search ── */}
          <div className="flex items-center gap-2.5" dir={isArabic ? "rtl" : "ltr"}>
            <div className="relative flex-1">
              <svg className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-soft)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="search"
                aria-label={isArabic ? "البحث عن المرضى بالاسم أو التشخيص أو الهاتف" : "Search patients by name, diagnosis, or phone"}
                placeholder={isArabic ? "ابحث باسم المريض أو التشخيص أو الهاتف…" : "Search by name, diagnosis, or phone…"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-[11px] border border-[var(--border)] bg-[var(--surface)] py-2.5 ps-9 pe-4 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)] focus:border-[var(--brand)]/50 focus:ring-2 focus:ring-[var(--brand)]/15"
              />
            </div>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="rounded-[11px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                {isArabic ? "مسح" : "Clear"}
              </button>
            )}
          </div>

          {/* ── Table ── */}
          <div className="overflow-x-auto rounded-[16px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
            <table className="min-w-full">
              <thead className="bg-[var(--surface-alt)]">
                <tr>
                  {[
                    isArabic ? "المريض" : "Patient",
                    isArabic ? "التشخيص" : "Diagnosis",
                    isArabic ? "الهاتف" : "Phone",
                    isArabic ? "الحالة" : "Status",
                    isArabic ? "تاريخ الإضافة" : "Added",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-start text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-sm text-[var(--muted)]" aria-busy="true">
                      {isArabic ? "جارٍ تحميل المرضى…" : "Loading patients…"}
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <p className="text-sm text-[var(--muted)]">
                        {search
                          ? (isArabic ? "لا توجد مرضى مطابقون للبحث الحالي." : "No patients match the current search.")
                          : (isArabic ? "لا يوجد مرضى بعد. أضف أول مريض لك لبدء سير العمل التجريبي." : "No patients yet. Add your first patient to begin the pilot workflow.")}
                      </p>
                      {!search && (
                        <Link
                          href="/clinician/patients/new"
                          className="mt-4 inline-flex rounded-[11px] bg-[var(--brand)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--brand-dark)]"
                        >
                          {isArabic ? "أضف أول مريض لك" : "Add your first patient"}
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((patient) => {
                    const operational = operationalByPatient.get(patient.id);
                    const sessionsLine =
                      operational && operational.totalSessions > 0
                        ? formatSessionsLine(
                            operational.sessionsCompleted,
                            operational.totalSessions,
                          )
                        : null;
                    const lastSessionLine = operational?.hasPlan
                      ? formatLastSessionLine(operational.lastSessionAt)
                      : null;
                    const showNoRecent =
                      operational &&
                      shouldShowNoRecentSessionBadge({
                        totalSessions: operational.totalSessions,
                        lastSessionAt: operational.lastSessionAt,
                      });
                    return (
                    <tr
                      key={patient.id}
                      className="group transition hover:bg-[var(--surface-alt)]"
                    >
                      {/* Name + avatar */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--brand-soft)] text-[11px] font-bold text-[var(--brand)]">
                            {patient.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[var(--foreground)]">{patient.full_name}</p>
                            {patient.phone && (
                              <p className="text-[11px] text-[var(--muted-soft)]">{patient.phone}</p>
                            )}
                            {operational && operational.badges.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {operational.badges.map((badge) => (
                                  <OperationalBadge key={badge.label} badge={badge} />
                                ))}
                                {showNoRecent && <NoRecentSessionBadge isArabic={isArabic} />}
                              </div>
                            )}
                            {showNoRecent && operational && operational.badges.length === 0 && (
                              <div className="mt-1.5">
                                <NoRecentSessionBadge isArabic={isArabic} />
                              </div>
                            )}
                            {sessionsLine && (
                              <p className="mt-1 text-[10px] text-[var(--muted)]">{sessionsLine}</p>
                            )}
                            {lastSessionLine && (
                              <p className="mt-0.5 text-[10px] text-[var(--muted-soft)]">{lastSessionLine}</p>
                            )}
                            {operational?.hasPlan && operational.totalSessions > 0 && (
                              <p className="mt-0.5 text-[9px] italic text-[var(--muted-soft)]">
                                {OPERATIONAL_STATUS_ONLY}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Diagnosis */}
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-[var(--muted)]">
                          {patient.diagnosis || (isArabic ? "غير محدد" : "Not specified")}
                        </span>
                      </td>

                      {/* Phone */}
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-[var(--muted)]">{patient.phone || "—"}</span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <StatusBadge status={patient.status} isArabic={isArabic} />
                      </td>

                      {/* Added date */}
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-[var(--muted-soft)]">
                          {patient.created_at ? new Date(patient.created_at).toLocaleDateString() : "—"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/clinician/patients/${patient.id}`}
                            className="rounded-[8px] border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)] transition hover:border-[var(--brand)]/50"
                          >
                            {isArabic ? "فتح الملف" : "Open profile"}
                          </Link>
                          <button
                            type="button"
                            disabled={deletingId === patient.id}
                            onClick={() => setConfirmTarget(patient)}
                            className="rounded-[8px] border border-transparent px-3 py-1.5 text-xs font-semibold text-[var(--muted-soft)] opacity-60 transition hover:border-[var(--danger)]/30 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] hover:opacity-100 focus-visible:opacity-100 disabled:opacity-40"
                          >
                            {deletingId === patient.id ? "…" : (isArabic ? "حذف" : "Delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          {!isLoading && (
            <p className="text-xs text-[var(--muted-soft)]">
              {isArabic
                ? `${filtered.length} من ${patients.length} مريض${patients.length !== 1 ? "" : ""} ${search ? `مطابق لبحث "${search}"` : "معروض"}`
                : `${filtered.length} of ${patients.length} patient${patients.length !== 1 ? "s" : ""}${search ? ` matching "${search}"` : " shown"}`}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
