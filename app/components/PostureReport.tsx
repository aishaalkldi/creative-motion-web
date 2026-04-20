"use client";

import type { PostureCheckResult, PostureLabel } from "../lib/posture-analyzer";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
export interface PostureReportProps {
  score: number | null;
  assessmentId: string;
  patientId: string;
  patientName: string;
  lastFrame: PostureCheckResult | null;
  reportSummary: string;
}

/* ─────────────────────────────────────────────
   Clinical-text generators
   All pure: no state, no side-effects.
───────────────────────────────────────────── */
interface Finding {
  area: string;
  status: "normal" | "mild" | "marked";
  text: string;
}

function buildFindings(frame: PostureCheckResult | null): Finding[] {
  if (!frame) {
    return [
      { area: "Shoulder Alignment", status: "mild", text: "Insufficient frame data captured — ensure full body is visible during assessment." },
      { area: "Head Position",       status: "mild", text: "Insufficient data." },
      { area: "Trunk Alignment",     status: "mild", text: "Insufficient data." },
      { area: "Hip Symmetry",        status: "mild", text: "Insufficient data." },
    ];
  }

  const { shoulderTilt, headOffset, trunkOffset, hipTilt } = frame;

  const shoulder: Finding =
    shoulderTilt > 8
      ? { area: "Shoulder Alignment", status: "marked", text: `Marked shoulder asymmetry detected (tilt ${shoulderTilt.toFixed(1)}°). Indicates possible upper-trapezius tightness or thoracic scoliotic curve.` }
      : shoulderTilt > 4
        ? { area: "Shoulder Alignment", status: "mild", text: `Mild shoulder elevation on one side (tilt ${shoulderTilt.toFixed(1)}°). Monitor for upper-crossed syndrome pattern.` }
        : { area: "Shoulder Alignment", status: "normal", text: `Shoulders are level (tilt ${shoulderTilt.toFixed(1)}°). No asymmetry detected.` };

  const head: Finding =
    headOffset > 0.06
      ? { area: "Head Position", status: "marked", text: "Significant lateral head displacement from the coronal midline. Assess for cervical lateral flexion or visual accommodation pattern." }
      : headOffset > 0.03
        ? { area: "Head Position", status: "mild", text: "Mild lateral head offset observed. May reflect habitual posture or mild upper-cervical asymmetry." }
        : { area: "Head Position", status: "normal", text: "Head is centred over the shoulder girdle. No lateral displacement noted." };

  const trunk: Finding =
    trunkOffset > 0.06
      ? { area: "Trunk Alignment", status: "marked", text: "Significant trunk lateral shift relative to the pelvis. Assess for lumbar lateral flexion compensation or leg-length discrepancy." }
      : trunkOffset > 0.03
        ? { area: "Trunk Alignment", status: "mild", text: "Mild trunk deviation from plumb line. May indicate core asymmetry or habitual weight-shift." }
        : { area: "Trunk Alignment", status: "normal", text: "Trunk is vertically aligned over the base of support." };

  const hip: Finding =
    hipTilt > 8
      ? { area: "Hip / Pelvic Symmetry", status: "marked", text: `Marked pelvic obliquity (hip tilt ${hipTilt.toFixed(1)}°). Assess for leg-length discrepancy, hip abductor weakness, or structural pelvic asymmetry.` }
      : hipTilt > 4
        ? { area: "Hip / Pelvic Symmetry", status: "mild", text: `Mild pelvic tilt (${hipTilt.toFixed(1)}°). Monitor for gluteal imbalance or asymmetric loading pattern.` }
        : { area: "Hip / Pelvic Symmetry", status: "normal", text: `Pelvis is level (tilt ${hipTilt.toFixed(1)}°). Symmetric base of support.` };

  return [shoulder, head, trunk, hip];
}

function buildInterpretation(score: number | null, label: PostureLabel | null): string {
  if (score === null || label === null) return "Assessment data is unavailable.";

  if (score >= 80) {
    return "The patient demonstrates good overall postural alignment across the evaluated planes. Findings are within normal clinical limits for static standing posture. Continued activity and preventive conditioning are appropriate.";
  }
  if (score >= 60) {
    return "The patient exhibits mild postural asymmetry in one or more regions. These deviations are sub-clinical but warrant monitoring. A targeted exercise programme addressing identified imbalances is recommended to prevent progression.";
  }
  return "The patient presents with postural deviations that are clinically significant. Comprehensive evaluation including dynamic assessment, muscle-length testing, and joint mobility screening is recommended. A structured rehabilitation plan addressing identified impairments should be initiated promptly.";
}

function buildRecommendations(score: number | null, findings: Finding[]): string[] {
  const base: string[] = [];
  const flagged = findings.filter((f) => f.status !== "normal");

  if (flagged.some((f) => f.area === "Shoulder Alignment")) {
    base.push("Upper-trapezius and levator-scapulae stretching protocol (3 × 30 s, bilateral).");
    base.push("Scapular stabilisation exercises: wall slides, prone Y-T-W progression.");
  }
  if (flagged.some((f) => f.area === "Head Position")) {
    base.push("Cervical postural correction: chin-tuck exercises (3 × 10 reps, daily).");
    base.push("Ergonomic screen-height and workstation review.");
  }
  if (flagged.some((f) => f.area === "Trunk Alignment")) {
    base.push("Core stabilisation: dead-bug, bird-dog, pallof-press progression.");
    base.push("Lateral trunk strengthening: side-plank and hip-hike programme.");
  }
  if (flagged.some((f) => f.area.includes("Hip"))) {
    base.push("Hip-abductor strengthening: clamshell and side-lying hip-abduction series.");
    base.push("Leg-length discrepancy screening and orthopaedic referral if indicated.");
  }

  if (base.length === 0 || (score !== null && score >= 80)) {
    base.push("Maintain current physical activity and posture habits.");
    base.push("Reassess postural alignment in 3 months or following any new symptom onset.");
  } else {
    base.push("Reassess postural alignment in 4–6 weeks following commencement of prescribed programme.");
    base.push("Educate patient on postural awareness and self-correction strategies during daily activity.");
  }

  return base;
}

/* ─────────────────────────────────────────────
   Print helper
   Opens a new browser window with clean white
   HTML, then calls window.print() on it.
───────────────────────────────────────────── */
function printReport(payload: {
  patientId: string;
  patientName: string;
  assessmentId: string;
  score: number | null;
  label: string;
  date: string;
  findings: Finding[];
  interpretation: string;
  recommendations: string[];
  summary: string;
}) {
  const statusColor = (status: Finding["status"]) =>
    status === "normal" ? "#166534" : status === "mild" ? "#92400e" : "#991b1b";
  const statusBg = (status: Finding["status"]) =>
    status === "normal" ? "#dcfce7" : status === "mild" ? "#fef3c7" : "#fee2e2";
  const statusLabel = (status: Finding["status"]) =>
    status === "normal" ? "Normal" : status === "mild" ? "Mild deviation" : "Marked deviation";

  const findingRows = payload.findings
    .map(
      (f) => `
      <tr>
        <td style="padding:8px 12px;font-weight:600;color:#1e293b;border-bottom:1px solid #e2e8f0">${f.area}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">
          <span style="background:${statusBg(f.status)};color:${statusColor(f.status)};padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700">
            ${statusLabel(f.status)}
          </span>
        </td>
        <td style="padding:8px 12px;color:#374151;font-size:13px;border-bottom:1px solid #e2e8f0">${f.text}</td>
      </tr>`
    )
    .join("");

  const recList = payload.recommendations
    .map((r) => `<li style="margin-bottom:6px;color:#374151">${r}</li>`)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Postural Assessment Report — ${payload.assessmentId}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#1e293b;padding:32px 48px;font-size:14px;line-height:1.6}
    h1{font-size:22px;font-weight:700;color:#0f172a}
    h2{font-size:15px;font-weight:700;color:#0f172a;margin:24px 0 10px;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #e2e8f0;padding-bottom:6px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0891b2;padding-bottom:16px;margin-bottom:24px}
    .clinic-name{font-size:18px;font-weight:800;color:#0891b2}
    .clinic-sub{font-size:12px;color:#64748b;margin-top:2px}
    .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:8px}
    .meta-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px}
    .meta-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
    .meta-value{font-size:14px;font-weight:600;color:#0f172a;margin-top:2px}
    .score-badge{display:inline-block;padding:4px 18px;border-radius:999px;font-weight:700;font-size:18px}
    table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
    th{background:#f1f5f9;padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#475569}
    p.interp{background:#f8fafc;border-left:4px solid #0891b2;padding:12px 16px;border-radius:0 8px 8px 0;color:#1e293b;margin-bottom:8px}
    ul{padding-left:20px}
    .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between}
    @media print{body{padding:20px 36px}button{display:none!important}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="clinic-name">Creative Motion</div>
      <div class="clinic-sub">Physiotherapy &amp; Sports Performance</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:12px;color:#64748b">Report generated</div>
      <div style="font-weight:600">${payload.date}</div>
    </div>
  </div>

  <h1>Postural Assessment Report</h1>

  <div class="meta-grid" style="margin-top:16px">
    <div class="meta-box">
      <div class="meta-label">Patient Name</div>
      <div class="meta-value">${payload.patientName}</div>
    </div>
    <div class="meta-box">
      <div class="meta-label">Patient ID</div>
      <div class="meta-value">${payload.patientId}</div>
    </div>
    <div class="meta-box">
      <div class="meta-label">Assessment ID</div>
      <div class="meta-value">${payload.assessmentId}</div>
    </div>
    <div class="meta-box">
      <div class="meta-label">Overall Score</div>
      <div class="meta-value">
        <span class="score-badge" style="background:${payload.score !== null && payload.score >= 80 ? "#dcfce7" : payload.score !== null && payload.score >= 60 ? "#fef3c7" : "#fee2e2"};color:${payload.score !== null && payload.score >= 80 ? "#166534" : payload.score !== null && payload.score >= 60 ? "#92400e" : "#991b1b"}">
          ${payload.score !== null ? `${payload.score}%` : "N/A"}
        </span>
      </div>
    </div>
    <div class="meta-box" style="grid-column:span 2">
      <div class="meta-label">Clinical Classification</div>
      <div class="meta-value">${payload.label}</div>
    </div>
  </div>

  <h2>Postural Findings</h2>
  <table>
    <thead>
      <tr>
        <th style="width:22%">Region</th>
        <th style="width:18%">Status</th>
        <th>Clinical Observation</th>
      </tr>
    </thead>
    <tbody>${findingRows}</tbody>
  </table>

  <h2>Clinical Interpretation</h2>
  <p class="interp">${payload.interpretation}</p>
  <p style="margin-top:8px;color:#475569;font-size:13px">${payload.summary}</p>

  <h2>Recommendations</h2>
  <ul>${recList}</ul>

  <div class="footer">
    <span>Creative Motion — Physiotherapy &amp; Sports Performance</span>
    <span>This report is generated from automated postural analysis. Clinical judgement must be applied.</span>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Pop-up blocked. Please allow pop-ups for this site to download the report.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

/* ─────────────────────────────────────────────
   Status badge colours (in-page display)
───────────────────────────────────────────── */
const STATUS_STYLES: Record<Finding["status"], string> = {
  normal: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  mild:   "border-amber-400/30   bg-amber-400/10   text-amber-200",
  marked: "border-rose-400/30    bg-rose-400/10    text-rose-200",
};
const STATUS_LABELS: Record<Finding["status"], string> = {
  normal: "Normal",
  mild:   "Mild deviation",
  marked: "Marked deviation",
};

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
export default function PostureReport({
  score,
  assessmentId,
  patientId,
  patientName,
  lastFrame,
  reportSummary,
}: PostureReportProps) {
  const findings       = buildFindings(lastFrame);
  const label: PostureLabel | null =
    score === null ? null : score >= 80 ? "Good alignment" : score >= 60 ? "Mild asymmetry detected" : "Postural deviation observed";
  const interpretation = buildInterpretation(score, label);
  const recommendations = buildRecommendations(score, findings);
  const date = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });

  function handleDownload() {
    printReport({
      patientId,
      patientName,
      assessmentId,
      score,
      label: label ?? "Not classified",
      date,
      findings,
      interpretation,
      recommendations,
      summary: reportSummary,
    });
  }

  return (
    <div className="mt-6 rounded-2xl border border-cyan-300/18 bg-white/[0.03] p-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-cyan-200">
          Clinical Posture Report
        </h3>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          Download Report
        </button>
      </div>

      <p className="mt-1 text-xs text-white/50">
        Generated {date} &nbsp;·&nbsp; Assessment {assessmentId}
      </p>

      {/* Postural Findings */}
      <div className="mt-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Postural Findings
        </p>
        <div className="space-y-3">
          {findings.map((f) => (
            <div
              key={f.area}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-white/90">{f.area}</span>
                <span
                  className={`rounded-full border px-3 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[f.status]}`}
                >
                  {STATUS_LABELS[f.status]}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/65">{f.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Clinical Interpretation */}
      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Clinical Interpretation
        </p>
        <div className="rounded-xl border-l-4 border-cyan-400/60 bg-white/[0.04] px-4 py-3 text-sm leading-7 text-white/80">
          {interpretation}
        </div>
      </div>

      {/* Recommendations */}
      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Recommendations
        </p>
        <ul className="space-y-2">
          {recommendations.map((rec, i) => (
            <li key={i} className="flex gap-3 text-sm text-white/75">
              <span className="mt-0.5 flex-none rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                {String(i + 1).padStart(2, "0")}
              </span>
              {rec}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-5 text-[11px] text-white/35">
        This report is generated from automated postural analysis. Clinical judgement must be applied before intervention.
      </p>
    </div>
  );
}
