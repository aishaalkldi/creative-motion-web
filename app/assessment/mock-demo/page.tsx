"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import MockCameraCapture from "@/app/components/patient/MockCameraCapture";
import { useGlobalLanguage } from "@/app/components/GlobalLanguageProvider";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, CartesianGrid as LineGrid,
  ResponsiveContainer, Cell,
} from "recharts";

const MOCK_ASSESSMENTS = [
  {
    id: "sit-to-stand",
    title: "Sit-to-Stand",
    titleAr: "الوقوف من الجلوس",
    description: "Stand up from a chair 5 times at your own pace",
    descriptionAr: "قُم من الكرسي 5 مرات بالوتيرة المناسبة لك",
    instructions: [
      "Sit in a sturdy chair with your back against the chair",
      "Your feet should be flat on the ground about shoulder-width apart",
      "Cross your arms over your chest",
      "Stand up and sit down as quickly as possible for 5 repetitions",
      "The timer will start when you stand for the first time",
    ],
    instructionsAr: [
      "اجلس على كرسي ثابت مع إسناد ظهرك إلى الكرسي",
      "ضع قدميك على الأرض بمسافة تقارب عرض الكتفين",
      "ضع ذراعيك متقاطعتين على صدرك",
      "قُم واجلس أسرع ما يمكن لمدة 5 مرات",
      "سيبدأ المؤقت عند أول مرة تقف فيها",
    ],
    icon: "🪑",
    difficulty: "Easy",
    difficultyAr: "سهل",
    // Mock scores that will be shown in the report
    scoreLabel: "Reps Completed",
    scoreLabelAr: "عدد التكرارات المكتملة",
    scoreValue: 5,
    scoreMax: 5,
    scoreUnit: "reps",
    benchmark: "5 reps (normal)",
    benchmarkAr: "5 تكرارات (طبيعي)",
    status: "Normal",
    statusAr: "طبيعي",
    tip: "You completed all 5 repetitions. Keep practising to improve your speed.",
    tipAr: "أكملت جميع التكرارات الخمسة. واصل التدريب لتحسين السرعة.",
  },
  {
    id: "single-leg-stance",
    title: "Single-Leg Stance",
    titleAr: "الوقوف على ساق واحدة",
    description: "Stand on one leg for as long as you can",
    descriptionAr: "قف على ساق واحدة لأطول مدة ممكنة",
    instructions: [
      "Stand on one leg while keeping the other leg raised",
      "You can hold onto something for balance if needed",
      "Try to maintain this position for up to 30 seconds",
      "If you need to put your foot down, that marks the end of the test",
      "We'll test both legs",
    ],
    instructionsAr: [
      "قف على ساق واحدة مع رفع الساق الأخرى",
      "يمكنك التمسك بشيء للتوازن إذا احتجت",
      "حاول الحفاظ على هذه الوضعية لمدة تصل إلى 30 ثانية",
      "إذا وضعت قدمك على الأرض فسينتهي الاختبار",
      "سنختبر الساقين معًا",
    ],
    icon: "🧍",
    difficulty: "Medium",
    difficultyAr: "متوسط",
    scoreLabel: "Balance Duration",
    scoreLabelAr: "مدة التوازن",
    scoreValue: 18,
    scoreMax: 30,
    scoreUnit: "sec",
    benchmark: "≥ 20 sec (normal)",
    benchmarkAr: "20 ثانية أو أكثر (طبيعي)",
    status: "Below Normal",
    statusAr: "أقل من الطبيعي",
    tip: "Balance duration is slightly below the target. Daily balance exercises will help improve this.",
    tipAr: "مدة التوازن أقل قليلًا من الهدف. تمارين التوازن اليومية ستساعد على التحسن.",
  },
  {
    id: "functional-reach",
    title: "Functional Reach",
    titleAr: "الوصول الوظيفي",
    description: "Reach forward as far as you can without losing your balance",
    descriptionAr: "امتد للأمام لأقصى مسافة ممكنة دون فقدان توازنك",
    instructions: [
      "Stand with your feet shoulder-width apart",
      "Extend your dominant arm to shoulder height",
      "Reach forward as far as you can without stepping forward",
      "We'll measure the distance you reached",
      "Try this 3 times and we'll take the best result",
    ],
    instructionsAr: [
      "قف وقدماك بمسافة عرض الكتفين",
      "مد ذراعك المهيمنة حتى مستوى الكتف",
      "امتد للأمام لأقصى مسافة ممكنة دون أن تخطو للأمام",
      "سنقيس المسافة التي وصلت إليها",
      "حاول 3 مرات وسنأخذ أفضل نتيجة",
    ],
    icon: "🙌",
    difficulty: "Medium",
    difficultyAr: "متوسط",
    scoreLabel: "Reach Distance",
    scoreLabelAr: "مسافة الوصول",
    scoreValue: 28,
    scoreMax: 35,
    scoreUnit: "cm",
    benchmark: "≥ 25 cm (normal)",
    benchmarkAr: "25 سم أو أكثر (طبيعي)",
    status: "Normal",
    statusAr: "طبيعي",
    tip: "Good reach distance. Core strengthening exercises can help you reach even further.",
    tipAr: "مسافة وصول جيدة. تمارين تقوية الجذع قد تساعدك على الوصول أبعد.",
  },
  {
    id: "timed-up-and-go",
    title: "Timed Up and Go",
    titleAr: "الوقوف والمشي والعودة",
    description: "Stand up, walk 10 feet, and sit back down",
    descriptionAr: "قُم، امشِ 10 أقدام، ثم اجلس مرة أخرى",
    instructions: [
      "Start in a seated position in a sturdy chair",
      "When ready, stand up and walk 10 feet at a normal pace",
      "Turn around and walk back to the chair",
      "Sit back down in the chair",
      "We'll time how long this takes you",
    ],
    instructionsAr: [
      "ابدأ وأنت جالس على كرسي ثابت",
      "عندما تكون جاهزًا، قف وامشِ 10 أقدام بوتيرة طبيعية",
      "استدر وارجع إلى الكرسي",
      "اجلس مرة أخرى على الكرسي",
      "سنقيس الوقت الذي تستغرقه",
    ],
    icon: "🚶",
    difficulty: "Medium",
    difficultyAr: "متوسط",
    scoreLabel: "Completion Time",
    scoreLabelAr: "وقت الإكمال",
    scoreValue: 11,
    scoreMax: 20,
    scoreUnit: "sec",
    benchmark: "< 12 sec (normal)",
    benchmarkAr: "أقل من 12 ثانية (طبيعي)",
    status: "Normal",
    statusAr: "طبيعي",
    tip: "Excellent time! You are within the normal range for mobility and fall risk.",
    tipAr: "وقت ممتاز! أنت ضمن النطاق الطبيعي للحركة وخطر السقوط.",
  },
];

export default function MockAssessmentPage() {
  const { language } = useGlobalLanguage();
  const isArabic = language === "ar";
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState<boolean[]>([false, false, false, false]);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [restDone, setRestDone] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveCue, setLiveCue] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const lastLiveCueSpokenRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  const ui = {
    title: isArabic ? "جلسة التقييم التجريبية" : "Assessment Session",
    subtitle: isArabic ? "التقييم التجريبي" : "Mock Assessment",
    progressSuffix: isArabic ? "مكتمل" : "complete",
    report: {
      completeTitle: isArabic ? "اكتمل التقييم!" : "Assessment Complete!",
      completeSubtitle: isArabic ? "رائع! إليك ملخص الأداء الخاص بك." : "Great job! Here is your performance summary.",
      completedOn: isArabic ? "اكتمل بتاريخ" : "Completed on",
      progressTitle: isArabic ? "مخطط التقدم" : "Progress Chart",
      progressIntro: isArabic ? "التقدم عبر التقييمات الأربعة في الجلسة" : "Progress across the four assessments in this session",
      progressLabel: isArabic ? "التقدم المكتمل" : "Completion Progress",
      progressNote: isArabic ? "كل خطوة تمثل تقييمًا واحدًا مكتملًا" : "Each step represents one completed assessment",
      performanceOverview: isArabic ? "نظرة عامة على الأداء" : "Performance Overview",
      performanceIntro: isArabic ? "النتيجة مقابل المعيار عبر جميع التقييمات" : "Score vs benchmark across all assessments",
      scoreBreakdown: isArabic ? "تفصيل الدرجات" : "Score Breakdown",
      scoreBreakdownIntro: isArabic ? "النسبة المئوية من المعيار لكل اختبار" : "Percentage of benchmark reached per test",
      detailedResults: isArabic ? "النتائج التفصيلية" : "Detailed Results",
      overallSummary: isArabic ? "الملخص العام" : "Overall Summary",
      testsCompleted: isArabic ? "الاختبارات المكتملة" : "Tests Completed",
      inNormalRange: isArabic ? "ضمن النطاق الطبيعي" : "In Normal Range",
      needsAttention: isArabic ? "يحتاج إلى انتباه" : "Needs Attention",
      totalScore: isArabic ? "إجمالي الدرجة" : "Total Score",
      bestResult: isArabic ? "أفضل نتيجة" : "Best Result",
      sessionStatus: isArabic ? "حالة الجلسة" : "Session Status",
      sessionStrong: isArabic ? "أداء جيد" : "Strong session",
      sessionStable: isArabic ? "جلسة ثابتة" : "Stable session",
      yourScore: isArabic ? "نتيجتك" : "Your score",
      benchmark: isArabic ? "المعيار" : "Benchmark",
      normal: isArabic ? "طبيعي" : "Normal",
      belowNormal: isArabic ? "أقل من الطبيعي" : "Below Normal",
      focusTitle: isArabic ? "ما الذي نركز عليه بعد ذلك؟" : "What to focus on next?",
      focusBody: isArabic
        ? "الحفاظ على التوازن وتمارين القوة الخفيفة يمكن أن يدعم التحسن في الاختبارات المقبلة."
        : "Balance maintenance and light strengthening can support improvement in future tests.",
      disclaimer: isArabic
        ? "هذا تقييم تجريبي لأغراض العرض فقط. النتائج محاكاة ولا تعكس القياسات السريرية الحقيقية. تواصل مع العيادة للحصول على تقييم رسمي."
        : "This is a mock assessment for demonstration purposes. Results are simulated and do not reflect real clinical measurements. Contact your clinic for an official assessment.",
      backHome: isArabic ? "العودة إلى الصفحة الرئيسية" : "Back to Home",
      printReport: isArabic ? "طباعة التقرير" : "Print Report",
    },
    rest: {
      greatProgress: isArabic ? "تقدم رائع!" : "Great Progress!",
      message: isArabic ? "أكملت تقييمين. خذ لحظة للراحة." : "You've completed 2 assessments. Take a moment to rest.",
      remaining: isArabic ? "الوقت المتبقي للراحة" : "Rest time remaining",
      whileRest: isArabic ? "أثناء الراحة:" : "While you rest:",
      water: isArabic ? "اشرب بضع رشفات من الماء" : "Take a few sips of water",
      breathe: isArabic ? "قم ببعض التنفس العميق" : "Do some deep breathing",
      stretch: isArabic ? "قم بتمدد لطيف إذا كان مريحًا" : "Stretch gently if comfortable",
      continue: isArabic ? "الانتقال إلى التقييم التالي" : "Continue to Next Assessment",
      autoContinue: isArabic ? "سيتم الانتقال تلقائيًا بعد فترة الراحة" : "You'll automatically continue after the rest period",
      skipRest: isArabic ? "تخطي الراحة (للتطوير فقط)" : "Skip rest (dev only)",
    },
    assessment: {
      voiceOn: isArabic ? "الصوت مفعل" : "Voice ON",
      voiceOff: isArabic ? "الصوت متوقف" : "Voice OFF",
      repeatVoice: isArabic ? "إعادة التعليمات صوتيًا" : "Repeat Voice",
      voiceLoading: isArabic ? "جارٍ تحميل الصوت..." : "Voice loading...",
      voiceReady: isArabic ? "الصوت جاهز" : "Voice ready",
      voiceNotSupported: isArabic ? "الصوت غير مدعوم في هذا المتصفح" : "Voice not supported in this browser",
      liveCoach: isArabic ? "الموجه المباشر:" : "Live coach:",
      howToPerform: isArabic ? "كيفية أداء هذا التقييم:" : "How to perform this assessment:",
      safetyTitle: isArabic ? "تنبيه السلامة" : "Safety Notice",
      safetyBody: isArabic
        ? "قم بكل تقييم في بيئة آمنة. توقف فورًا إذا شعرت بألم أو دوار أو ضيق في التنفس. إذا كنت في المنزل، فتأكد من وجود شخص قريب."
        : "Perform each assessment in a safe environment. Stop immediately if you experience pain, dizziness, or shortness of breath. If performing at home, ensure someone is nearby.",
      previous: isArabic ? "السابق" : "Previous",
      completeAssessment: isArabic ? "إكمال التقييم" : "Complete Assessment",
      nextAssessment: isArabic ? "التقييم التالي" : "Next Assessment",
      assessmentComplete: isArabic ? "اكتمل التقييم" : "Assessment Complete",
      sequence: isArabic ? "تسلسل التقييمات" : "Assessment Sequence",
    },
    common: {
      loading: isArabic ? "جاري التشغيل..." : "Starting camera…",
      allowCamera: isArabic ? "يرجى السماح بالوصول إلى الكاميرا عند الطلب" : "Please allow camera access when prompted",
      targetGuide: isArabic ? "دليل الوصول باليد" : "Hand Reach Guide",
      targetComplete: isArabic ? "اكتملت الأهداف" : "Targets complete",
      reachPoint: isArabic ? "صل إلى العملة المضيئة" : "Reach the glowing coin",
    },
  };

  const assessmentTitle = (assessment = currentAssessment) => (isArabic ? assessment.titleAr : assessment.title);
  const assessmentDescription = (assessment = currentAssessment) => (isArabic ? assessment.descriptionAr : assessment.description);
  const assessmentInstructions = (assessment = currentAssessment) => (isArabic ? assessment.instructionsAr : assessment.instructions);
  const assessmentDifficulty = (assessment = currentAssessment) => (isArabic ? assessment.difficultyAr : assessment.difficulty);
  const assessmentScoreLabel = (assessment = currentAssessment) => (isArabic ? assessment.scoreLabelAr : assessment.scoreLabel);
  const assessmentBenchmark = (assessment = currentAssessment) => (isArabic ? assessment.benchmarkAr : assessment.benchmark);
  const assessmentStatus = (assessment = currentAssessment) => (isArabic ? assessment.statusAr : assessment.status);
  const assessmentTip = (assessment = currentAssessment) => (isArabic ? assessment.tipAr : assessment.tip);
  const assessmentShortLabel = (assessment: typeof MOCK_ASSESSMENTS[number]) =>
    isArabic ? assessment.titleAr.split(" ")[0] : assessment.title.split(" ")[0];

  // Check if we should show rest page (after 2 assessments)
  const completedCount = completed.filter((c) => c).length;
  const showRestPage = completedCount === 2 && !restDone;

  // Initialize rest timer when entering rest page
  useEffect(() => {
    if (showRestPage && restTimeRemaining === 0) {
      setRestTimeRemaining(120); // 2 minutes in seconds
    }
  }, [showRestPage]);

  // Rest timer effect
  useEffect(() => {
    if (!showRestPage || restTimeRemaining <= 0) return;

    const timer = setInterval(() => {
      setRestTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showRestPage, restTimeRemaining]);

  // Auto-continue when rest time expires
  useEffect(() => {
    if (showRestPage && restTimeRemaining === 0 && completedCount === 2) {
      const timer = setTimeout(() => {
        setRestDone(true);
        setCurrentIndex(2);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [restTimeRemaining, showRestPage, completedCount]);

  const currentAssessment = MOCK_ASSESSMENTS[currentIndex];
  const progress = Math.round(((currentIndex + (completed[currentIndex] ? 1 : 0)) / MOCK_ASSESSMENTS.length) * 100);

  const handleCompleteAssessment = () => {
    const newCompleted = [...completed];
    newCompleted[currentIndex] = true;
    setCompleted(newCompleted);

    // Check if this is the 2nd completed assessment
    if (newCompleted.filter((c) => c).length === 2) {
      // Don't auto-advance, show rest page instead
      return;
    }

    if (currentIndex < MOCK_ASSESSMENTS.length - 1) {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
      }, 500);
    }
  };

  const handleContinueAfterRest = () => {
    setRestDone(true);
    setCurrentIndex(2); // Move to 3rd assessment
  };

  const handleNext = () => {
    if (currentIndex < MOCK_ASSESSMENTS.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const allCompleted = completed.every((c) => c);
  const completionProgressData = MOCK_ASSESSMENTS.map((assessment, index) => ({
    step: index + 1,
    name: assessmentShortLabel(assessment),
    progress: Math.round(((index + 1) / MOCK_ASSESSMENTS.length) * 100),
    score: Math.round((assessment.scoreValue / assessment.scoreMax) * 100),
  }));
  const totalScorePercent = Math.round(
    MOCK_ASSESSMENTS.reduce((sum, assessment) => sum + assessment.scoreValue / assessment.scoreMax, 0) /
      MOCK_ASSESSMENTS.length *
      100
  );
  const bestAssessment = MOCK_ASSESSMENTS.reduce((best, assessment) =>
    assessment.scoreValue / assessment.scoreMax > best.scoreValue / best.scoreMax ? assessment : best
  , MOCK_ASSESSMENTS[0]);
  const normalCount = MOCK_ASSESSMENTS.filter((assessment) => assessment.status === "Normal").length;

  useEffect(() => {
    setIsClient(true);
    setSpeechSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const stopSpeech = () => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const speak = (text: string) => {
    if (!speechSupported || !voiceEnabled || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isArabic ? "ar-SA" : "en-US";
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!speechSupported || !voiceEnabled) {
      stopSpeech();
      return;
    }

    const timer = window.setTimeout(() => {
      if (allCompleted) {
        speak(isArabic
          ? "عمل ممتاز. لقد أكملت جميع التقييمات الأربعة. تقريرك جاهز الآن."
          : "Excellent work. You have completed all four assessments. Your report is now ready.");
        return;
      }

      if (showRestPage) {
        speak(isArabic
          ? "لقد أكملت تقييمين. يرجى الراحة لمدة دقيقتين. تنفس بعمق واشرب الماء إذا احتجت."
          : "You have completed two assessments. Please rest for two minutes. Breathe deeply and drink water if needed.");
        return;
      }

      const stepLabel = isArabic ? "الخطوة" : "Step";
      const steps = assessmentInstructions(currentAssessment)
        .map((step, index) => `${stepLabel} ${index + 1}. ${step}.`)
        .join(" ");
      speak(`${isArabic ? "نبدأ الآن" : "Now starting"} ${assessmentTitle(currentAssessment)}. ${assessmentDescription(currentAssessment)}. ${steps}`);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [allCompleted, showRestPage, currentAssessment, voiceEnabled, speechSupported]);

  useEffect(() => {
    if (!speechSupported || !voiceEnabled || !liveCue.trim()) return;
    if (isSpeaking) return;
    const now = Date.now();
    const repeatedSoon =
      liveCue === lastLiveCueSpokenRef.current.text &&
      now - lastLiveCueSpokenRef.current.at < 5000;
    const globallyTooSoon = now - lastLiveCueSpokenRef.current.at < 2000;
    if (repeatedSoon || globallyTooSoon) return;
    lastLiveCueSpokenRef.current = { text: liveCue, at: now };
    speak(liveCue);
  }, [isSpeaking, liveCue, speechSupported, voiceEnabled]);

  useEffect(() => {
    return () => {
      if (speechSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [speechSupported]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F4F6F5] to-white" dir={isArabic ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#d1dbd6] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-[#f0f7f4] p-2 text-[#1D9E75] hover:bg-[#e8f3ef]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6b9080]">{ui.subtitle}</p>
              <h1 className="text-lg font-bold text-[#0f2e22]">{ui.title}</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-[#1D9E75]">{currentIndex + 1} / {MOCK_ASSESSMENTS.length}</p>
            <p className="text-xs text-[#6b9080]">{progress}% {ui.progressSuffix}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-[#e4ece8]">
          <div
            className="h-full bg-[#1D9E75] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-6 py-12">
        {allCompleted ? (
          /* ── FULL REPORT ── */
          <div className="space-y-8">
            {/* Hero banner */}
            <div className="rounded-[20px] bg-gradient-to-br from-[#1D9E75] to-[#0f6a4e] p-8 text-center text-white shadow-lg">
              <div className="mb-3 text-6xl">🎉</div>
              <h2 className="text-3xl font-bold">{ui.report.completeTitle}</h2>
              <p className="mt-2 text-lg opacity-90">{ui.report.completeSubtitle}</p>
              <p className="mt-1 text-sm opacity-70">
                {ui.report.completedOn} {new Date().toLocaleDateString(isArabic ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>

            {/* Summary metrics */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[16px] border border-[#d1dbd6] bg-white p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b9080]">{ui.report.totalScore}</p>
                <p className="mt-2 text-3xl font-bold text-[#1D9E75]">{totalScorePercent}%</p>
                <p className="mt-1 text-xs text-[#6b9080]">{ui.report.sessionStrong}</p>
              </div>
              <div className="rounded-[16px] border border-[#d1dbd6] bg-white p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b9080]">{ui.report.testsCompleted}</p>
                <p className="mt-2 text-3xl font-bold text-[#1D9E75]">4/4</p>
                <p className="mt-1 text-xs text-[#6b9080]">{ui.report.sessionStatus}</p>
              </div>
              <div className="rounded-[16px] border border-[#d1dbd6] bg-white p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b9080]">{ui.report.bestResult}</p>
                <p className="mt-2 text-2xl font-bold text-[#0f2e22]">{assessmentTitle(bestAssessment)}</p>
                <p className="mt-1 text-xs text-[#6b9080]">{Math.round((bestAssessment.scoreValue / bestAssessment.scoreMax) * 100)}% {ui.report.yourScore}</p>
              </div>
              <div className="rounded-[16px] border border-[#d1dbd6] bg-white p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b9080]">{ui.report.sessionStatus}</p>
                <p className="mt-2 text-2xl font-bold text-[#1D9E75]">{normalCount}/4</p>
                <p className="mt-1 text-xs text-[#6b9080]">{ui.report.inNormalRange}</p>
              </div>
            </div>

            {/* Charts row */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Progress chart */}
              <div className="rounded-[16px] border border-[#d1dbd6] bg-white p-6 lg:col-span-1">
                <h3 className="mb-1 text-base font-bold text-[#0f2e22]">{ui.report.progressTitle}</h3>
                <p className="mb-4 text-xs text-[#6b9080]">{ui.report.progressIntro}</p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={completionProgressData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <LineGrid strokeDasharray="3 3" stroke="#e4ece8" vertical={false} />
                  <XAxis dataKey="step" tick={{ fill: "#6b9080", fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#9db0a3", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    formatter={(v, name) => [`${v}%`, name === "progress" ? ui.report.progressLabel : ui.report.yourScore]}
                    labelFormatter={(label) => `${isArabic ? "الخطوة" : "Step"} ${label}`}
                    contentStyle={{ borderRadius: 10, border: "1px solid #d1dbd6", fontSize: 13 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="progress"
                    stroke="#1D9E75"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#1D9E75" }}
                    activeDot={{ r: 6 }}
                    name={ui.report.progressLabel}
                  />
                  </LineChart>
                </ResponsiveContainer>
                <p className="mt-2 text-[11px] text-[#9db0a3]">{ui.report.progressNote}</p>
              </div>

              {/* Radar chart — overall shape */}
              <div className="rounded-[16px] border border-[#d1dbd6] bg-white p-6 lg:col-span-1">
                <h3 className="mb-1 text-base font-bold text-[#0f2e22]">{ui.report.performanceOverview}</h3>
                <p className="mb-4 text-xs text-[#6b9080]">{ui.report.performanceIntro}</p>
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={MOCK_ASSESSMENTS.map((a) => ({
                  name: assessmentShortLabel(a),
                  score: Math.round((a.scoreValue / a.scoreMax) * 100),
                  benchmark: 80,
                  }))}>
                  <PolarGrid stroke="#e4ece8" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: "#6b9080", fontSize: 12, fontWeight: 600 }} />
                  <Radar name={ui.report.yourScore} dataKey="score" stroke="#1D9E75" fill="#1D9E75" fillOpacity={0.35} strokeWidth={2} />
                  <Radar name={ui.report.benchmark} dataKey="benchmark" stroke="#9db0a3" fill="#9db0a3" fillOpacity={0.15} strokeDasharray="4 2" strokeWidth={1.5} />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="mt-2 flex justify-center gap-6">
                  <span className="flex items-center gap-1.5 text-xs text-[#6b9080]"><span className="inline-block h-2 w-4 rounded-full bg-[#1D9E75]" />{ui.report.yourScore}</span>
                  <span className="flex items-center gap-1.5 text-xs text-[#6b9080]"><span className="inline-block h-2 w-4 rounded-full bg-[#9db0a3]" />{ui.report.benchmark}</span>
                </div>
              </div>

              {/* Bar chart — per-assessment % */}
              <div className="rounded-[16px] border border-[#d1dbd6] bg-white p-6 lg:col-span-1">
                <h3 className="mb-1 text-base font-bold text-[#0f2e22]">{ui.report.scoreBreakdown}</h3>
                <p className="mb-4 text-xs text-[#6b9080]">{ui.report.scoreBreakdownIntro}</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                  data={MOCK_ASSESSMENTS.map((a) => ({
                    name: assessmentShortLabel(a),
                    score: Math.round((a.scoreValue / a.scoreMax) * 100),
                    status: a.status,
                  }))}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                  >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4ece8" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#6b9080", fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#9db0a3", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    formatter={(v) => [`${v}%`, "Score"]}
                    contentStyle={{ borderRadius: 10, border: "1px solid #d1dbd6", fontSize: 13 }}
                  />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {MOCK_ASSESSMENTS.map((a, i) => (
                      <Cell key={i} fill={a.status === "Normal" ? "#1D9E75" : "#f59e0b"} />
                    ))}
                  </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-2 flex justify-center gap-6">
                  <span className="flex items-center gap-1.5 text-xs text-[#6b9080]"><span className="inline-block h-2 w-2 rounded-full bg-[#1D9E75]" />{ui.report.normal}</span>
                  <span className="flex items-center gap-1.5 text-xs text-[#6b9080]"><span className="inline-block h-2 w-2 rounded-full bg-amber-400" />{ui.report.belowNormal}</span>
                </div>
              </div>
            </div>

            {/* Focus card */}
            <div className="rounded-[16px] border border-[#d1dbd6] bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#0f2e22]">{ui.report.focusTitle}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6b9080]">{ui.report.focusBody}</p>
            </div>

            {/* Per-assessment result cards */}
            <div>
              <h3 className="mb-4 text-lg font-bold text-[#0f2e22]">{ui.report.detailedResults}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {MOCK_ASSESSMENTS.map((a) => {
                  const pct = Math.round((a.scoreValue / a.scoreMax) * 100);
                  const isNormal = a.status === "Normal";
                  return (
                    <div key={a.id} className="rounded-[14px] border border-[#d1dbd6] bg-white p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{a.icon}</span>
                          <div>
                            <p className="font-bold text-[#0f2e22] text-sm">{assessmentTitle(a)}</p>
                            <p className="text-xs text-[#6b9080]">{assessmentScoreLabel(a)}</p>
                          </div>
                        </div>
                        <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${isNormal ? "bg-[#e8f3ef] text-[#1D9E75]" : "bg-amber-50 text-amber-700"}`}>
                          {assessmentStatus(a)}
                        </span>
                      </div>

                      {/* Score bar */}
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-[#6b9080] mb-1">
                          <span>{a.scoreValue} {a.scoreUnit}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-[#e4ece8]">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: isNormal ? "#1D9E75" : "#f59e0b" }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-[#9db0a3]">{isArabic ? "المعيار:" : "Benchmark:"} {assessmentBenchmark(a)}</p>
                      </div>

                      {/* Tip */}
                      <p className="mt-3 text-xs leading-relaxed text-[#6b9080] border-t border-[#e4ece8] pt-3">
                        💡 {assessmentTip(a)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overall summary */}
            <div className="rounded-[16px] border-2 border-[#1D9E75] bg-[#f0f7f4] p-6">
              <h3 className="mb-3 text-base font-bold text-[#0f2e22]">📋 {ui.report.overallSummary}</h3>
              <div className="grid grid-cols-3 divide-x divide-[#d1dbd6] text-center">
                <div className="px-4">
                  <p className="text-3xl font-bold text-[#1D9E75]">4</p>
                  <p className="text-xs text-[#6b9080]">{ui.report.testsCompleted}</p>
                </div>
                <div className="px-4">
                  <p className="text-3xl font-bold text-[#1D9E75]">3</p>
                  <p className="text-xs text-[#6b9080]">{ui.report.inNormalRange}</p>
                </div>
                <div className="px-4">
                  <p className="text-3xl font-bold text-amber-500">1</p>
                  <p className="text-xs text-[#6b9080]">{ui.report.needsAttention}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-[#6b9080]">{ui.report.disclaimer}</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/"
                className="flex-1 rounded-[12px] border-2 border-[#1D9E75] px-6 py-4 text-center font-bold text-[#1D9E75] transition hover:bg-[#f0f7f4]"
              >
                {ui.report.backHome}
              </Link>
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 rounded-[12px] bg-[#1D9E75] px-6 py-4 font-bold text-white transition hover:bg-[#1a8f6a] active:scale-95"
              >
                🖨️ {ui.report.printReport}
              </button>
            </div>
          </div>
        ) : showRestPage ? (
          /* Rest Page */
          <div className="flex flex-col items-center justify-center rounded-[16px] border-2 border-[#1D9E75] bg-gradient-to-b from-[#f0f7f4] to-[#e8f3ef] p-12 text-center min-h-96">
            <div className="mb-6 text-7xl">😊</div>
            <h2 className="text-4xl font-bold text-[#0f2e22] mb-2">{ui.rest.greatProgress}</h2>
            <p className="text-lg text-[#6b9080] mb-8">{ui.rest.message}</p>
            
            {/* Rest Timer */}
            <div className="mb-8">
              <div className="text-7xl font-bold text-[#1D9E75] font-mono tracking-wider">
                {formatTime(restTimeRemaining)}
              </div>
              <p className="mt-4 text-sm text-[#6b9080]">{ui.rest.remaining}</p>
            </div>

            {/* Rest Guidance */}
            <div className="mb-8 max-w-md rounded-[12px] border border-[#d1dbd6] bg-white p-6">
              <h3 className="font-bold text-[#0f2e22] mb-3">{ui.rest.whileRest}</h3>
              <ul className="space-y-2 text-left text-sm text-[#6b9080]">
                <li className="flex gap-2">
                  <span>💧</span>
                  <span>{ui.rest.water}</span>
                </li>
                <li className="flex gap-2">
                  <span>🫁</span>
                  <span>{ui.rest.breathe}</span>
                </li>
                <li className="flex gap-2">
                  <span>🧘</span>
                  <span>{ui.rest.stretch}</span>
                </li>
              </ul>
            </div>

            {/* Manual Continue Button (if timer expires) */}
            {restTimeRemaining === 0 && (
              <button
                onClick={handleContinueAfterRest}
                className="rounded-[12px] bg-[#1D9E75] px-8 py-4 font-bold text-white transition hover:bg-[#1a8f6a] active:scale-95"
              >
                {ui.rest.continue}
              </button>
            )}

            {/* Auto-continue message */}
            {restTimeRemaining > 0 && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-[#6b9080]">{ui.rest.autoContinue}</p>
                {process.env.NODE_ENV === "development" && (
                  <button
                    onClick={handleContinueAfterRest}
                    className="text-xs text-[#9db0a3] underline hover:text-[#1D9E75]"
                  >
                    {ui.rest.skipRest}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Assessment Card */
          <div className="space-y-8">
            {/* Camera Feed */}
            <MockCameraCapture
              isActive={!allCompleted}
              assessmentId={currentAssessment.id}
              onLiveCue={setLiveCue}
            />

            {/* Assessment Info */}
            <div className="rounded-[16px] border border-[#d1dbd6] bg-white p-8">
              <div className="mb-6 flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="text-5xl">{currentAssessment.icon}</div>
                  <div>
                    <h2 className="text-3xl font-bold text-[#0f2e22]">{assessmentTitle(currentAssessment)}</h2>
                    <p className="mt-2 text-lg text-[#6b9080]">{assessmentDescription(currentAssessment)}</p>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="rounded-full bg-[#e8f3ef] px-3 py-1 text-xs font-bold uppercase text-[#1D9E75]">
                        {assessmentDifficulty(currentAssessment)}
                      </span>
                    </div>
                  </div>
                </div>
                {completed[currentIndex] && (
                  <div className="rounded-full bg-[#1D9E75] p-3 text-white">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Voice Guidance Controls */}
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[12px] border border-[#d1dbd6] bg-[#f7faf8] p-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!speechSupported) return;
                    if (voiceEnabled) {
                      stopSpeech();
                    }
                    setVoiceEnabled((prev) => !prev);
                  }}
                  className={`rounded-[10px] px-4 py-2 text-xs font-bold transition ${
                    voiceEnabled
                      ? "bg-[#1D9E75] text-white hover:bg-[#1a8f6a]"
                      : "bg-white text-[#6b9080] border border-[#d1dbd6] hover:border-[#1D9E75]"
                  }`}
                >
                  {voiceEnabled ? ui.assessment.voiceOn : ui.assessment.voiceOff}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!speechSupported) return;
                    const steps = assessmentInstructions(currentAssessment)
                      .map((step, index) => `${isArabic ? "الخطوة" : "Step"} ${index + 1}. ${step}.`)
                      .join(" ");
                    speak(`${isArabic ? "إعادة التعليمات" : "Repeating guidance"}. ${assessmentTitle(currentAssessment)}. ${assessmentDescription(currentAssessment)}. ${steps}`);
                  }}
                  disabled={!isClient || !voiceEnabled || !speechSupported}
                  className="rounded-[10px] border border-[#d1dbd6] bg-white px-4 py-2 text-xs font-bold text-[#1D9E75] transition hover:border-[#1D9E75] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ui.assessment.repeatVoice}
                </button>
                <span className="text-xs font-semibold text-[#6b9080]">
                  {!isClient
                  ? ui.assessment.voiceLoading
                    : speechSupported
                    ? (isSpeaking ? (isArabic ? "جاري التحدث..." : "Speaking now...") : ui.assessment.voiceReady)
                    : ui.assessment.voiceNotSupported}
                </span>
                {liveCue && (
                  <p className="w-full text-xs text-[#1D9E75]">
                    {ui.assessment.liveCoach} {liveCue}
                  </p>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-8">
                <h3 className="mb-4 text-base font-bold text-[#0f2e22]">{ui.assessment.howToPerform}</h3>
                <ol className="space-y-3">
                  {assessmentInstructions(currentAssessment).map((instruction, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#e8f3ef] font-bold text-[#1D9E75]">
                        {i + 1}
                      </span>
                      <span className="text-sm leading-relaxed text-[#6b9080]">{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Safety Notice */}
            <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-3">
                <div className="text-lg">⚠️</div>
                <div>
                  <p className="text-sm font-semibold text-amber-900">{ui.assessment.safetyTitle}</p>
                  <p className="mt-1 text-xs text-amber-800">{ui.assessment.safetyBody}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="flex items-center justify-center gap-2 rounded-[12px] border-2 border-[#d1dbd6] bg-white px-6 py-4 font-bold text-[#6b9080] transition hover:border-[#1D9E75] hover:text-[#1D9E75] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {ui.assessment.previous}
              </button>

              {!completed[currentIndex] ? (
                <button
                  onClick={handleCompleteAssessment}
                  className="flex-1 rounded-[12px] bg-[#1D9E75] px-6 py-4 font-bold text-white transition hover:bg-[#1a8f6a] active:scale-95"
                >
                  {ui.assessment.completeAssessment}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={currentIndex === MOCK_ASSESSMENTS.length - 1}
                  className="flex-1 flex items-center justify-center gap-2 rounded-[12px] bg-[#1D9E75] px-6 py-4 font-bold text-white transition hover:bg-[#1a8f6a] active:scale-95 disabled:bg-[#6b9080]"
                >
                  {currentIndex === MOCK_ASSESSMENTS.length - 1 ? ui.assessment.assessmentComplete : ui.assessment.nextAssessment}
                  {currentIndex !== MOCK_ASSESSMENTS.length - 1 && (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Assessment List Sidebar */}
        <div className="mt-12">
          <h3 className="mb-4 text-base font-bold text-[#0f2e22]">{ui.assessment.sequence}</h3>
          <div className="grid gap-3">
            {MOCK_ASSESSMENTS.map((assessment, i) => (
              <button
                key={assessment.id}
                onClick={() => setCurrentIndex(i)}
                className={`flex items-center gap-3 rounded-[12px] border-2 p-4 text-left transition ${
                  currentIndex === i
                    ? "border-[#1D9E75] bg-[#f0f7f4]"
                    : completed[i]
                      ? "border-[#1D9E75] bg-white"
                      : "border-[#d1dbd6] bg-white hover:border-[#1D9E75]"
                }`}
              >
                <div className={`text-2xl`}>{assessment.icon}</div>
                <div className="flex-1">
                  <p className="font-bold text-[#0f2e22]">{i + 1}. {isArabic ? assessment.titleAr : assessment.title}</p>
                  <p className="text-xs text-[#6b9080]">{isArabic ? assessment.descriptionAr : assessment.description}</p>
                </div>
                {completed[i] && (
                  <div className="rounded-full bg-[#1D9E75] p-1">
                    <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
