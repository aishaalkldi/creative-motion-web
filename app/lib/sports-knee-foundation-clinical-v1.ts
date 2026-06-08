/**
 * RASQ Sports Knee Foundation — clinical content v1 (code-first, no database).
 * Seven foundation exercises with bilingual patient-safe copy.
 * Merged into Exercise Library v1 from exercise-library-v1.ts (no circular import).
 */

import { isPatientCvCaptureWired } from "@/app/lib/cv/cv-patient-config";

export const SPORTS_KNEE_FOUNDATION_EXERCISE_IDS = [
  "sit-to-stand",
  "mini-squat",
  "single-leg-stance",
  "heel-raise",
  "functional-reach",
  "lateral-step",
  "step-up",
] as const;

export type SportsKneeFoundationExerciseId =
  (typeof SPORTS_KNEE_FOUNDATION_EXERCISE_IDS)[number];

/** Structured clinical bundle — maps to ExerciseLibraryEntryV1 fields */
export type SportsKneeFoundationExerciseClinical = {
  exerciseId: SportsKneeFoundationExerciseId;
  nameEn: string;
  nameAr: string;
  clinicalGoal: { en: string; ar: string };
  instructions: { en: string; ar: string };
  safetyWarnings: { en: string; ar: string };
  commonMistakes: { en: string; ar: string };
  defaultDosage: {
    sets: number;
    reps?: number | string;
    durationSec?: number;
    restSec: number;
  };
  supportRequirements: { en: string; ar: string };
  /** Library metadata (impairment, rationale, progression) */
  targetImpairment: string;
  difficultyLevel: 1 | 2 | 3;
  equipment: string[];
  contraindications?: string;
  biomechanicalRationale: string;
  progressionCriteria: string;
  regressionCriteria: string;
  futureCvMeasurementTarget?: string;
  /** Camera-assisted tracking available in patient portal (manual fallback retained). */
  cvAssisted?: boolean;
  whyThisMatters: { en: string; ar: string };
};

/** Candidate Sports Knee exercises that may expose patient-portal CV assist. */
const SPORTS_KNEE_CV_ASSISTED_CANDIDATE_IDS = [
  "sit-to-stand",
  "mini-squat",
  "single-leg-stance",
  "heel-raise",
  "step-up",
  "lateral-step",
  "functional-reach",
] as const satisfies readonly SportsKneeFoundationExerciseId[];

/** Only exercises with dedicated patient capture wiring (not allowlist-only). */
export const SPORTS_KNEE_CV_ASSISTED_EXERCISE_IDS = SPORTS_KNEE_CV_ASSISTED_CANDIDATE_IDS.filter(
  (id) => isPatientCvCaptureWired(id),
);

export const SPORTS_KNEE_FOUNDATION_CLINICAL_V1: SportsKneeFoundationExerciseClinical[] =
  [
    {
      exerciseId: "sit-to-stand",
      nameEn: "Sit-to-Stand",
      nameAr: "الجلوس والوقوف",
      clinicalGoal: {
        en: "Restore controlled sit-to-stand mechanics to improve chair transfers, toilet use, and safe standing tolerance without knee collapse.",
        ar: "استعادة آلية الجلوس والوقوف المتحكّمة لتحسين الانتقال من الكرسي واستخدام المرحاض وتحمّل الوقوف بأمان دون انهيار الركبة.",
      },
      instructions: {
        en: "Sit at the front edge of a sturdy chair, feet flat and hip-width apart. Lean your trunk slightly forward, push through both heels, and stand up fully without using your hands to pull. Lower back to sitting slowly, leading with your hips. Breathe steadily and keep your knees aligned over your second toe.",
        ar: "اجلس على مقدمة كرسي ثابت، قدمان مسطحتان وبعرض الوركين. انحنِ الجذع قليلاً للأمام وادفع بكعبيك للوقوف دون سحب الجسم باليدين. انزل للجلوس ببطء مع تحريك الوركين أولاً. تنفس بانتظام وحافظ على محاذاة الركبتين مع إصبع القدم الثاني.",
      },
      safetyWarnings: {
        en: "Stop if sharp knee pain, locking, giving way, or dizziness occurs. Use chair arms for balance only—not to lift your body weight. Do not hold your breath. Contact your clinician if pain stays above your usual level for more than 24 hours after the session.",
        ar: "توقّف عند ألم حاد في الركبة أو تيبّس أو فقدان ثبات أو دوخة. استخدم ذراعي الكرسي للتوازن فقط وليس لرفع وزن الجسم. لا تحبس النفس. تواصل مع معالجك إذا بقي الألم أعلى من المعتاد لأكثر من 24 ساعة بعد الجلسة.",
      },
      commonMistakes: {
        en: "Pulling up with the arms; rising with knees diving inward; rocking excessively before standing; plopping down without hip control; feet too far under the chair.",
        ar: "السحب بالذراعين؛ الوقوف مع انطواء الركبتين للداخل؛ التأرجح المفرط قبل الوقوف؛ الجلوس بقوة دون تحكم بالورك؛ وضع القدمين بعيداً جداً تحت الكرسي.",
      },
      defaultDosage: { sets: 3, reps: "8–12", restSec: 60 },
      supportRequirements: {
        en: "Sturdy standard-height chair with non-slip feet; clear space in front; optional wall or counter within reach for fingertip balance.",
        ar: "كرسي ثابت بارتفاع قياسي وقاعدة غير زلقة؛ مساحة أمامية خالية؛ حائط أو سطح قريب اختياري لتوازن أطراف الأصابع.",
      },
      targetImpairment: "Sit-to-stand weakness and poor closed-chain control",
      difficultyLevel: 2,
      equipment: ["Sturdy chair"],
      contraindications:
        "Non–weight-bearing status; severe balance impairment without supervision; acute knee effusion with inability to bear load.",
      whyThisMatters: {
        en: "Standing from a chair is essential for independence and builds quadriceps and glute strength for daily life.",
        ar: "الوقوف من الكرسي ضروري للاستقلالية ويقوّي عضلات الفخذ الأمامية والأرداف في الحياة اليومية.",
      },
      biomechanicalRationale:
        "Closed-chain knee extension with forward trunk momentum trains functional quad–glute co-contraction for transfers.",
      progressionCriteria:
        "Ready for clinician progression review when 8–12 controlled reps are completed with stable knee alignment and acceptable post-session soreness.",
      regressionCriteria:
        "Use a higher seat, reduce reps, or allow light hand support if pain or knee valgus increases.",
      futureCvMeasurementTarget: "sit-to-stand symmetry",
      cvAssisted: true,
    },
    {
      exerciseId: "mini-squat",
      nameEn: "Mini Squat (0–45°)",
      nameAr: "قرفصاء صغيرة (0–45°)",
      clinicalGoal: {
        en: "Improve quadriceps and glute control in partial knee flexion for stair negotiation, lifting, and sport-ready loading.",
        ar: "تحسين تحكم عضلات الفخذ الأمامية والأرداف في ثني جزئي للركبة لصعود الدرج والرفع والتحميل الرياضي التدريجي.",
      },
      instructions: {
        en: "Stand with feet shoulder-width apart, toes slightly out. Slowly bend both knees to about 30–45° while keeping your chest tall and weight through your heels and mid-foot. Hold 2 seconds, then straighten without locking the knees harshly. Keep knees tracking over your toes throughout.",
        ar: "قف بقدمين بعرض الكتفين وأصابع قليلاً للخارج. اثنِ الركبتين ببطء إلى نحو 30–45° مع استقامة الصدر ووزن الجسم على الكعبين ومنتصف القدم. ثبّت ثانيتين ثم افرد دون قفل حاد للركبة. حافظ على محاذاة الركبتين مع أصابع القدم.",
      },
      safetyWarnings: {
        en: "Stop if sharp or increasing anterior knee pain, giving way, or swelling within 2 hours of the session. Stay within the depth your clinician approved. Do not bounce at the bottom.",
        ar: "توقّف عند ألم حاد أو متزايد أمام الركبة أو فقدان ثبات أو تورم خلال ساعتين من الجلسة. ابقَ ضمن العمق الذي وافق عليه معالجك. لا تقفز في أسفل الحركة.",
      },
      commonMistakes: {
        en: "Knees collapsing inward; heels lifting off the floor; excessive forward trunk lean; squatting too deep too soon; holding breath at the bottom.",
        ar: "انطواء الركبتين للداخل؛ رفع الكعبين عن الأرض؛ ميل الجذع للأمام بشكل مفرط؛ عمق زائد مبكراً؛ حبس النفس في الأسفل.",
      },
      defaultDosage: { sets: 3, reps: "10–15", restSec: 60 },
      supportRequirements: {
        en: "Level non-slip surface; optional fingertips on wall or counter for balance; space to see full lower body if using optional camera assist elsewhere in RASQ.",
        ar: "سطح مستوٍ غير زلق؛ أطراف أصابع على حائط أو سطح اختياري للتوازن؛ مساحة لرؤية الجزء السفلي عند استخدام الكاميرا الاختيارية.",
      },
      targetImpairment: "Knee control in partial flexion and patellofemoral load tolerance",
      difficultyLevel: 2,
      equipment: [],
      contraindications:
        "Acute patellar instability; weight-bearing restrictions; pain above clinician-cleared activity level.",
      whyThisMatters: {
        en: "Controlled squatting prepares your knee for stairs, lifting, and return-to-training tasks.",
        ar: "القرفصاء المتحكّمة تُعدّ ركبتك للدرج والرفع ومهام العودة للتدريب.",
      },
      biomechanicalRationale:
        "Partial squat loads tibiofemoral and patellofemoral joints within a modifiable range for strength and motor control.",
      progressionCriteria:
        "Ready for clinician progression review when depth and alignment stay consistent for the full prescribed set.",
      regressionCriteria:
        "Reduce depth, use chair support at hips, or decrease reps if valgus or pain increases.",
      futureCvMeasurementTarget: "knee flexion angle, valgus control",
      cvAssisted: true,
    },
    {
      exerciseId: "single-leg-stance",
      nameEn: "Single-Leg Stance",
      nameAr: "الوقوف على رجل واحدة",
      clinicalGoal: {
        en: "Improve single-limb balance, hip–knee–ankle proprioception, and pelvic stability for walking, turning, and sport preparation.",
        ar: "تحسين التوازن على طرف واحد والإحساس الاستقبالي للورك–الركبة–الكاحل وثبات الحوض للمشي والاستدارة والإعداد الرياضي.",
      },
      instructions: {
        en: "Stand near a wall or counter. Lift one foot just off the floor with a slight bend in the stance knee. Keep your hips level and trunk steady. Hold for the prescribed time, then switch sides. Look at a fixed point ahead to help balance.",
        ar: "قف قرب حائط أو سطح. ارفع قدمًا واحدة عن الأرض مع ثني بسيط في ركبة الوقوف. حافظ على مستوى الوركين وثبات الجذع. ثبّت للمدة المحددة ثم بدّل الجانب. انظر إلى نقطة ثابتة أمامك للمساعدة على التوازن.",
      },
      safetyWarnings: {
        en: "Stop if dizziness, sharp joint pain, or repeated loss of balance occurs. Keep support within reach for the full hold. Do not progress hold time without clinician approval.",
        ar: "توقّف عند دوخة أو ألم مفصلي حاد أو فقدان متكرر للتوازن. أبقِ الدعم في متناول اليد طوال الثبات. لا تزيد مدة الثبات دون موافقة المعالج.",
      },
      commonMistakes: {
        en: "Hiking the hip on the lifted side; locking the stance knee fully; leaning far sideways; looking down; holding breath.",
        ar: "رفع الحوض على جانب الرجل المرفوعة؛ قفل ركبة الوقوف بالكامل؛ الميل الشديد جانباً؛ النظر للأسفل؛ حبس النفس.",
      },
      defaultDosage: { sets: 3, durationSec: 30, restSec: 45 },
      supportRequirements: {
        en: "Wall, counter, or sturdy chair back within arm’s reach; flat footwear or bare feet on non-slip floor.",
        ar: "حائط أو سطح أو ظهر كرسي ثابت في متناول اليد؛ حذاء مسطح أو قدمين عاريتين على أرضية غير زلقة.",
      },
      targetImpairment: "Single-leg balance and hip abductor endurance",
      difficultyLevel: 2,
      equipment: ["Wall or chair nearby"],
      contraindications:
        "Severe vestibular symptoms; non–weight-bearing on the stance limb; high fall risk without supervision.",
      whyThisMatters: {
        en: "Balance on one leg is required for walking, changing direction, and safe landing patterns.",
        ar: "التوازن على رجل واحدة مطلوب للمشي وتغيير الاتجاه وأنماط الهبوط الآمنة.",
      },
      biomechanicalRationale:
        "Static single-limb stance challenges hip abductors and ankle strategy with low locomotor demand.",
      progressionCriteria:
        "Ready for clinician progression review when 30 s holds are steady with level pelvis and light or no touch support.",
      regressionCriteria:
        "Reduce hold time, use fingertip support, or perform shorter intervals if hip drop or dizziness occurs.",
      futureCvMeasurementTarget: "balance, hip drop",
      cvAssisted: true,
    },
    {
      exerciseId: "heel-raise",
      nameEn: "Heel Raises (Double)",
      nameAr: "رفع الكعب (ثنائي)",
      clinicalGoal: {
        en: "Build calf endurance and ankle plantarflexor strength for push-off during walking, stairs, and running progression.",
        ar: "بناء تحمل عضلة الساق وقوة ثنائي الفخذ الخلفي للكاحل للدفع أثناء المشي والدرج والتقدم نحو الجري.",
      },
      instructions: {
        en: "Stand tall holding a counter or chair back for balance. Rise onto the balls of both feet as high as comfortable, keeping weight even between feet. Hold 2 seconds at the top, then lower your heels slowly to the floor. Keep ankles straight—do not roll excessively outward or inward.",
        ar: "قف منتصباً ممسكاً بسطح أو ظهر كرسي. ارتفع على مقدمة القدمين بارتفاع مريح مع توزيع الوزن بالتساوي. ثبّت ثانيتين في الأعلى ثم انزل بالكعبين ببطء. حافظ على استقامة الكاحلين دون ميل مفرط.",
      },
      safetyWarnings: {
        en: "Stop if sharp Achilles or calf pain, cramping that does not ease with rest, or balance loss. Avoid bouncing. Progress load only when cleared by your clinician after acute calf or Achilles injury.",
        ar: "توقّف عند ألم حاد في وتر أخيل أو الساق أو تشنج لا يخف بالراحة أو فقدان التوازن. تجنّب الارتداد. زد الحمل فقط بموافقة المعالج بعد إصابة حادة.",
      },
      commonMistakes: {
        en: "Rushing the lowering phase; only partial rise; bending forward at the waist; turning feet out excessively; using arms to pull upward.",
        ar: "الاستعجال في النزول؛ ارتفاع جزئي فقط؛ انحناء الخصر؛ لف القدمين للخارج بشكل مفرط؛ سحب الجسم بالذراعين.",
      },
      defaultDosage: { sets: 3, reps: "12–15", restSec: 45 },
      supportRequirements: {
        en: "Sturdy chair or counter for fingertip balance; level ground; supportive footwear optional.",
        ar: "كرسي أو سطح ثابت لتوازن أطراف الأصابع؛ أرض مستوية؛ حذاء داعم اختياري.",
      },
      targetImpairment: "Calf endurance and ankle plantarflexor weakness",
      difficultyLevel: 1,
      equipment: ["Chair or counter for balance"],
      contraindications:
        "Acute Achilles tendon rupture or repair restrictions; acute calf tear until cleared.",
      whyThisMatters: {
        en: "Strong calves improve push-off for walking, stairs, and later sport activities.",
        ar: "عضلات الساق القوية تحسّن الدفع للمشي والدرج والأنشطة الرياضية لاحقاً.",
      },
      biomechanicalRationale:
        "Bilateral heel raises load gastrocnemius–soleus for propulsion with modifiable support and range.",
      progressionCriteria:
        "Ready for clinician progression review when full set is completed with controlled lowering and stable symptoms.",
      regressionCriteria:
        "Reduce reps, shorten hold, or use bilateral hand support if fatigue or pain increases.",
      futureCvMeasurementTarget: "calf raise height symmetry",
      cvAssisted: true,
    },
    {
      exerciseId: "functional-reach",
      nameEn: "Functional Reach",
      nameAr: "الوصول الوظيفي",
      clinicalGoal: {
        en: "Improve dynamic balance and controlled forward weight transfer while reaching—relevant for dressing, kitchen tasks, and fall-risk reduction.",
        ar: "تحسين التوازن الديناميكي ونقل الوزن الأمامي المتحكم أثناء الوصول—للمهام اليومية وتقليل خطر السقوط.",
      },
      instructions: {
        en: "Stand arm’s length from a wall. Turn the shoulder of your reaching arm slightly away from the wall. Reach forward at shoulder height with a closed fist as far as you can without stepping, lifting the heel, or losing balance. Return to upright. Complete prescribed reaches, then switch arms if directed.",
        ar: "قف على مسافة ذراع من الحائط. أدر كتف الذراع الواصلة قليلاً بعيداً عن الحائط. امتد للأمام على ارتفاع الكتف بقبضة مغلقة بأبعد مدى دون خطوة أو رفع الكعب أو فقدان التوازن. عد للوضع المنتصب. نفّذ العدد المحدد ثم بدّل الذراع إن طُلب.",
      },
      safetyWarnings: {
        en: "Stop if dizziness, near-fall, or sharp knee or back pain occurs. Do not hold your breath. Perform only on a non-slip surface with support available.",
        ar: "توقّف عند دوخة أو كاد سقوط أو ألم حاد في الركبة أو الظهر. لا تحبس النفس. نفّذ على سطح غير زلق مع دعم متاح.",
      },
      commonMistakes: {
        en: "Taking a step to extend reach; rotating the trunk excessively; reaching above or below shoulder height; holding breath; leaning only from the low back.",
        ar: "خطوة للأمام لزيادة المدى؛ دوران مفرط للجذع؛ وصول فوق أو تحت مستوى الكتف؛ حبس النفس؛ الميل من أسفل الظهر فقط.",
      },
      defaultDosage: { sets: 3, reps: "3 reaches each arm", restSec: 30 },
      supportRequirements: {
        en: "Clear wall space at shoulder height; non-slip floor; optional counter behind you for backup balance.",
        ar: "حائط خالٍ على ارتفاع الكتف؛ أرضية غير زلقة؛ سطح خلفي اختياري للتوازن الاحتياطي.",
      },
      targetImpairment: "Dynamic balance and limits of stability in forward reach",
      difficultyLevel: 2,
      equipment: ["Wall"],
      contraindications:
        "High fall risk without supervision; acute vestibular disorder; severe balance impairment.",
      whyThisMatters: {
        en: "Reach tasks train safe weight shift for daily activities without losing your base of support.",
        ar: "مهام الوصول تدرّب نقل الوزن بأمان للأنشطة اليومية دون فقدان قاعدة الثبات.",
      },
      biomechanicalRationale:
        "Limits-of-stability challenge in sagittal plane with ankle and hip strategy—standard clinical balance measure.",
      progressionCriteria:
        "Ready for clinician progression review when reaches are steady without stepping for all prescribed reps.",
      regressionCriteria:
        "Reduce reach distance, shorten hold, or allow fingertip wall touch if balance is uncertain.",
      futureCvMeasurementTarget: "forward reach excursion",
      cvAssisted: true,
    },
    {
      exerciseId: "lateral-step",
      nameEn: "Lateral Step",
      nameAr: "الخطوة الجانبية",
      clinicalGoal: {
        en: "Develop frontal-plane hip and knee control for side-stepping, court movement prep, and confident weight transfer.",
        ar: "تطوير التحكم الأمامي–الجانبي للورك والركبة للخطوات الجانبية والتحضير الرياضي ونقل الوزن بثقة.",
      },
      instructions: {
        en: "Stand beside a low step or taped line on the floor. Step sideways onto the step with the lead leg, lightly touch the step, then bring the trailing leg to meet. Keep knees slightly bent and trunk upright. Control the landing—do not snap the knee straight. Return the prescribed steps, then lead with the other leg.",
        ar: "قف بجانب درجة منخفضة أو خط على الأرض. خطُ جانباً على الدرجة بالرجل الأمامية بلمسة خفيفة ثم اجمع الرجل الأخرى. أبقِ الركبتين مثنيتين قليلاً والجذع منتصباً. تحكم بالهبوط دون قفل حاد. نفّذ الخطوات المحددة ثم بدّل الرجل القائدة.",
      },
      safetyWarnings: {
        en: "Stop if sharp knee pain, giving way, or ankle roll occurs. Use a stable step (15–20 cm) only. Face a support surface if balance is limited.",
        ar: "توقّف عند ألم حاد أو فقدان ثبات أو انقلاب كاحل. استخدم درجة ثابتة (15–20 سم) فقط. واجه سطح دعم إذا كان التوازن محدوداً.",
      },
      commonMistakes: {
        en: "Step height too high; stiff landing with straight knee; trunk lean away from step; rushing step rate; crossing feet instead of true lateral step.",
        ar: "ارتفاع زائد للدرجة؛ هبوط جامد مع ركبة مستقيمة؛ ميل الجذع؛ استعجال الإيقاع؛ تداخل القدمين بدل خطوة جانبية حقيقية.",
      },
      defaultDosage: { sets: 3, reps: "10 steps each direction", restSec: 60 },
      supportRequirements: {
        en: "Low step 15–20 cm or floor line; counter or wall in front for fingertip balance; non-slip surface.",
        ar: "درجة منخفضة 15–20 سم أو خط أرضي؛ سطح أو حائط أمامي لتوازن الأصابع؛ سطح غير زلق.",
      },
      targetImpairment: "Frontal-plane step control and hip abductor loading",
      difficultyLevel: 2,
      equipment: ["Low step 15–20 cm or floor marker"],
      contraindications:
        "Acute lateral ankle sprain; knee instability with lateral giving way; non–weight-bearing orders.",
      whyThisMatters: {
        en: "Side stepping builds control needed for daily avoidance movements and later multidirectional sport tasks.",
        ar: "الخطوة الجانبية تبني التحكم اللازم للحركة اليومية والمهام الرياضية متعددة الاتجاهات لاحقاً.",
      },
      biomechanicalRationale:
        "Controlled lateral step-up/down loads hip abductors and knee in frontal plane with modifiable step height.",
      progressionCriteria:
        "Ready for clinician progression review when step height and step count are tolerated with level pelvis.",
      regressionCriteria:
        "Floor-level side steps only, reduce reps, or use hand support if valgus or pain increases.",
      futureCvMeasurementTarget: "lateral step count, knee valgus",
      cvAssisted: true,
    },
    {
      exerciseId: "step-up",
      nameEn: "Low Step-Up",
      nameAr: "صعود درجة منخفضة",
      clinicalGoal: {
        en: "Build unilateral closed-chain strength and confidence for stairs, curbs, and return-to-training step tasks.",
        ar: "بناء قوة السلسلة المغلقة أحادية الطرف وثقة لصعود الدرج والرصيف ومهام الخطوة الرياضية.",
      },
      instructions: {
        en: "Face a sturdy step (15–20 cm). Place your entire foot on the step. Press through the heel of the leading leg to rise until the knee straightens comfortably. Bring the trailing foot up to the step. Step down slowly with the same leg leading, controlling the descent. Keep your trunk tall and knee aligned over the foot.",
        ar: "واجه درجة ثابتة (15–20 سم). ضع القدم كاملة على الدرجة. ادفع بكعب الرجل الأمامية للصعود حتى يمتد الركبة بشكل مريح. اجمع القدم الأخرى على الدرجة. انزل ببطء بنفس الرجل مع تحكم بالنزول. حافظ على استقامة الجذع ومحاذاة الركبة فوق القدم.",
      },
      safetyWarnings: {
        en: "Stop if sharp knee pain, giving way, or instability on the step. Ensure the step will not slide. Use a handrail or counter if provided in your plan. Alternate legs as prescribed.",
        ar: "توقّف عند ألم حاد أو فقدان ثبات على الدرجة. تأكد أن الدرجة لن تنزلق. استخدم درابزين أو سطحاً إن وُجد في خطتك. بدّل الساقين حسب الوصفة.",
      },
      commonMistakes: {
        en: "Pushing off excessively from the back foot; knee collapsing inward on ascent; leaning far forward; step too high; uncontrolled drop on descent.",
        ar: "الدفع الزائد بالقدم الخلفية؛ انطواء الركبة للداخل عند الصعود؛ ميل مفرط للأمام؛ درجة عالية جداً؛ نزول غير متحكم.",
      },
      defaultDosage: { sets: 3, reps: "8–10 each leg", restSec: 60 },
      supportRequirements: {
        en: "Stable step 15–20 cm with non-slip surface; optional handrail or counter; space to step down safely behind the step.",
        ar: "درجة ثابتة 15–20 سم غير زلقة؛ درابزين أو سطح اختياري؛ مساحة آمنة للنزول خلف الدرجة.",
      },
      targetImpairment: "Step-up strength, eccentric control, and knee alignment under load",
      difficultyLevel: 2,
      equipment: ["Step 15–20 cm"],
      contraindications:
        "Non–weight-bearing status; unsteady gait without assistive device clearance; acute knee effusion limiting load.",
      whyThisMatters: {
        en: "Step-ups replicate stair climbing and build the leg strength needed for daily and sport activities.",
        ar: "صعود الدرجة يحاكي السلالم ويبني قوة الساق للأنشطة اليومية والرياضية.",
      },
      biomechanicalRationale:
        "Unilateral closed-chain concentric–eccentric loading mimics stair ascent with adjustable step height.",
      progressionCriteria:
        "Ready for clinician progression review when step height and reps are completed with good knee alignment bilaterally.",
      regressionCriteria:
        "Lower step height, reduce reps, or use hand support if pain or valgus increases.",
      futureCvMeasurementTarget: "step height, knee valgus",
      cvAssisted: true,
    },
  ];

/** Example export for review / docs (Sit-to-Stand) */
export function sportsKneeFoundationExampleJson(): SportsKneeFoundationExerciseClinical {
  return SPORTS_KNEE_FOUNDATION_CLINICAL_V1[0];
}
