/**
 * Single Source of Truth for the Casino El Al3ab Pitch Video Storyboard.
 * Shared across:
 * - Remotion compositions (Main 16:9 EN/AR & Teaser 9:16 EN/AR)
 * - TTS narration generator (video/scripts/generate-audio.mjs)
 * - SRT subtitle exporter (video/scripts/generate-srt.mjs)
 */

export const FPS = 30;

export type VideoLang = 'en' | 'ar';
export type VideoFormat = 'main' | 'teaser';

export interface CaptionCue {
  /** Offset in seconds from the start of the scene */
  offsetSec: number;
  /** Duration in seconds */
  durationSec: number;
  en: string;
  ar: string;
}

export interface SceneSpec {
  id: string;
  act: 'A' | 'B' | 'C' | 'D' | 'E';
  startSec: number;
  durationSec: number;
  entityEn?: string;
  entityAr?: string;
  roleLineEn?: string;
  roleLineAr?: string;
  narrationEn: string;
  narrationAr: string;
  captions: CaptionCue[];
}

export interface RoleRecapCardSpec {
  number: string;
  entityEn: string;
  entityAr: string;
  accent: 'gold' | 'red' | 'blue';
  seesEn: string;
  doesEn: string;
  responsibleEn: string;
  seesAr: string;
  doesAr: string;
  responsibleAr: string;
}

export const MAIN_SCENES: SceneSpec[] = [
  {
    id: 'a1-cold-open',
    act: 'A',
    startSec: 0,
    durationSec: 18,
    narrationEn:
      'Imagine Ramadan night. Seven hundred and twenty players started this tournament. Only two survived. Waiting in the Golden Seat on Final Night is Marwan Serry. This is the live platform built to run the entire championship, from draw to finale.',
    narrationAr:
      'تخيّل ليلة النهائي في رمضان. سبعمية وعشرين لاعب بدأوا البطولة، واتنين بس وصلوا للآخر. واللي مستنّيهم على الكرسي الذهبي… مروان سري. دي المنصة الحقيقية اللي هتدير البطولة كلها من أول قرعة لحد آخر نقطة.',
    captions: [
      {
        offsetSec: 0.4,
        durationSec: 4.5,
        en: '720 players start the Ramadan championship. Only 2 survive.',
        ar: '٧٢٠ لاعب يبدأون بطولة رمضان… واتنين بس يوصلوا للنهائي.',
      },
      {
        offsetSec: 5.0,
        durationSec: 5.5,
        en: 'Waiting in the Golden Seat on Final Night: Marwan Serry.',
        ar: 'واللي مستنّيهم على الكرسي الذهبي ليلة النهائي: مروان سري.',
      },
      {
        offsetSec: 10.6,
        durationSec: 6.4,
        en: 'One live platform built to run the entire show — from draw to finale.',
        ar: 'منصة واحدة حقيقية لإدارة البطولة كلها — من القرعة لحد آخر نقطة.',
      },
    ],
  },
  {
    id: 'b0-bumper',
    act: 'B',
    startSec: 18,
    durationSec: 2,
    narrationEn: '',
    narrationAr: '',
    captions: [],
  },
  {
    id: 'b1-admin-setup',
    act: 'B',
    startSec: 20,
    durationSec: 16,
    entityEn: 'ADMIN',
    entityAr: 'الإدارة',
    roleLineEn: 'Configures rules, draws groups & schedules every table',
    roleLineAr: 'تضبط القواعد، تسحب القرعة، وتجدول كل الطاولات',
    narrationEn:
      'Everything starts with the Admin. Every number is adjustable: seven hundred and twenty players, groups of three, top one advances. One click draws all two hundred and forty groups and auto-schedules every table and judge without conflicts.',
    narrationAr:
      'كل حاجة بتبدأ من الإدارة. كل رقم قابل للتعديل: سبعمية وعشرين لاعب، مجموعات من تلاتة، والأول يتأهل. بضغطة واحدة بتتسحب القرعة، وتتوزع الماتشات على الطاولات والحكام تلقائي من غير أي تعارض.',
    captions: [
      {
        offsetSec: 0.3,
        durationSec: 5.2,
        en: 'Every setting is adjustable: 720 players, groups of 3, top 1 advances.',
        ar: 'كل رقم قابل للتعديل: ٧٢٠ لاعب، مجموعات من ٣، والأول يتأهل.',
      },
      {
        offsetSec: 5.6,
        durationSec: 5.0,
        en: 'Draw 240 numbered groups in one click with manual swaps before kickoff.',
        ar: 'سحب قرعة ٢٤٠ مجموعة بضغطة واحدة مع إمكانية التبديل قبل البداية.',
      },
      {
        offsetSec: 10.7,
        durationSec: 4.8,
        en: 'Auto-scheduler assigns Table #1 and Judge Scorer 1 with zero conflicts.',
        ar: 'الجدولة التلقائية توزع طاولة ١ والحكم بدون أي تعارض مواعيد.',
      },
    ],
  },
  {
    id: 'b2-player-phone',
    act: 'B',
    startSec: 36,
    durationSec: 18,
    entityEn: 'PLAYER',
    entityAr: 'المتسابق',
    roleLineEn: 'Checks table, keeps segments secret & calls the judge',
    roleLineAr: 'يعرف طاولته، بدون تسريب الفقرات، ويتواصل مع الحكم',
    narrationEn:
      'On his phone, the player picks from twenty-four 3D avatars or crops his own photo. He sees his opponent, call time, and Table One — never the upcoming segments, so every game stays a surprise — plus a Judge Help Card in English or Arabic.',
    narrationAr:
      'على موبايله، المتسابق بيختار من أربعة وعشرين أفاتار ثلاثي الأبعاد أو يرفع صورته. بيشوف منافسه، ميعاده، وطاولة رقم واحد — من غير ما يعرف الفقرات علشان تفضل مفاجأة — ومعاه كارت تواصل فوري مع الحكم، بالعربي أو بالإنجليزي.',
    captions: [
      {
        offsetSec: 0.3,
        durationSec: 5.5,
        en: 'Pick from 24 original 3D avatars or upload & square-crop a photo.',
        ar: 'اختار من ٢٤ أفاتار ثلاثي الأبعاد أو ارفع صورتك بقص مربع تلقائي.',
      },
      {
        offsetSec: 5.9,
        durationSec: 6.0,
        en: 'Sees opponent, Table #1, and call time — never upcoming segments.',
        ar: 'بيشوف المنافس وطاولة ١ والميعاد — والفقرات بتفضل مفاجأة بالكامل.',
      },
      {
        offsetSec: 12.0,
        durationSec: 5.5,
        en: 'Need help finding your table? Call or WhatsApp the Judge — EN or Arabic RTL.',
        ar: 'محتاج مساعدة توصل لطاولتك؟ تواصل فوري مع الحكم — عربي وإنجليزي.',
      },
    ],
  },
  {
    id: 'b3-scorer-console',
    act: 'B',
    startSec: 54,
    durationSec: 20,
    entityEn: 'SCORER',
    entityAr: 'الحكم',
    roleLineEn: 'Runs the table with fast, zero-mistake live controls',
    roleLineAr: 'يدير الطاولة بتحكم سريع ومنع الأخطاء',
    narrationEn:
      'At Table One, the Scorer runs a clean 1v1 console. Late player? Tap Contact, and every view is audited. Live play has zero clutter: Buzzed First, plus one, minus one, Yellow and Red cards tracked as real card icons, one-tap Undo, and Mark Absent for walkovers.',
    narrationAr:
      'على طاولة واحد، الحكم شغّال على شاشة تحكم بسيطة وسريعة. لو لاعب اتأخر، بيدوس تواصل وكل عرض بيتسجل في السجل. وفي اللعب: مين داس الجرس الأول، زائد واحد، ناقص واحد، كارت أصفر وكارت أحمر بأيقونات واضحة، تراجع فوري، وتسجيل الغياب.',
    captions: [
      {
        offsetSec: 0.3,
        durationSec: 4.8,
        en: 'Late player? Role-gated Contact dialog — every view logged in Audit.',
        ar: 'لاعب متأخر؟ نافذة تواصل بصلاحية الحكم — وكل عرض يتسجل في السجل.',
      },
      {
        offsetSec: 5.2,
        durationSec: 7.4,
        en: 'Exact 4 controls: +1, −1, Yellow card (−1) & Red card (−2) with card icons.',
        ar: '٤ أزرار واضحة بس: +١، −١، بطاقة صفراء (−١) وحمراء (−٢) بأيقونات.',
      },
      {
        offsetSec: 12.7,
        durationSec: 6.8,
        en: 'Buzzed First, compensating Undo, and Mark Absent for instant walkovers.',
        ar: 'تسجيل الجرس، تراجع بدون حذف السجل، وتسجيل غياب لفوز انسحابي فوري.',
      },
    ],
  },
  {
    id: 'b3b-split-money-shot',
    act: 'B',
    startSec: 74,
    durationSec: 10,
    entityEn: 'LIVE SYNC · 3 SCREENS',
    entityAr: 'تزامن لحظي · ٣ شاشات',
    roleLineEn: 'Scorer taps — Big Screen & Fan View react at the exact same moment',
    roleLineAr: 'ضغطة الحكم تحدّث شاشة القاعة وموبايل الجمهور في نفس اللحظة',
    narrationEn:
      'Watch all three screens at once. One tap from the Scorer — the venue Big Screen and every fan phone react instantaneously.',
    narrationAr:
      'شوف التلات شاشات مع بعض في نفس اللحظة. ضغطة واحدة من الحكم… شاشة المسرح وموبايل الجمهور بيتحدثوا فوراً في نفس الثانية.',
    captions: [
      {
        offsetSec: 0.3,
        durationSec: 4.4,
        en: 'Watch all three screens live at once.',
        ar: 'شوف التلات شاشات في نفس اللحظة.',
      },
      {
        offsetSec: 4.8,
        durationSec: 4.8,
        en: 'One Scorer tap — Big Screen & Fan View react instantaneously.',
        ar: 'ضغطة واحدة من الحكم… شاشة القاعة وموبايل الجمهور يتحدثوا فوراً.',
      },
    ],
  },
  {
    id: 'b4-big-screen',
    act: 'B',
    startSec: 84,
    durationSec: 16,
    entityEn: 'BIG SCREENS',
    entityAr: 'شاشات العرض',
    roleLineEn: 'Broadcasts live drama for the room & stream',
    roleLineAr: 'تنقل حماس البث المباشر للقاعة والجمهور',
    narrationEn:
      'On the venue Big Screens, draws are never allowed. A tied match automatically opens a sudden-death Tie-Breaker — fully mirrored in Arabic RTL — before crowning the winner and updating the live arena leaderboard.',
    narrationAr:
      'وعلى شاشات القاعة، التعادل ممنوع. أول ما النتيجة تتعادل، جولة الحسم الفاصلة بتتفتح تلقائياً — وبواجهة عربية كاملة من اليمين للشمال — لحد ما يتوَّج الفائز وتتحدث لوحة الصدارة قدام الجمهور.',
    captions: [
      {
        offsetSec: 0.3,
        durationSec: 5.5,
        en: 'Draws are forbidden — tied at 3–3 opens Sudden-Death Tie-Breaker #16.',
        ar: 'التعادل ممنوع — التعادل ٣–٣ يفتح جولة الحسم الفاصلة تلقائياً.',
      },
      {
        offsetSec: 5.9,
        durationSec: 4.8,
        en: 'Full Arabic RTL broadcast mirroring — Omar Hassan wins 4–3!',
        ar: 'واجهة عربية كاملة من اليمين للشمال — عمر حسن يفوز ٤–٣!',
      },
      {
        offsetSec: 10.8,
        durationSec: 4.7,
        en: 'Live arena leaderboard with Top-3 Podium & animated rankings.',
        ar: 'لوحة صدارة القاعة المباشرة مع منصة التتويج والترتيب المتحرك.',
      },
    ],
  },
  {
    id: 'b5-fan-view',
    act: 'B',
    startSec: 100,
    durationSec: 12,
    entityEn: 'PUBLIC FAN VIEW',
    entityAr: 'عرض الجمهور',
    roleLineEn: 'Live standings, schedule & 256-slot interactive bracket',
    roleLineAr: 'ترتيب مباشر، جدول المباريات، وشجرة ٢٥٦ مقعد التفاعلية',
    narrationEn:
      'Fans follow every update on phones and laptops: live group standings, the nightly schedule, and an interactive two-hundred-fifty-six-slot knockout bracket with visible BYEs and player-path tracking.',
    narrationAr:
      'والجمهور بيتابع كل جديد من الموبايل واللابتوب: ترتيب المجموعات، جدول الليالي، وشجرة تصفيات تفاعلية لمتين ستة وخمسين مقعد فيها التخطي التلقائي وتتبع مسار أي لاعب.',
    captions: [
      {
        offsetSec: 0.3,
        durationSec: 5.5,
        en: 'Live Group 1 standings & nightly schedule on any phone — zero spoilers.',
        ar: 'ترتيب المجموعة ١ والجدول اليومي على الموبايل — بدون حرق للفقرات.',
      },
      {
        offsetSec: 5.9,
        durationSec: 5.7,
        en: '256-slot zoomable bracket, 16 visible BYEs, minimap & player path.',
        ar: 'شجرة ٢٥٦ مقعد بالزوم والخريطة المصغرة و١٦ تأهل تلقائي وتتبع اللاعب.',
      },
    ],
  },
  {
    id: 'b6-admin-fairness',
    act: 'B',
    startSec: 112,
    durationSec: 18,
    entityEn: 'ADMIN · FAIRNESS',
    entityAr: 'الإدارة · العدالة والتناسق',
    roleLineEn: 'Full audit trail, safe Impact-Preview reverts & 9 integrity checks',
    roleLineAr: 'سجل مراجعة كامل، تراجع بمعاينة الأثر، و٩ فحوصات تناسق',
    narrationEn:
      'Back in Admin, every score and card arrives in order with exact date and time — like Yellow card, minus one. If a mistake happens, reverting it triggers an Impact Preview, then automatically fixes the winner, standings, and bracket — verified by nine integrity checks.',
    narrationAr:
      'وعند الإدارة، كل نقطة وكارت بيوصلوا بالترتيب بالتاريخ والوقت، زي بطاقة صفراء ناقص واحد. ولو حصل خطأ، التراجع عنه بيطلعلك معاينة الأثر الأول، وبعدها بيصحّح الفائز والترتيب والشجرة تلقائياً، وتحت رقابة تسع فحوصات تناسق.',
    captions: [
      {
        offsetSec: 0.3,
        durationSec: 5.5,
        en: 'Timestamped Results Feed & Audit Log — e.g. "Yellow card (−1)".',
        ar: 'سجل النتائج والمراجعة بالتاريخ والوقت — مثل «بطاقة صفراء (−١)».',
      },
      {
        offsetSec: 5.9,
        durationSec: 6.5,
        en: 'Revert triggers Impact Preview → winner, standings & bracket self-correct.',
        ar: 'التراجع يعرض معاينة الأثر ← الفائز والترتيب والشجرة يتصححوا تلقائياً.',
      },
      {
        offsetSec: 12.5,
        durationSec: 5.0,
        en: 'Consistency Check: All 9 automated data-integrity invariants pass.',
        ar: 'فحص التناسق: نجاح جميع الـ ٩ فحوصات لسلامة البيانات بدون أخطاء.',
      },
    ],
  },
  {
    id: 'c1-role-recap',
    act: 'C',
    startSec: 130,
    durationSec: 32,
    narrationEn:
      'Five perspectives, one synchronized system. The Admin configures, audits, and protects tournament integrity. The Scorer delivers fast, mistake-free judging at every table. The Player gets their table and judge help while segments stay a surprise. Big Screens turn every tap into live broadcast drama. And the Public Fan View keeps everyone glued to live groups, schedules, and the bracket.',
    narrationAr:
      'خمس زوايا، ونظام واحد متكامل. الإدارة بتضبط القواعد وتراجع السجل وتحمي عدالة البطولة. الحكم بيدير طاولته بسرعة ودقة بدون أخطاء. المتسابق بيعرف طاولته وحكمه، والفقرات تفضل مفاجأة. شاشات العرض بتحوّل كل ضغطة لحماس تليفزيوني حي. وعرض الجمهور بيخلّي الكل متابع المجموعات والجدول والشجرة لحظة بلحظة.',
    captions: [
      {
        offsetSec: 0.3,
        durationSec: 6.4,
        en: '01 ADMIN — Configures rules, audits everything & guards 9/9 integrity.',
        ar: '٠١ الإدارة — تضبط القواعد وتراجع السجل وتحمي سلامة البطولة.',
      },
      {
        offsetSec: 6.8,
        durationSec: 6.0,
        en: '02 SCORER — Fast, mistake-free 1v1 & 1v1v1 live table officiating.',
        ar: '٠٢ الحكم — تحكيم مباشر سريع ودقيق بدون أخطاء على كل طاولة.',
      },
      {
        offsetSec: 12.9,
        durationSec: 6.0,
        en: '03 PLAYER — Table #, 3D avatar & Judge Help with surprise segments.',
        ar: '٠٣ المتسابق — رقم الطاولة والأفاتار وكارت الحكم بدون تسريب الفقرات.',
      },
      {
        offsetSec: 19.0,
        durationSec: 6.4,
        en: '04 BIG SCREENS — Turns every tap into 10-meter TV broadcast drama.',
        ar: '٠٤ شاشات العرض — تحوّل كل ضغطة لحماس تليفزيوني مباشر في القاعة.',
      },
      {
        offsetSec: 25.5,
        durationSec: 6.0,
        en: '05 PUBLIC FAN VIEW — Live groups, schedule & 256-slot bracket.',
        ar: '٠٥ عرض الجمهور — متابعة المجموعات والجدول وشجرة ٢٥٦ مقعد مباشرة.',
      },
    ],
  },
  {
    id: 'd1-marwan-final',
    act: 'D',
    startSec: 162,
    durationSec: 16,
    entityEn: 'GRAND FINAL · 1v1v1',
    entityAr: 'النهائي الكبير · ٣ لاعبين',
    roleLineEn: '2 surviving finalists + Marwan Serry in the Golden Seat',
    roleLineAr: 'متأهلان + مروان سري على الكرسي الذهبي',
    narrationEn:
      'Every match leads to one unforgettable night: the only three-player showdown in the tournament. Two finalists earn their way through seven hundred and twenty players to face you — Marwan Serry — centered in the Golden Seat.',
    narrationAr:
      'وكل الماتشات دي طريقها واحد: المواجهة الثلاثية الوحيدة في البطولة. اتنين بس يعدّوا من سبعمية وعشرين لاعب، علشان يقفوا قدامك يا مروان — في النص، على الكرسي الذهبي — في ليلة نهائي مش هتتنسي.',
    captions: [
      {
        offsetSec: 0.3,
        durationSec: 5.5,
        en: 'The only 1v1v1 showdown in the tournament — Grand Final Night.',
        ar: 'المواجهة الثلاثية الوحيدة في البطولة — ليلة النهائي الكبير.',
      },
      {
        offsetSec: 5.9,
        durationSec: 5.2,
        en: 'Two surviving finalists face Marwan Serry centered in the Golden Seat.',
        ar: 'متأهلان من أصل ٧٢٠ يواجهون مروان سري على الكرسي الذهبي.',
      },
      {
        offsetSec: 11.2,
        durationSec: 4.4,
        en: 'Special guest participant — excluded from group & player rankings.',
        ar: 'ضيف شرف خاص للنهائي — معزول عن ترتيب المجموعات واللاعبين.',
      },
    ],
  },
  {
    id: 'e1-close-cta',
    act: 'E',
    startSec: 178,
    durationSec: 14,
    entityEn: 'SPONSORSHIP & NEXT STEP',
    entityAr: 'باقات الرعاية والخطوة الجاية',
    roleLineEn: 'Editable placeholder sponsor tiers ready to tailor together',
    roleLineAr: 'باقات رعاية مبدئية قابلة للتخصيص معاً',
    narrationEn:
      'Customizable sponsor tiers are ready to tailor together, from Final Night partner to branded segments. Every date, venue, and package is ready for your stamp. Ready to claim the Golden Seat?',
    narrationAr:
      'وباقات الرعاية جاهزة تتفصّل مع بعض — من شريك ليلة النهائي لراعي الفقرات. المواعيد والمكان والباقات كلها جاهزة لبصمتك. جاهز تاخد مكانك على الكرسي الذهبي؟',
    captions: [
      {
        offsetSec: 0.3,
        durationSec: 6.4,
        en: 'Placeholder Sponsor Tiers ready to customize — zero fixed prices.',
        ar: 'باقات رعاية مبدئية قابلة للتخصيص معاً — بدون أسعار ثابتة.',
      },
      {
        offsetSec: 6.8,
        durationSec: 6.6,
        en: 'Ramadan 2027 (Placeholder) — Ready to claim the Golden Seat?',
        ar: 'رمضان ٢٠٢٧ (مواعيد مبدئية) — جاهز تاخد الكرسي الذهبي؟',
      },
    ],
  },
];

export const MAIN_TOTAL_SEC = 192;
export const MAIN_TOTAL_FRAMES = MAIN_TOTAL_SEC * FPS;

export const ROLE_RECAP_CARDS: RoleRecapCardSpec[] = [
  {
    number: '01',
    entityEn: 'ADMIN',
    entityAr: 'الإدارة',
    accent: 'gold',
    seesEn: 'Every player, match, timestamped result & full audit trail.',
    doesEn: 'Sets rules, draws groups, schedules tables & runs safe reverts.',
    responsibleEn: 'Fair rules, zero double-bookings & 9/9 data integrity.',
    seesAr: 'كل اللاعبين، المباريات، النتائج بالوقت والتاريخ، وسجل المراجعة.',
    doesAr: 'ضبط القواعد، سحب القرعة، الجدولة، والتعديل الآمن بمعاينة الأثر.',
    responsibleAr: 'عدالة البطولة، منع التعارض، وسلامة البيانات بالكامل.',
  },
  {
    number: '02',
    entityEn: 'SCORER',
    entityAr: 'الحكم',
    accent: 'red',
    seesEn: 'Assigned tables, live segments, timer & match-player contacts.',
    doesEn: 'Taps Buzz, +1 / −1, Yellow & Red cards, Undo & Mark Absent.',
    responsibleEn: 'Fast, accurate live judging with zero scoring mistakes.',
    seesAr: 'طاولاته المخصصة، الفقرات المباشرة، المؤقت، وتواصل لاعبي المباراة.',
    doesAr: 'تسجيل الجرس، +١/−١، الكروت الصفراء والحمراء، التراجع، والغياب.',
    responsibleAr: 'تحكيم مباشر سريع ودقيق بدون أي أخطاء في النقاط.',
  },
  {
    number: '03',
    entityEn: 'PLAYER',
    entityAr: 'المتسابق',
    accent: 'blue',
    seesEn: 'Profile, 3D avatar studio, opponent, Table # & Judge Help Card.',
    doesEn: 'Uploads photo or picks 3D avatar, finds table & views history.',
    responsibleEn: 'Arriving on time — with zero peeking at upcoming segments.',
    seesAr: 'ملفه الشخصي، استوديو الأفاتار، المنافس، رقم الطاولة، وكارت الحكم.',
    doesAr: 'رفع صورة أو اختيار أفاتار 3D، الوصول للطاولة، ومراجعة نتائجه.',
    responsibleAr: 'الالتزام بميعاد طاولته مع بقاء الفقرات مفاجأة للجميع.',
  },
  {
    number: '04',
    entityEn: 'BIG SCREENS',
    entityAr: 'شاشات العرض',
    accent: 'gold',
    seesEn: 'Live scores, card icons, buzz flash, tie-breaks & top podium.',
    doesEn: 'Broadcasts 1v1 and 1v1v1 matches in EN & Arabic RTL instantly.',
    responsibleEn: '10-meter TV-show spectacle for the venue & livestream.',
    seesAr: 'النقاط المباشرة، أيقونات الكروت، وميض الجرس، وجولات الحسم.',
    doesAr: 'بث مباريات ١ ضد ١ والنهائي الثلاثي بالعربي والإنجليزي تلقائياً.',
    responsibleAr: 'إبهار الجمهور في القاعة والبث المباشر بوضوح تليفزيوني.',
  },
  {
    number: '05',
    entityEn: 'PUBLIC FAN VIEW',
    entityAr: 'عرض الجمهور',
    accent: 'blue',
    seesEn: 'Live 240-group standings, schedule, leaderboard & 256-slot bracket.',
    doesEn: 'Tracks favorite players & watches every round update live.',
    responsibleEn: 'Keeping the Ramadan community hooked without spoilers.',
    seesAr: 'ترتيب ٢٤٠ مجموعة، الجدول، لوحة الصدارة، وشجرة ٢٥٦ مقعد المباشرة.',
    doesAr: 'متابعة لاعبيه المفضلين ومشاهدة كل جولة لحظة بلحظة.',
    responsibleAr: 'إشعال حماس الجمهور طوال رمضان بدون حرق للفقرات.',
  },
];

export const TEASER_SCENES: SceneSpec[] = [
  {
    id: 't1-hook',
    act: 'A',
    startSec: 0,
    durationSec: 9,
    narrationEn:
      'Seven hundred and twenty players. One Ramadan tournament. Two finalists left to face Marwan Serry in the Golden Seat.',
    narrationAr:
      'سبعمية وعشرين لاعب، بطولة رمضانية واحدة، واتنين بس هيوصلوا يواجهوا مروان سري على الكرسي الذهبي.',
    captions: [
      {
        offsetSec: 0.2,
        durationSec: 4.1,
        en: '720 players. One Ramadan championship.',
        ar: '٧٢٠ لاعب. بطولة رمضانية واحدة.',
      },
      {
        offsetSec: 4.4,
        durationSec: 4.2,
        en: '2 finalists left to face Marwan Serry in the Golden Seat.',
        ar: 'اتنين بس هيواجهوا مروان سري على الكرسي الذهبي.',
      },
    ],
  },
  {
    id: 't2-scale-player',
    act: 'B',
    startSec: 9,
    durationSec: 11,
    entityEn: 'PLAYER & SCALE',
    entityAr: 'المتسابق وحجم البطولة',
    roleLineEn: '240 groups · Table #1 · Surprise segments',
    roleLineAr: '٢٤٠ مجموعة · طاولة ١ · فقرات مفاجأة',
    narrationEn:
      'Players see their table, 3D avatar, and judge contact — never the upcoming segments, in English or Arabic.',
    narrationAr:
      'المتسابق يعرف طاولته، أفاتاره، وحكمه — من غير ما تتسرب الفقرات — بالعربي وبالإنجليزي.',
    captions: [
      {
        offsetSec: 0.2,
        durationSec: 5.2,
        en: 'Table #1, 3D avatars & Judge Help — zero segment leaks.',
        ar: 'طاولة ١، أفاتار 3D وكارت الحكم — بدون تسريب الفقرات.',
      },
      {
        offsetSec: 5.5,
        durationSec: 5.1,
        en: 'Full English LTR & Arabic RTL experience on every phone.',
        ar: 'تجربة كاملة بالعربي والإنجليزي على كل موبايل.',
      },
    ],
  },
  {
    id: 't3-split-live',
    act: 'B',
    startSec: 20,
    durationSec: 14,
    entityEn: 'SCORER ↔ BIG SCREEN',
    entityAr: 'الحكم ↔ شاشة القاعة',
    roleLineEn: 'Instant live sync + sudden-death tie-breakers',
    roleLineAr: 'تزامن فوري + جولة حسم عند التعادل',
    narrationEn:
      'One tap from the Scorer: Buzz, plus one, Yellow or Red card — the Big Screen and every fan phone react instantly, with sudden-death tie-breakers.',
    narrationAr:
      'ضغطة واحدة من الحكم: الجرس، نقطة، أو كارت أصفر وأحمر — شاشة القاعة وموبايل الجمهور يتحدثوا فوراً، وجولة حسم تلقائية وقت التعادل.',
    captions: [
      {
        offsetSec: 0.2,
        durationSec: 6.5,
        en: 'One Scorer tap: Buzz, +1, Yellow (−1) or Red (−2) card.',
        ar: 'ضغطة حكم واحدة: جرس، +١، بطاقة صفراء (−١) أو حمراء (−٢).',
      },
      {
        offsetSec: 6.8,
        durationSec: 6.8,
        en: 'Big Screen reacts instantly — draws open Sudden-Death Tie-Break!',
        ar: 'شاشة القاعة تتحدث فوراً — والتعادل يفتح جولة الحسم!',
      },
    ],
  },
  {
    id: 't4-fairness',
    act: 'B',
    startSec: 34,
    durationSec: 10,
    entityEn: 'ADMIN · FAIRNESS',
    entityAr: 'الإدارة · العدالة',
    roleLineEn: 'Impact Preview reverts + 9/9 integrity checks',
    roleLineAr: 'معاينة الأثر + ٩ فحوصات تناسق',
    narrationEn:
      'Every action is timestamped. Revert a mistake, confirm the Impact Preview, and winners, standings, and the bracket fix themselves.',
    narrationAr:
      'كل خطوة متسجلة بالوقت. لو حصل تعديل، معاينة الأثر تحمي الجولات، والفائز والترتيب والشجرة يتصححوا تلقائياً.',
    captions: [
      {
        offsetSec: 0.2,
        durationSec: 4.6,
        en: 'Timestamped Results & Audit Log for every card and point.',
        ar: 'سجل نتائج ومراجعة بالوقت لكل نقطة وبطاقة.',
      },
      {
        offsetSec: 4.9,
        durationSec: 4.7,
        en: 'Impact Preview revert → Winner & Bracket self-correct (9/9 Pass).',
        ar: 'معاينة الأثر ← الفائز والشجرة يتصححوا تلقائياً (٩/٩ سليم).',
      },
    ],
  },
  {
    id: 't5-five-entities',
    act: 'C',
    startSec: 44,
    durationSec: 10,
    narrationEn:
      'Admin runs it. Scorer calls it. Player plays blind. Big Screens ignite the room. Fans track every round live.',
    narrationAr:
      'الإدارة تدير، الحكم يحكم، اللاعب يتفاجئ، الشاشات تشعلل القاعة، والجمهور متابع لحظة بلحظة.',
    captions: [
      {
        offsetSec: 0.2,
        durationSec: 4.6,
        en: 'Admin runs it · Scorer calls it · Player plays blind.',
        ar: 'الإدارة تدير · الحكم يحكم · المتسابق يتفاجئ.',
      },
      {
        offsetSec: 4.9,
        durationSec: 4.7,
        en: 'Big Screens ignite the room · Fans track every round live.',
        ar: 'الشاشات تشعلل القاعة · والجمهور متابع لحظة بلحظة.',
      },
    ],
  },
  {
    id: 't6-marwan-cta',
    act: 'E',
    startSec: 54,
    durationSec: 14,
    entityEn: 'GRAND FINAL · 1v1v1',
    entityAr: 'النهائي الكبير · ٣ لاعبين',
    roleLineEn: '2 Finalists + Marwan Serry · Editable Sponsor Tiers',
    roleLineAr: 'متأهلان + مروان سري · باقات رعاية مبدئية',
    narrationEn:
      'All roads lead to your three-player Grand Final, with customizable sponsor tiers ready to build together. Ready for the Golden Seat?',
    narrationAr:
      'وكل ده بيوصل للنهائي الثلاثي معاك، مع باقات رعاية جاهزة تتفصّل مع بعض. جاهز للكرسي الذهبي؟',
    captions: [
      {
        offsetSec: 0.2,
        durationSec: 6.5,
        en: 'Your 1v1v1 Grand Final + customizable Placeholder Sponsor Tiers.',
        ar: 'النهائي الثلاثي معاك + باقات رعاية مبدئية قابلة للتخصيص.',
      },
      {
        offsetSec: 6.8,
        durationSec: 6.8,
        en: 'Ramadan 2027 (Placeholder) — Ready for the Golden Seat?',
        ar: 'رمضان ٢٠٢٧ (مبدئي) — جاهز للكرسي الذهبي؟',
      },
    ],
  },
];

export const TEASER_TOTAL_SEC = 68;
export const TEASER_TOTAL_FRAMES = TEASER_TOTAL_SEC * FPS;
