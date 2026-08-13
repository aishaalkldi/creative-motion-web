"use client";

import Link from "next/link";
import { useGlobalLanguage } from "@/app/components/GlobalLanguageProvider";

const GAIT_ASSESSMENT_HREF = "/clinician/assessments/gait";

const STS_ASSESSMENT_REVIEW_HREF = "/clinician/assessments/sit-to-stand";

const SINGLE_LEG_STANCE_HREF = "/clinician/assessments/single-leg-stance";

const FUNCTIONAL_REACH_HREF = "/clinician/assessments/functional-reach";

const TIMED_UP_AND_GO_HREF = "/clinician/assessments/timed-up-and-go";



type AssessmentCard = {

  title: string;

  status: string;

  statusTone: "coming" | "foundation";

  description: string;

  href?: string;

  cta?: string;

  footnote?: string;

};

function buildAssessmentCards(isArabic: boolean): AssessmentCard[] {
  return [
    {
      title: isArabic ? "تقييم المشي" : "Gait Assessment",
      status: isArabic ? "قشرة التقييم · نسخة 1" : "Assessment shell · v1",
      statusTone: "foundation",
      description: isArabic
        ? "مراقبة المشي بمساعدة الكاميرا لمراجعة الطبيب."
        : "Camera-assisted walking observation for therapist review.",
      href: GAIT_ASSESSMENT_HREF,
      cta: isArabic ? "فتح مراقبة المشي" : "Open gait observation",
    },
    {
      title: isArabic ? "تقييم الجلوس والوقوف" : "Sit-to-Stand Assessment",
      status: isArabic ? "قاعدة متاحة · توجد أدلة حركة موجودة" : "Available foundation · Existing motion evidence",
      statusTone: "foundation",
      description: isArabic
        ? "ملاحظات التكرار والتوقيت وجودة الحركة لمراجعة الطبيب."
        : "Repetition, timing, and movement quality observations for therapist review.",
      href: STS_ASSESSMENT_REVIEW_HREF,
      cta: isArabic ? "مراجعة نتائج الجلوس والوقوف" : "Review Sit-to-Stand results",
      footnote: isArabic
        ? "قد تساعد أدلة الحركة الحالية من جلسات المريض في مراجعة الطبيب."
        : "Existing motion evidence from patient sessions may inform therapist review.",
    },
    {
      title: isArabic ? "تقييم التوازن على قدم واحدة" : "Single Leg Stance Assessment",
      status: isArabic ? "قشرة التقييم · قادم قريبًا" : "Assessment shell · coming next",
      statusTone: "coming",
      description: isArabic
        ? "مهمة تقييم الوظائف للتوازن على القدم الواحدة ومراقبة الحركة ومراجعة الطبيب."
        : "Single-leg stance functional assessment task for movement observation and therapist review.",
      href: SINGLE_LEG_STANCE_HREF,
      cta: isArabic ? "فتح وحدة التوازن على قدم واحدة" : "Open single-leg stance module",
    },
    {
      title: isArabic ? "تقييم الوصول الوظيفي" : "Functional Reach Assessment",
      status: isArabic ? "قشرة التقييم · قادم قريبًا" : "Assessment shell · coming next",
      statusTone: "coming",
      description: isArabic
        ? "مهمة تقييم الوصول الأمامي ومراقبة الحركة ومراجعة الطبيب."
        : "Forward reach functional assessment task for movement observation and therapist review.",
      href: FUNCTIONAL_REACH_HREF,
      cta: isArabic ? "فتح وحدة الوصول الوظيفي" : "Open functional reach module",
    },
    {
      title: isArabic ? "تقييم الوقوف والمشي»" : "Timed Up and Go Assessment",
      status: isArabic ? "قشرة التقييم · قادم قريبًا" : "Assessment shell · coming next",
      statusTone: "coming",
      description: isArabic
        ? "مهمة تقييم وظيفية مقاسة لمراقبة الحركة ومراجعة الطبيب."
        : "Timed functional assessment task for movement observation and therapist review.",
      href: TIMED_UP_AND_GO_HREF,
      cta: isArabic ? "فتح وحدة الوقوف والمشي" : "Open timed up and go module",
    },
    {
      title: isArabic ? "نماذج يُبلغ عنها المريض" : "Patient-Reported Forms",
      status: isArabic ? "قادم قريبًا" : "Coming next",
      statusTone: "coming",
      description: isArabic
        ? "تتبع الألم والجهد والثقة والأعراض."
        : "Pain, effort, confidence, and symptom tracking.",
    },
  ];
}



function statusBadgeClass(tone: AssessmentCard["statusTone"]): string {

  if (tone === "foundation") {

    return "border-[#1D9E75]/30 bg-[#1D9E75]/10 text-[#5DCAA5]";

  }

  return "border-[#1E2D42] bg-[#0B1220] text-white/45";

}



export default function AssessmentCenterPage() {
  const { language } = useGlobalLanguage();
  const isArabic = language === "ar";
  const cards = buildAssessmentCards(isArabic);

  return (

    <div className="min-h-screen bg-[#0B1220] px-6 py-8 text-white" dir={isArabic ? "rtl" : "ltr"}>

      <div className="mx-auto max-w-5xl">

        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1D9E75]">

          {isArabic ? "RASQ · تقييمات الحركة" : "RASQ · Movement assessments"}

        </p>

        <h1 className="mt-2 text-2xl font-bold text-white">{isArabic ? "مركز التقييم" : "Assessment Center"}</h1>

        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45">
          {isArabic
            ? "خطط ومراجعة تقييمات الحركة المنظمة. ستوفر كل وحدة ملاحظات بمساعدة الكاميرا ومقاييس مساعدة لدعم مراجعة الطبيب."
            : "Plan and review structured movement assessments. Each module will provide camera-assisted observations and assistive metrics to support therapist review."}
        </p>



        <div className="mt-5 rounded-[10px] border border-amber-400/20 bg-amber-400/5 px-4 py-3.5">

          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200/90">

            {isArabic ? "مطلوب مراجعة الطبيب" : "Therapist review required"}

          </p>

          <p className="mt-2 text-sm leading-relaxed text-white/55">
            {isArabic
              ? "توفر تقييمات الحركة بمساعدة الكاميرا ملاحظات عن الحركة لدعم مراجعة الطبيب. وهي ليست تشخيصية ولا تعوض الفحص السريري."
              : "Camera-assisted assessments provide movement observations to support therapist review. They are not diagnostic and do not replace clinical examination."}
          </p>

        </div>



        <section className="mt-6">

          <h2 className="text-sm font-bold text-white">{isArabic ? "وحدات التقييم" : "Assessment modules"}</h2>

          <p className="mt-1 text-xs text-white/35">
            {isArabic
              ? "وحدات أدلة الحركة للتجربة التجريبية. ستصل تدفقات الالتقاط الكاملة في الإصدارات القادمة."
              : "Movement evidence modules for pilot rollout. Full capture workflows arrive in upcoming releases."}
          </p>



          <ul className="mt-4 grid gap-4 sm:grid-cols-2">

            {cards.map((card) => {

              const cardBody = (

                <>

                  <div className="flex flex-wrap items-start justify-between gap-2">

                    <h3 className="text-[15px] font-semibold text-white">{card.title}</h3>

                    <span

                      className={`shrink-0 rounded-[5px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(card.statusTone)}`}

                    >

                      {card.status}

                    </span>

                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-white/45">{card.description}</p>

                  {card.footnote ? (

                    <p className="mt-3 text-[11px] text-white/30">{card.footnote}</p>

                  ) : null}

                  {card.cta ? (

                    <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#5DCAA5]">

                      {card.cta}

                      <span aria-hidden className="transition group-hover:translate-x-0.5">

                        →

                      </span>

                    </p>

                  ) : null}

                </>

              );



              if (card.href) {

                return (

                  <li key={card.title}>

                    <Link

                      href={card.href}

                      className="group block rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5 transition hover:border-[#1D9E75]/30 hover:bg-[#0d1f18]"

                    >

                      {cardBody}

                    </Link>

                  </li>

                );

              }



              return (

                <li

                  key={card.title}

                  className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5"

                >

                  {cardBody}

                </li>

              );

            })}

          </ul>

        </section>



        <p className="mt-8 text-[11px] leading-relaxed text-white/25">
          {isArabic
            ? "يظل الاستبيان عن بُعد والتوثيق داخل العيادة متاحًا من اللوحة الرئيسية وملف المريض. سينمو هذا المركز مع تدفقات تقييم الحركة بمساعدة الكاميرا."
            : "Remote questionnaire and in-clinic documentation remain available from the dashboard and patient profile. This center will expand with camera-assisted assessment workflows."}
        </p>

      </div>

    </div>

  );

}

