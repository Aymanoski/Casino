import type {
  QuizApplicant,
  QuizAttempt,
  QuizAttemptEvent,
  QuizCategory,
  QuizDifficulty,
  QuizHandoffEvent,
  QuizQuestion,
  QuizSettings,
} from '@/lib/schemas';
import {
  createSeededRng,
  getShuffledOptionOrder,
  normalizeQuizEmail,
  normalizeQuizPhone,
  selectShuffledQuestionIds,
} from '@/lib/engine';

export const DEFAULT_QUIZ_APPLICANT_COUNT = 1200;

/**
 * Default Quiz Settings (AGENTS.md §16.1):
 * - Opens 48 hours ago, closes 5 days from now so the demo is playable out of the box.
 * - Top-N cutoff follows tournament `totalPlayers` (720) by default.
 */
export function createDefaultQuizSettings(nowMs: number = Date.now()): QuizSettings {
  const startMs = nowMs - 48 * 60 * 60 * 1000;
  const endMs = nowMs + 5 * 24 * 60 * 60 * 1000;
  return {
    questionsPerAttempt: 20,
    secondsPerQuestion: 10,
    syncCutoffWithTournament: true,
    customCutoffN: 720,
    windowStartsAt: new Date(startMs).toISOString(),
    windowEndsAt: new Date(endMs).toISOString(),
    verificationChannel: 'whatsapp_or_sms',
    showRankImmediately: false,
    retakePolicy: 'single_attempt',
    demoVerificationCode: '123456',
  };
}

interface RawQuestionSeed {
  category: QuizCategory;
  difficulty: QuizDifficulty;
  questionAr: string;
  questionEn: string;
  optionsAr: [string, string, string, string];
  optionsEn: [string, string, string, string];
  correctOptionIndex: 0 | 1 | 2 | 3;
  explanationAr: string;
  explanationEn: string;
}

/**
 * 64 Original Bilingual Questions (16 per category: general, egyptian_cinema, music, wordplay_logic).
 * Authored Arabic-first with English translations.
 * EVERY seeded question is marked reviewStatus: 'draft' so a human editor must review
 * factual accuracy and Arabic wording before production launch (AGENTS.md §16.1).
 */
const RAW_QUIZ_QUESTIONS: RawQuestionSeed[] = [
  // ======================== GENERAL KNOWLEDGE (16) ========================
  {
    category: 'general',
    difficulty: 'easy',
    questionAr: 'ما هي عاصمة جمهورية مصر العربية؟',
    questionEn: 'What is the capital city of Egypt?',
    optionsAr: ['القاهرة', 'الإسكندرية', 'الأقصر', 'أسوان'],
    optionsEn: ['Cairo', 'Alexandria', 'Luxor', 'Aswan'],
    correctOptionIndex: 0,
    explanationAr: 'القاهرة هي عاصمة مصر وأكبر مدنها.',
    explanationEn: 'Cairo is the capital and largest city of Egypt.',
  },
  {
    category: 'general',
    difficulty: 'easy',
    questionAr: 'ما هو أطول نهر في قارة أفريقيا؟',
    questionEn: 'What is the longest river in Africa?',
    optionsAr: ['نهر الكونغو', 'نهر النيل', 'نهر النيجر', 'نهر الزمبيزي'],
    optionsEn: ['Congo River', 'Nile River', 'Niger River', 'Zambezi River'],
    correctOptionIndex: 1,
    explanationAr: 'يمتد نهر النيل لأكثر من ٦٦٥٠ كيلومتراً عبر شمال شرق أفريقيا.',
    explanationEn: 'The Nile stretches over 6,650 km across northeastern Africa.',
  },
  {
    category: 'general',
    difficulty: 'easy',
    questionAr: 'ما هو الرمز الكيميائي لعنصر الذهب في الجدول الدوري؟',
    questionEn: 'What is the chemical symbol for gold on the periodic table?',
    optionsAr: ['Ag', 'Fe', 'Au', 'Cu'],
    optionsEn: ['Ag', 'Fe', 'Au', 'Cu'],
    correctOptionIndex: 2,
    explanationAr: 'يرمز للذهب بالرمز Au نسبة إلى الكلمة اللاتينية Aurum.',
    explanationEn: 'Gold uses the symbol Au from the Latin word Aurum.',
  },
  {
    category: 'general',
    difficulty: 'easy',
    questionAr: 'أي كوكب في المجموعة الشمسية هو الأقرب إلى الشمس؟',
    questionEn: 'Which planet in our solar system is closest to the Sun?',
    optionsAr: ['الزهرة', 'المريخ', 'عطارد', 'الأرض'],
    optionsEn: ['Venus', 'Mars', 'Mercury', 'Earth'],
    correctOptionIndex: 2,
    explanationAr: 'عطارد هو أقرب كوكب إلى الشمس وأصغر كواكب المجموعة الشمسية.',
    explanationEn: 'Mercury is the innermost and smallest planet in the solar system.',
  },
  {
    category: 'general',
    difficulty: 'easy',
    questionAr: 'كم عدد قارات كوكب الأرض؟',
    questionEn: 'How many continents are there on Earth?',
    optionsAr: ['٥ قارات', '٦ قارات', '٧ قارات', '٨ قارات'],
    optionsEn: ['5 continents', '6 continents', '7 continents', '8 continents'],
    correctOptionIndex: 2,
    explanationAr: 'يتكون العالم من ٧ قارات: آسيا وأفريقيا وأوروبا وأمريكا الشمالية والجنوبية وأستراليا والقارة القطبية الجنوبية.',
    explanationEn: 'Earth has 7 continents: Asia, Africa, Europe, North America, South America, Australia, and Antarctica.',
  },
  {
    category: 'general',
    difficulty: 'easy',
    questionAr: 'في أي مدينة مصرية تقع مكتبة الإسكندرية الجديدة؟',
    questionEn: 'In which Egyptian city is the Bibliotheca Alexandrina located?',
    optionsAr: ['بورسعيد', 'الإسكندرية', 'المنصورة', 'السويس'],
    optionsEn: ['Port Said', 'Alexandria', 'Mansoura', 'Suez'],
    correctOptionIndex: 1,
    explanationAr: 'افتتحت مكتبة الإسكندرية الحديثة عام ٢٠٠٢ على كورنيش الإسكندرية.',
    explanationEn: 'The modern Bibliotheca Alexandrina opened in 2002 on the Alexandria seafront.',
  },
  {
    category: 'general',
    difficulty: 'medium',
    questionAr: 'ما الغاز الذي يشكل نحو ٧٨٪ من الغلاف الجوي للأرض؟',
    questionEn: 'Which gas makes up roughly 78% of Earth’s atmosphere?',
    optionsAr: ['الأكسجين', 'ثاني أكسيد الكربون', 'النيتروجين', 'الهيدروجين'],
    optionsEn: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'],
    correctOptionIndex: 2,
    explanationAr: 'يشكل النيتروجين نحو ٧٨٪ من الهواء، بينما يشكل الأكسجين نحو ٢١٪.',
    explanationEn: 'Nitrogen makes up about 78% of Earth’s air, while oxygen is roughly 21%.',
  },
  {
    category: 'general',
    difficulty: 'medium',
    questionAr: 'كم عدد المربعات في رقعة الشطرنج القياسية؟',
    questionEn: 'How many squares are on a standard chessboard?',
    optionsAr: ['٤٩ مربعاً', '٦٤ مربعاً', '٧٢ مربعاً', '٨١ مربعاً'],
    optionsEn: ['49 squares', '64 squares', '72 squares', '81 squares'],
    correctOptionIndex: 1,
    explanationAr: 'تتكون رقعة الشطرنج من شبكة ٨ × ٨ أي ٦٤ مربعاً.',
    explanationEn: 'A standard chessboard is an 8 × 8 grid totaling 64 squares.',
  },
  {
    category: 'general',
    difficulty: 'medium',
    questionAr: 'أي فرعون مصري قديم يُنسب إليه بناء الهرم الأكبر بالجيزة؟',
    questionEn: 'Which ancient Egyptian pharaoh built the Great Pyramid of Giza?',
    optionsAr: ['توت عنخ آمون', 'خوفو', 'رمسيس الثاني', 'أحمس الأول'],
    optionsEn: ['Tutankhamun', 'Khufu', 'Ramesses II', 'Ahmose I'],
    correctOptionIndex: 1,
    explanationAr: 'شُيّد الهرم الأكبر بالجيزة ليكون مقبرة للملك خوفو من الأسرة الرابعة.',
    explanationEn: 'The Great Pyramid of Giza was built for Pharaoh Khufu of the Fourth Dynasty.',
  },
  {
    category: 'general',
    difficulty: 'easy',
    questionAr: 'ما هو أكبر محيط على سطح الأرض من حيث المساحة؟',
    questionEn: 'What is the largest ocean on Earth by surface area?',
    optionsAr: ['المحيط الأطلسي', 'المحيط الهندي', 'المحيط الهادئ', 'المحيط المتجمد الشمالي'],
    optionsEn: ['Atlantic Ocean', 'Indian Ocean', 'Pacific Ocean', 'Arctic Ocean'],
    correctOptionIndex: 2,
    explanationAr: 'المحيط الهادئ هو الأكبر والأعمق بين محيطات العالم.',
    explanationEn: 'The Pacific Ocean is both the largest and deepest ocean on Earth.',
  },
  {
    category: 'general',
    difficulty: 'hard',
    questionAr: 'في أي عام افتُتحت قناة السويس رسمياً للملاحة العالمية؟',
    questionEn: 'In what year was the Suez Canal officially opened to navigation?',
    optionsAr: ['١٨٥٩', '١٨٦٩', '١٨٨٢', '١٩٠١'],
    optionsEn: ['1859', '1869', '1882', '1901'],
    correctOptionIndex: 1,
    explanationAr: 'افتتحت قناة السويس رسمياً للملاحة في نوفمبر عام ١٨٦٩.',
    explanationEn: 'The Suez Canal officially opened to international shipping in November 1869.',
  },
  {
    category: 'general',
    difficulty: 'easy',
    questionAr: 'كم تبلغ المدة الأصلية لمباراة كرة القدم القياسية دون الوقت بدل الضائع؟',
    questionEn: 'How many regulation minutes are in a standard football match (excluding stoppage time)?',
    optionsAr: ['٦٠ دقيقة', '٨٠ دقيقة', '٩٠ دقيقة', '١٢٠ دقيقة'],
    optionsEn: ['60 minutes', '80 minutes', '90 minutes', '120 minutes'],
    correctOptionIndex: 2,
    explanationAr: 'تُلعب مباراة كرة القدم على شوطين مدة كل منهما ٤٥ دقيقة بمجموع ٩٠ دقيقة.',
    explanationEn: 'A standard match consists of two 45-minute halves totaling 90 minutes.',
  },
  {
    category: 'general',
    difficulty: 'easy',
    questionAr: 'ما العضو المسؤول عن ضخ الدم إلى جميع أنحاء جسم الإنسان؟',
    questionEn: 'Which organ pumps blood throughout the human body?',
    optionsAr: ['الكبد', 'الرئتان', 'القلب', 'المعدة'],
    optionsEn: ['Liver', 'Lungs', 'Heart', 'Stomach'],
    correctOptionIndex: 2,
    explanationAr: 'يعمل القلب كمضخة عضلية تضخ الدم عبر الدورة الدموية.',
    explanationEn: 'The heart is the muscular organ that circulates blood through the body.',
  },
  {
    category: 'general',
    difficulty: 'hard',
    questionAr: 'ما هي أعلى قمة جبلية في مصر؟',
    questionEn: 'What is the highest mountain peak in Egypt?',
    optionsAr: ['جبل موسى', 'جبل سانت كاترين', 'جبل علبة', 'جبل شايب البنات'],
    optionsEn: ['Mount Sinai', 'Mount Catherine', 'Mount Elba', 'Mount Shaiyb al-Banat'],
    correctOptionIndex: 1,
    explanationAr: 'ترتفع قمة جبل سانت كاترين في جنوب سيناء لأكثر من ٢٦٠٠ متر فوق سطح البحر.',
    explanationEn: 'Mount Catherine in South Sinai rises over 2,600 meters above sea level.',
  },
  {
    category: 'general',
    difficulty: 'medium',
    questionAr: 'أي دولة استضافت بطولة كأس العالم لكرة القدم عام ٢٠٢٢؟',
    questionEn: 'Which country hosted the 2022 FIFA World Cup?',
    optionsAr: ['روسيا', 'قطر', 'البرازيل', 'فرنسا'],
    optionsEn: ['Russia', 'Qatar', 'Brazil', 'France'],
    correctOptionIndex: 1,
    explanationAr: 'استضافت قطر نهائيات كأس العالم ٢٠٢٢ كأول بطولة تُقام في الشرق الأوسط.',
    explanationEn: 'Qatar hosted the 2022 FIFA World Cup, the first held in the Middle East.',
  },
  {
    category: 'general',
    difficulty: 'easy',
    questionAr: 'ما هي الصيغة الكيميائية للماء النقي؟',
    questionEn: 'What is the chemical formula for pure water?',
    optionsAr: ['CO₂', 'H₂O', 'NaCl', 'O₂'],
    optionsEn: ['CO₂', 'H₂O', 'NaCl', 'O₂'],
    correctOptionIndex: 1,
    explanationAr: 'يتكون جزيء الماء من ذرتي هيدروجين وذرة أكسجين واحدة (H₂O).',
    explanationEn: 'Each water molecule consists of two hydrogen atoms and one oxygen atom (H₂O).',
  },

  // ======================== EGYPTIAN CINEMA & SERIES (16) ========================
  {
    category: 'egyptian_cinema',
    difficulty: 'medium',
    questionAr: 'من هو مخرج الفيلم المصري الكلاسيكي «باب الحديد» (١٩٥٨)؟',
    questionEn: 'Who directed the classic 1958 Egyptian film "Bab El Hadid" (Cairo Station)?',
    optionsAr: ['صلاح أبو سيف', 'يوسف شاهين', 'حسن الإمام', 'عاطف الطيب'],
    optionsEn: ['Salah Abu Seif', 'Youssef Chahine', 'Hassan El Imam', 'Atef El Tayeb'],
    correctOptionIndex: 1,
    explanationAr: 'أخرج يوسف شاهين فيلم «باب الحديد» كما أدى فيه دور «قناوي».',
    explanationEn: 'Youssef Chahine both directed "Cairo Station" and starred as Qinawi.',
  },
  {
    category: 'egyptian_cinema',
    difficulty: 'easy',
    questionAr: 'من النجم الذي أدى دور «بهجت الأباصيري» في مسرحية «مدرسة المشاغبين»؟',
    questionEn: 'Which star played Bahgat El Abasiry in the iconic play "Madraset El Moshaghbeen"?',
    optionsAr: ['عادل إمام', 'سعيد صالح', 'يونس شلبي', 'أحمد زكي'],
    optionsEn: ['Adel Emam', 'Saeed Saleh', 'Younes Shalaby', 'Ahmed Zaki'],
    correctOptionIndex: 0,
    explanationAr: 'جسّد عادل إمام شخصية «بهجت الأباصيري» في المسرحية الكوميدية الشهيرة.',
    explanationEn: 'Adel Emam portrayed Bahgat El Abasiry in the celebrated comedy stage play.',
  },
  {
    category: 'egyptian_cinema',
    difficulty: 'easy',
    questionAr: 'من قام ببطولة الفيلم الكوميدي الشهير «صعيدي في الجامعة الأمريكية» (١٩٩٨)؟',
    questionEn: 'Who starred as the lead in the 1998 comedy hit "Saeedi fi El Gameaa El Amrekeya"?',
    optionsAr: ['أحمد حلمي', 'محمد هنيدي', 'هاني رمزي', 'كريم عبد العزيز'],
    optionsEn: ['Ahmed Helmy', 'Mohamed Henedy', 'Hany Ramzy', 'Karim Abdel Aziz'],
    correctOptionIndex: 1,
    explanationAr: 'أدى محمد هنيدي دور «خلف الدهشوري» في الفيلم الذي أحدث نقلة في الكوميديا المصرية.',
    explanationEn: 'Mohamed Henedy starred as Khalaf El Dahshoury in the landmark 1998 comedy.',
  },
  {
    category: 'egyptian_cinema',
    difficulty: 'easy',
    questionAr: 'أي فنانة مصرية عُرفت بلقب «سيدة الشاشة العربية»؟',
    questionEn: 'Which Egyptian actress was widely known as "Lady of the Arabic Screen"?',
    optionsAr: ['سعاد حسني', 'شادية', 'فاتن حمامة', 'نادية لطفي'],
    optionsEn: ['Soad Hosny', 'Shadia', 'Faten Hamama', 'Nadia Lutfi'],
    correctOptionIndex: 2,
    explanationAr: 'حملت الفنانة الراحلة فاتن حمامة لقب «سيدة الشاشة العربية» تقديراً لمسيرتها الفنية.',
    explanationEn: 'Faten Hamama earned the title "Sayedat El Shasha El Arabiya" over her storied career.',
  },
  {
    category: 'egyptian_cinema',
    difficulty: 'easy',
    questionAr: 'من جسّد شخصية «اللمبي» الشهيرة في فيلم «اللمبي» (٢٠٠٢)؟',
    questionEn: 'Who portrayed the iconic title character in the 2002 comedy "El Lemby"?',
    optionsAr: ['محمد سعد', 'أشرف عبد الباقي', 'رامز جلال', 'شريف منير'],
    optionsEn: ['Mohamed Saad', 'Ashraf Abdel Baky', 'Ramez Galal', 'Sherif Mounir'],
    correctOptionIndex: 0,
    explanationAr: 'اشتهر محمد سعد بتقديم شخصية «اللمبي» التي حققت نجاحاً جماهيرياً كبيراً.',
    explanationEn: 'Mohamed Saad became a household name through his portrayal of El Lemby.',
  },
  {
    category: 'egyptian_cinema',
    difficulty: 'medium',
    questionAr: 'من هو مخرج فيلم «الفيل الأزرق» (٢٠١٤)؟',
    questionEn: 'Who directed the 2014 Egyptian thriller "El Feel El Azraq" (The Blue Elephant)?',
    optionsAr: ['شريف عرفة', 'مروان حامد', 'عمرو سلامة', 'طارق العريان'],
    optionsEn: ['Sherif Arafa', 'Marwan Hamed', 'Amr Salama', 'Tarek Alarian'],
    correctOptionIndex: 1,
    explanationAr: 'أخرج مروان حامد فيلم «الفيل الأزرق» المأخوذ عن رواية أحمد مراد.',
    explanationEn: 'Marwan Hamed directed "The Blue Elephant", adapted from Ahmed Mourad’s novel.',
  },
  {
    category: 'egyptian_cinema',
    difficulty: 'easy',
    questionAr: 'من أدى دور الدكتور «يحيى راشد» في فيلم «الفيل الأزرق»؟',
    questionEn: 'Which actor starred as Dr. Yehia Rashed in "El Feel El Azraq"?',
    optionsAr: ['أحمد عز', 'كريم عبد العزيز', 'خالد الصاوي', 'آسر ياسين'],
    optionsEn: ['Ahmed Ezz', 'Karim Abdel Aziz', 'Khaled El Sawy', 'Asser Yassin'],
    correctOptionIndex: 1,
    explanationAr: 'قام كريم عبد العزيز بدور الطبيب النفسي يحيى راشد في جزئي «الفيل الأزرق».',
    explanationEn: 'Karim Abdel Aziz played psychiatrist Dr. Yehia Rashed in the film series.',
  },
  {
    category: 'egyptian_cinema',
    difficulty: 'easy',
    questionAr: 'من بطل مسلسل الكوميديا الرمضاني الشهير «الكبير أوي»؟',
    questionEn: 'Who stars as the lead in the beloved Ramadan comedy series "Al-Kabeer Awy"?',
    optionsAr: ['أحمد مكي', 'أكرم حسني', 'بيومي فؤاد', 'علي ربيع'],
    optionsEn: ['Ahmed Mekky', 'Akram Hosny', 'Bayoumi Fouad', 'Ali Rabee'],
    correctOptionIndex: 0,
    explanationAr: 'قدّم أحمد مكي شخصيات «الكبير» و«جوني» و«حزلقوم» في المسلسل الرمضاني.',
    explanationEn: 'Ahmed Mekky plays Al-Kabeer, Johnny, and Hazalqoum in the long-running comedy.',
  },
  {
    category: 'egyptian_cinema',
    difficulty: 'easy',
    questionAr: 'من مؤلف «الثلاثية» (بين القصرين، قصر الشوق، السكرية) التي تحولت لأفلام خالدة؟',
    questionEn: 'Which Nobel laureate wrote "The Cairo Trilogy", adapted into classic Egyptian films?',
    optionsAr: ['توفيق الحكيم', 'يوسف إدريس', 'نجيب محفوظ', 'إحسان عبد القدوس'],
    optionsEn: ['Tawfiq al-Hakim', 'Youssef Idris', 'Naguib Mahfouz', 'Ihsan Abdel Quddous'],
    correctOptionIndex: 2,
    explanationAr: 'كتب الأديب الحائز على نوبل نجيب محفوظ الثلاثية القاهرية الشهيرة.',
    explanationEn: 'Nobel Prize winner Naguib Mahfouz authored "The Cairo Trilogy".',
  },
  {
    category: 'egyptian_cinema',
    difficulty: 'medium',
    questionAr: 'من الفنان الذي جسّد دور الأب «رمضان السكري» في مسرحية «العيال كبرت»؟',
    questionEn: 'Who played the father "Ramadan El Sokkary" in the classic comedy play "El Eyal Kebret"?',
    optionsAr: ['سعيد صالح', 'حسن مصطفى', 'أحمد زكي', 'يونس شلبي'],
    optionsEn: ['Saeed Saleh', 'Hassan Mostafa', 'Ahmed Zaki', 'Younes Shalaby'],
    correctOptionIndex: 1,
    explanationAr: 'أدى الفنان القدير حسن مصطفى دور الأب «رمضان السكري» ببراعة كوميدية خالدة.',
    explanationEn: 'Veteran actor Hassan Mostafa played the father Ramadan El Sokkary.',
  },
  {
    category: 'egyptian_cinema',
    difficulty: 'easy',
    questionAr: 'من بطل الفيلم الكوميدي «الناظر» (٢٠٠٠) الذي أدى فيه عدة شخصيات منها صلاح وعاشور؟',
    questionEn: 'Who starred in multiple roles (Salah, Ashour, and Jawaher) in the comedy "El Nazer"?',
    optionsAr: ['علاء ولي الدين', 'محمد هنيدي', 'أحمد آدم', 'طلعت زكريا'],
    optionsEn: ['Alaa Wali El Din', 'Mohamed Henedy', 'Ahmed Adam', 'Talaat Zakaria'],
    correctOptionIndex: 0,
    explanationAr: 'تألق الراحل علاء ولي الدين في بطولة فيلم «الناظر» من إخراج شريف عرفة.',
    explanationEn: 'The late Alaa Wali El Din starred in "El Nazer", directed by Sherif Arafa.',
  },
  {
    category: 'egyptian_cinema',
    difficulty: 'hard',
    questionAr: 'من هو مخرج الفيلم المصري الشهير «الكيت كات» (١٩٩١)؟',
    questionEn: 'Who directed the acclaimed 1991 Egyptian film "El Kit Kat"?',
    optionsAr: ['خيري بشارة', 'داوود عبد السيد', 'محمد خان', 'رأفت الميهي'],
    optionsEn: ['Khairy Beshara', 'Daoud Abdel Sayed', 'Mohamed Khan', 'Raafat El Mihi'],
    correctOptionIndex: 1,
    explanationAr: 'كتب وأخرج داوود عبد السيد فيلم «الكيت كات» عن رواية «مالك الحزين» لإبراهيم أصلان.',
    explanationEn: 'Daoud Abdel Sayed wrote and directed "El Kit Kat", adapted from Ibrahim Aslan’s novel.',
  },
  {
    category: 'egyptian_cinema',
    difficulty: 'medium',
    questionAr: 'أي فنان مصري قدير أدى دور «الشيخ حسني» في فيلم «الكيت كات»؟',
    questionEn: 'Which celebrated Egyptian actor played Sheikh Hosny in "El Kit Kat" (1991)?',
    optionsAr: ['نور الشريف', 'محمود عبد العزيز', 'يحيى الفخراني', 'فريد شوقي'],
    optionsEn: ['Nour El Sherif', 'Mahmoud Abdel Aziz', 'Yehia El Fakharany', 'Farid Shawqi'],
    correctOptionIndex: 1,
    explanationAr: 'يُعد دور «الشيخ حسني» من أبرز محطات الفنان الراحل محمود عبد العزيز.',
    explanationEn: 'Sheikh Hosny is considered one of Mahmoud Abdel Aziz’s most iconic performances.',
  },
  {
    category: 'egyptian_cinema',
    difficulty: 'hard',
    questionAr: 'من مؤلف الموسيقى التصويرية الشهيرة لمسلسل «رأفت الهجان»؟',
    questionEn: 'Who composed the iconic musical theme for the TV drama "Raafat El Haggan"?',
    optionsAr: ['عمر خيرت', 'عمار الشريعي', 'ياسر عبد الرحمن', 'راجح داوود'],
    optionsEn: ['Omar Khairat', 'Ammar El Sherei', 'Yasser Abdel Rahman', 'Rageh Daoud'],
    correctOptionIndex: 1,
    explanationAr: 'أبدع الموسيقار عمار الشريعي الموسيقى التصويرية الخالدة لمسلسل «رأفت الهجان».',
    explanationEn: 'Composer Ammar El Sherei wrote the unforgettable score for "Raafat El Haggan".',
  },
  {
    category: 'egyptian_cinema',
    difficulty: 'medium',
    questionAr: 'من قام ببطولة فيلم الحركة والدراما المصري «تيتو» (٢٠٠٤)؟',
    questionEn: 'Who played the title role in the 2004 Egyptian action-drama "Tito"?',
    optionsAr: ['أحمد السقا', 'مصطفى شعبان', 'هاني سلامة', 'شريف سلامة'],
    optionsEn: ['Ahmed El Sakka', 'Mostafa Shaban', 'Hany Salama', 'Sherif Salama'],
    correctOptionIndex: 0,
    explanationAr: 'أدى أحمد السقا شخصية «تيتو» من إخراج طارق العريان.',
    explanationEn: 'Ahmed El Sakka starred as Tito in Tarek Alarian’s 2004 film.',
  },
  {
    category: 'egyptian_cinema',
    difficulty: 'easy',
    questionAr: 'من الفنانة الاستعراضية التي تألقت في تقديم «فوازير رمضان» خلال الثمانينيات؟',
    questionEn: 'Which beloved Egyptian performer famously starred in "Fawazeer Ramadan" in the 1980s?',
    optionsAr: ['شريهان', 'يسرا', 'إلهام شاهين', 'ليلى علوي'],
    optionsEn: ['Sherihan', 'Yousra', 'Elham Shahin', 'Laila Eloui'],
    correctOptionIndex: 0,
    explanationAr: 'قدمت شريهان أشهر مواسم فوازير رمضان الاستعراضية مثل «ألف ليلة وليلة» و«حاجات ومحتاجات».',
    explanationEn: 'Sherihan became synonymous with Ramadan entertainment through her dazzling Fawazeer specials.',
  },

  // ======================== MUSIC & SONGS (16) ========================
  {
    category: 'music',
    difficulty: 'easy',
    questionAr: 'أي مطربة مصرية خالدة تُلقب بـ «كوكب الشرق»؟',
    questionEn: 'Which legendary Egyptian singer is famously titled "Kawkab El Sharq" (Star of the East)?',
    optionsAr: ['أسمهان', 'أم كلثوم', 'ليلى مراد', 'نجاة الصغيرة'],
    optionsEn: ['Asmahan', 'Umm Kulthum', 'Leila Mourad', 'Nagat El Saghira'],
    correctOptionIndex: 1,
    explanationAr: 'تُعرف أم كلثوم بلقب «كوكب الشرق» وتُعد من أعظم الأصوات في تاريخ الموسيقى العربية.',
    explanationEn: 'Umm Kulthum is revered across the Arab world as "Star of the East".',
  },
  {
    category: 'music',
    difficulty: 'easy',
    questionAr: 'من المطرب المصري الراحل الملقب بـ «العندليب الأسمر»؟',
    questionEn: 'Which legendary Egyptian singer was nicknamed "El Andaleeb El Asmar" (The Dark Nightingale)?',
    optionsAr: ['فريد الأطرش', 'عبد الحليم حافظ', 'محمد فوزي', 'كارم محمود'],
    optionsEn: ['Farid al-Atrash', 'Abdel Halim Hafez', 'Mohamed Fawzi', 'Karem Mahmoud'],
    correctOptionIndex: 1,
    explanationAr: 'حمل عبد الحليم حافظ لقب «العندليب الأسمر» وظلت أغانيه خالدة عبر الأجيال.',
    explanationEn: 'Abdel Halim Hafez was affectionately known as "The Dark Nightingale".',
  },
  {
    category: 'music',
    difficulty: 'easy',
    questionAr: 'من المطرب المصري الشهير الملقب جماهيرياً بـ «الهضبة»؟',
    questionEn: 'Which Egyptian pop superstar is popularly nicknamed "El Hadaba" (The Plateau)?',
    optionsAr: ['تامر حسني', 'عمرو دياب', 'محمد حماقي', 'مصطفى قمر'],
    optionsEn: ['Tamer Hosny', 'Amr Diab', 'Mohamed Hamaki', 'Mostafa Amar'],
    correctOptionIndex: 1,
    explanationAr: 'اشتهر عمرو دياب بلقب «الهضبة» لمسيرته الممتدة في صدارة الغناء العربي.',
    explanationEn: 'Amr Diab is universally known by fans as "El Hadaba".',
  },
  {
    category: 'music',
    difficulty: 'medium',
    questionAr: 'من هو ملحن أغنية «إنت عمري» الشهيرة لأم كلثوم؟',
    questionEn: 'Who composed the landmark Umm Kulthum classic "Enta Omri"?',
    optionsAr: ['رياض السنباطي', 'محمد عبد الوهاب', 'زكريا أحمد', 'سيد مكاوي'],
    optionsEn: ['Riad Al Sunbati', 'Mohamed Abdel Wahab', 'Zakariyya Ahmad', 'Sayed Mekawy'],
    correctOptionIndex: 1,
    explanationAr: 'شهدت «إنت عمري» (١٩٦٤) أول تعاون تاريخي بين محمد عبد الوهاب وأم كلثوم.',
    explanationEn: '"Enta Omri" (1964) marked the historic first collaboration between Mohamed Abdel Wahab and Umm Kulthum.',
  },
  {
    category: 'music',
    difficulty: 'easy',
    questionAr: 'من المطرب النوبي المصري المعروف بلقب «الكينج»؟',
    questionEn: 'Which iconic Nubian-Egyptian singer is popularly called "El King"?',
    optionsAr: ['محمد منير', 'علي الحجار', 'مدحت صالح', 'هاني شاكر'],
    optionsEn: ['Mohamed Mounir', 'Ali El Haggar', 'Medhat Saleh', 'Hany Shaker'],
    correctOptionIndex: 0,
    explanationAr: 'يُلقب محمد منير بـ «الكينج» واشتهر بمزج الموسيقى النوبية والمصرية والعالمية.',
    explanationEn: 'Mohamed Mounir is known as "El King" for blending Nubian, Egyptian, and world rhythms.',
  },
  {
    category: 'music',
    difficulty: 'easy',
    questionAr: 'كم عدد أوتار آلة الجيتار الصوتي القياسية؟',
    questionEn: 'How many strings does a standard acoustic guitar have?',
    optionsAr: ['٤ أوتار', '٥ أوتار', '٦ أوتار', '٨ أوتار'],
    optionsEn: ['4 strings', '5 strings', '6 strings', '8 strings'],
    correctOptionIndex: 2,
    explanationAr: 'يحتوي الجيتار الصوتي القياسي على ٦ أوتار.',
    explanationEn: 'A standard modern acoustic guitar is fitted with 6 strings.',
  },
  {
    category: 'music',
    difficulty: 'easy',
    questionAr: 'ما هي الآلة الوترية التراثية ذات الشكل الكمّثري التي تُعد ركيزة الموسيقى العربية؟',
    questionEn: 'Which pear-shaped stringed instrument is a cornerstone of traditional Arabic music?',
    optionsAr: ['الناي', 'العود', 'الأكورديون', 'الساكسفون'],
    optionsEn: ['Ney', 'Oud', 'Accordion', 'Saxophone'],
    correctOptionIndex: 1,
    explanationAr: 'تُعرف آلة العود بأنها سلطان الآلات الوترية في التخت العربي الشرقي.',
    explanationEn: 'The oud is widely regarded as the king of stringed instruments in Arabic music.',
  },
  {
    category: 'music',
    difficulty: 'medium',
    questionAr: 'من لحّن أغنيتي «ألف ليلة وليلة» و«سيرة الحب» لأم كلثوم؟',
    questionEn: 'Which Egyptian composer wrote both "Alf Leila w Leila" and "Siret El Hob" for Umm Kulthum?',
    optionsAr: ['بليغ حمدي', 'محمد القصبجي', 'كمال الطويل', 'محمد الموجي'],
    optionsEn: ['Baligh Hamdi', 'Mohamed El Qasabgi', 'Kamal El Tawil', 'Mohamed El Mougy'],
    correctOptionIndex: 0,
    explanationAr: 'قدّم بليغ حمدي مجموعة من أشهر ألحان أم كلثوم ومنها «ألف ليلة وليلة» و«سيرة الحب».',
    explanationEn: 'Baligh Hamdi composed several of Umm Kulthum’s most enduring hits, including "Alf Leila w Leila".',
  },
  {
    category: 'music',
    difficulty: 'medium',
    questionAr: 'أي فرقة روك وبوب مصرية شهيرة قدّمت أغنية «يا الميدان» وألبوم «نقطة بيضا»؟',
    questionEn: 'Which prominent Egyptian rock-pop band released "No’ta Beida" and "Samurai"?',
    optionsAr: ['كايروكي', 'وسط البلد', 'مسار إجباري', 'بلاك تيما'],
    optionsEn: ['Cairokee', 'Wust El-Balad', 'Massar Egbari', 'Black Theama'],
    correctOptionIndex: 0,
    explanationAr: 'فرقة كايروكي (بقيادة أمير عيد) من أشهر فرق الروك المصرية المعاصرة.',
    explanationEn: 'Cairokee is one of Egypt’s most prominent contemporary rock-pop bands.',
  },
  {
    category: 'music',
    difficulty: 'hard',
    questionAr: 'من هو المطرب الذي غنّى الأغنية الرمضانية التراثية الشهيرة «وحوي يا وحوي»؟',
    questionEn: 'Which singer performed the classic Egyptian Ramadan song "Wahawi Ya Wahawi"?',
    optionsAr: ['محمد عبد المطلب', 'أحمد عبد القادر', 'عبد العزيز محمود', 'محمد قنديل'],
    optionsEn: ['Mohamed Abdel Muttalib', 'Ahmed Abdel Qader', 'Abdel Aziz Mahmoud', 'Mohamed Kandil'],
    correctOptionIndex: 1,
    explanationAr: 'غنّى أحمد عبد القادر أغنية «وحوي يا وحوي» من كلمات حلمي المانسترلي وألحان أحمد الشريف.',
    explanationEn: 'Ahmed Abdel Qader recorded the beloved Ramadan classic "Wahawi Ya Wahawi".',
  },
  {
    category: 'music',
    difficulty: 'hard',
    questionAr: 'من لحّن أغنية «رمضان جانا» الشهيرة التي غنّاها محمد عبد المطلب؟',
    questionEn: 'Who composed the iconic Ramadan greeting song "Ramadan Gana" (sung by Mohamed Abdel Muttalib)?',
    optionsAr: ['محمود الشريف', 'منير مراد', 'سيد درويش', 'حلمي بكر'],
    optionsEn: ['Mahmoud El Sherif', 'Mounir Mourad', 'Sayed Darwish', 'Helmy Bakr'],
    correctOptionIndex: 0,
    explanationAr: 'لحّن محمود الشريف «رمضان جانا» من كلمات حسين طنطاوي، وأصبحت نشيداً لاستقبال الشهر الكريم.',
    explanationEn: 'Mahmoud El Sherif composed "Ramadan Gana", Egypt’s quintessential Ramadan welcome song.',
  },
  {
    category: 'music',
    difficulty: 'easy',
    questionAr: 'كم عدد النغمات الأساسية في السلم الموسيقي (دو، ري، مي...) قبل تكرار الأوكتاف؟',
    questionEn: 'How many natural notes are in a standard Do-Re-Mi scale before the octave repeats?',
    optionsAr: ['٥ نغمات', '٦ نغمات', '٧ نغمات', '٩ نغمات'],
    optionsEn: ['5 notes', '6 notes', '7 notes', '9 notes'],
    correctOptionIndex: 2,
    explanationAr: 'السلم الموسيقي الأساسي يتكون من ٧ نغمات: دو، ري، مي، فا، صول، لا، سي.',
    explanationEn: 'The standard diatonic scale contains 7 natural notes: Do, Re, Mi, Fa, Sol, La, Si.',
  },
  {
    category: 'music',
    difficulty: 'easy',
    questionAr: 'أي مطربة لبنانية كبيرة ارتبط صوتها بصباحات العالم العربي وبأغاني مثل «بكتب اسمك يا حبيبي»؟',
    questionEn: 'Which iconic Lebanese singer is celebrated across the Arab world for classics like "Bektoub Ismak"?',
    optionsAr: ['صباح', 'فيروز', 'ماجدة الرومي', 'وديع الصافي'],
    optionsEn: ['Sabah', 'Fairuz', 'Majida El Roumi', 'Wadih El Safi'],
    correctOptionIndex: 1,
    explanationAr: 'تُعد السيدة فيروز أيقونة الغناء الصباحي والمسرح الغنائي اللبناني والعربي.',
    explanationEn: 'Fairuz is a musical icon celebrated across the entire Arab world.',
  },
  {
    category: 'music',
    difficulty: 'medium',
    questionAr: 'من الموسيقار المصري الكبير الذي لُقّب بـ «موسيقار الأجيال»؟',
    questionEn: 'Which towering Egyptian singer-composer is titled "Musician of the Generations" (Mousiqar El Agyal)?',
    optionsAr: ['سيد درويش', 'محمد عبد الوهاب', 'فريد الأطرش', 'محمد فوزي'],
    optionsEn: ['Sayed Darwish', 'Mohamed Abdel Wahab', 'Farid al-Atrash', 'Mohamed Fawzi'],
    correctOptionIndex: 1,
    explanationAr: 'حصل محمد عبد الوهاب على لقب «موسيقار الأجيال» لتأثيره الموسيقي الممتد لعقود.',
    explanationEn: 'Mohamed Abdel Wahab earned the title "Musician of the Generations" for his multi-decade legacy.',
  },
  {
    category: 'music',
    difficulty: 'easy',
    questionAr: 'ما هي الآلة الإيقاعية اليدوية المخروطية الأشهر في الموسيقى المصرية؟',
    questionEn: 'Which goblet-shaped hand drum is iconic across Egyptian classical and folk music?',
    optionsAr: ['القانون', 'الطبلة (الدربكة)', 'الكمان', 'البيانو'],
    optionsEn: ['Qanun', 'Tabla (Darbuka)', 'Violin', 'Piano'],
    correctOptionIndex: 1,
    explanationAr: 'الطبلة أو الدربكة هي آلة الإيقاع الأكثر شهرة في الموسيقى المصرية.',
    explanationEn: 'The tabla (darbuka) is the signature goblet hand drum of Egyptian rhythm.',
  },
  {
    category: 'music',
    difficulty: 'medium',
    questionAr: 'من هو الموسيقار المصري المعاصر مؤلف المقطوعة الشهيرة «قضية عم أحمد»؟',
    questionEn: 'Which celebrated contemporary Egyptian composer created the instrumental classic "Qadiyat Am Ahmed"?',
    optionsAr: ['عمر خيرت', 'خالد حماد', 'هشام نزيه', 'تامر كروان'],
    optionsEn: ['Omar Khairat', 'Khaled Hammad', 'Hesham Nazih', 'Tamer Karawan'],
    correctOptionIndex: 0,
    explanationAr: 'تُعد «قضية عم أحمد» من أشهر مقطوعات الموسيقار عمر خيرت.',
    explanationEn: '"Qadiyat Am Ahmed" is one of Omar Khairat’s signature orchestral compositions.',
  },

  // ======================== WORDPLAY & LOGIC (16) ========================
  {
    category: 'wordplay_logic',
    difficulty: 'easy',
    questionAr: 'ما الرقم التالي في المتسلسلة: ٢، ٤، ٨، ١٦، ___ ؟',
    questionEn: 'What number comes next in the sequence: 2, 4, 8, 16, ___?',
    optionsAr: ['٢٤', '٣٠', '٣٢', '٣٦'],
    optionsEn: ['24', '30', '32', '36'],
    correctOptionIndex: 2,
    explanationAr: 'كل رقم يساوي ضعف الرقم السابق له: ١٦ × ٢ = ٣٢.',
    explanationEn: 'Each term doubles the previous number: 16 × 2 = 32.',
  },
  {
    category: 'wordplay_logic',
    difficulty: 'easy',
    questionAr: 'في مجموعة بطولة من ٣ لاعبين يلعب كل لاعب ضد الآخر مرة واحدة، كم عدد مباريات المجموعة؟',
    questionEn: 'In a tournament group of 3 players where every pair plays once (1v1), how many matches are played?',
    optionsAr: ['مباراتان', '٣ مباريات', '٤ مباريات', '٦ مباريات'],
    optionsEn: ['2 matches', '3 matches', '4 matches', '6 matches'],
    correctOptionIndex: 1,
    explanationAr: 'المواجهات هي (أ ضد ب)، (ب ضد ج)، (أ ضد ج) أي ٣ مباريات.',
    explanationEn: 'The round-robin pairs are A vs B, B vs C, and A vs C — 3 matches total.',
  },
  {
    category: 'wordplay_logic',
    difficulty: 'easy',
    questionAr: 'ما هو الضد الدقيق (العكس) لكلمة «قديم»؟',
    questionEn: 'Which word is the exact opposite (antonym) of "Ancient"?',
    optionsAr: ['عتيق', 'حديث', 'بطيء', 'بعيد'],
    optionsEn: ['Antique', 'Modern', 'Slow', 'Distant'],
    correctOptionIndex: 1,
    explanationAr: 'ضد «قديم» هو «حديث» (أو جديد).',
    explanationEn: '"Modern" is the direct antonym of "Ancient".',
  },
  {
    category: 'wordplay_logic',
    difficulty: 'easy',
    questionAr: 'ما ناتج العملية الحسابية: (١٥ × ٤) − ١٢ ؟',
    questionEn: 'What is the result of (15 × 4) − 12?',
    optionsAr: ['٤٢', '٤٦', '٤٨', '٥٢'],
    optionsEn: ['42', '46', '48', '52'],
    correctOptionIndex: 2,
    explanationAr: '١٥ × ٤ = ٦٠، ثم ٦٠ − ١٢ = ٤٨.',
    explanationEn: '15 × 4 = 60, and 60 − 12 = 48.',
  },
  {
    category: 'wordplay_logic',
    difficulty: 'medium',
    questionAr: 'إذا عكست ترتيب حروف كلمة «حِبْر»، ما الكلمة العربية الصحيحة التي تحصل عليها؟',
    questionEn: 'If you reverse the letters of the English word "STAR", which word do you get?',
    optionsAr: ['بَحْر', 'رِبْح', 'حَرْب', 'رَحْب'],
    optionsEn: ['ARTS', 'RATS', 'TARS', 'CART'],
    correctOptionIndex: 1,
    explanationAr: 'عكس حروف «ح - ب - ر» يعطي «ر - ب - ح» (رِبْح).',
    explanationEn: 'Reversing S-T-A-R letter by letter spells R-A-T-S.',
  },
  {
    category: 'wordplay_logic',
    difficulty: 'easy',
    questionAr: 'عندما تشير الساعة إلى تمام الثالثة (٣:٠٠)، ما قياس الزاوية بين عقربي الساعات والدقائق؟',
    questionEn: 'When a clock reads exactly 3:00, what is the angle between the hour and minute hands?',
    optionsAr: ['٤٥ درجة', '٦٠ درجة', '٩٠ درجة', '١٢٠ درجة'],
    optionsEn: ['45°', '60°', '90°', '120°'],
    correctOptionIndex: 2,
    explanationAr: 'عقرب الدقائق عند ١٢ وعقرب الساعات عند ٣ يصنعان زاوية قائمة قياسها ٩٠ درجة.',
    explanationEn: 'At 3:00, the hands stand a quarter-turn apart, forming a 90° right angle.',
  },
  {
    category: 'wordplay_logic',
    difficulty: 'medium',
    questionAr: 'أي شكل مما يلي يُعد الدخيل (المختلف) عن البقية؟',
    questionEn: 'Which shape does NOT belong with the others?',
    optionsAr: ['مثلث', 'مربع', 'مكعب', 'خماسي الأضلاع'],
    optionsEn: ['Triangle', 'Square', 'Cube', 'Pentagon'],
    correctOptionIndex: 2,
    explanationAr: 'المكعب مجسّم ثلاثي الأبعاد، بينما باقي الأشكال مستوية ثنائية الأبعاد.',
    explanationEn: 'A cube is a 3D solid, whereas the other three are flat 2D polygons.',
  },
  {
    category: 'wordplay_logic',
    difficulty: 'medium',
    questionAr: 'إذا أدار ٦ حكام ٦ مباريات في وقت واحد خلال ٦ دقائق، فكم دقيقة يحتاج ١٢ حكماً لإدارة ١٢ مباراة في وقت واحد؟',
    questionEn: 'If 6 judges run 6 simultaneous matches in 6 minutes, how many minutes do 12 judges need for 12 simultaneous matches?',
    optionsAr: ['٣ دقائق', '٦ دقائق', '١٢ دقيقة', '٢٤ دقيقة'],
    optionsEn: ['3 minutes', '6 minutes', '12 minutes', '24 minutes'],
    correctOptionIndex: 1,
    explanationAr: 'كل حكم يدير مباراته بالتوازي خلال ٦ دقائق، لذا فالوقت الإجمالي يبقى ٦ دقائق.',
    explanationEn: 'Each judge handles one match in parallel, so all 12 finish in the same 6 minutes.',
  },
  {
    category: 'wordplay_logic',
    difficulty: 'easy',
    questionAr: 'ما الرقم التالي في متتالية فيبوناتشي: ١، ١، ٢، ٣، ٥، ٨، ___ ؟',
    questionEn: 'What comes next in the Fibonacci sequence: 1, 1, 2, 3, 5, 8, ___?',
    optionsAr: ['١١', '١٢', '١٣', '١٥'],
    optionsEn: ['11', '12', '13', '15'],
    correctOptionIndex: 2,
    explanationAr: 'كل عدد هو مجموع العددين السابقين له: ٥ + ٨ = ١٣.',
    explanationEn: 'Each term equals the sum of the two before it: 5 + 8 = 13.',
  },
  {
    category: 'wordplay_logic',
    difficulty: 'medium',
    questionAr: 'في بطولة خروج المغلوب (١ ضد ١) تضم ١٦ لاعباً دون تعادل، كم عدد المباريات الإجمالية لتتويج بطل واحد؟',
    questionEn: 'In a 16-player single-elimination knockout bracket (no draws), how many matches determine the champion?',
    optionsAr: ['٨ مباريات', '١٤ مباراة', '١٥ مباراة', '١٦ مباراة'],
    optionsEn: ['8 matches', '14 matches', '15 matches', '16 matches'],
    correctOptionIndex: 2,
    explanationAr: 'كل مباراة تُقصي لاعباً واحداً، ولإقصاء ١٥ لاعباً نحتاج ١٥ مباراة بالضبط.',
    explanationEn: 'Every match eliminates 1 player, so eliminating 15 players takes exactly 15 matches.',
  },
  {
    category: 'wordplay_logic',
    difficulty: 'easy',
    questionAr: 'كم يبلغ مجموع قياسات الزوايا الداخلية لأي مثلث؟',
    questionEn: 'What is the sum of the interior angles of any triangle?',
    optionsAr: ['٩٠ درجة', '١٨٠ درجة', '٢٧٠ درجة', '٣٦٠ درجة'],
    optionsEn: ['90°', '180°', '270°', '360°'],
    correctOptionIndex: 1,
    explanationAr: 'مجموع زوايا أي مثلث في الهندسة الإقليدية يساوي دائماً ١٨٠ درجة.',
    explanationEn: 'The interior angles of a Euclidean triangle always add up to 180°.',
  },
  {
    category: 'wordplay_logic',
    difficulty: 'medium',
    questionAr: 'إذا كان اليوم هو الثلاثاء، فما هو اليوم بعد مرور ١٠ أيام من الآن؟',
    questionEn: 'If today is Tuesday, what day of the week will it be 10 days from now?',
    optionsAr: ['الخميس', 'الجمعة', 'السبت', 'الأحد'],
    optionsEn: ['Thursday', 'Friday', 'Saturday', 'Sunday'],
    correctOptionIndex: 1,
    explanationAr: 'بعد ٧ أيام نعود للثلاثاء، وبإضافة ٣ أيام نصل إلى يوم الجمعة.',
    explanationEn: '7 days later is Tuesday again; adding 3 more days lands on Friday.',
  },
  {
    category: 'wordplay_logic',
    difficulty: 'hard',
    questionAr: 'أي رقم من الأرقام التالية يُعد مربعاً كاملاً ومكعباً كاملاً في آن واحد؟',
    questionEn: 'Which of the following numbers is BOTH a perfect square and a perfect cube?',
    optionsAr: ['١٦', '٣٦', '٦٤', '٨١'],
    optionsEn: ['16', '36', '64', '81'],
    correctOptionIndex: 2,
    explanationAr: 'العدد ٦٤ يساوي ٨² (٨×٨) ويساوي أيضاً ٤³ (٤×٤×٤).',
    explanationEn: '64 equals both 8² (8×8) and 4³ (4×4×4).',
  },
  {
    category: 'wordplay_logic',
    difficulty: 'easy',
    questionAr: 'في سباق جري، إذا تجاوزت المتسابق الذي يحتل المركز الثاني، ما هو مركزك الآن؟',
    questionEn: 'In a footrace, if you overtake the runner currently in 2nd place, what place are you in now?',
    optionsAr: ['المركز الأول', 'المركز الثاني', 'المركز الثالث', 'المركز الرابع'],
    optionsEn: ['1st place', '2nd place', '3rd place', '4th place'],
    correctOptionIndex: 1,
    explanationAr: 'بتجاوزك صاحب المركز الثاني فأنت تحل محله في المركز الثاني.',
    explanationEn: 'Passing the runner in 2nd place puts you into 2nd place (the leader is still ahead).',
  },
  {
    category: 'wordplay_logic',
    difficulty: 'easy',
    questionAr: 'اختبار مكون من ٢٠ سؤالاً بواقع ١٠ ثوانٍ لكل سؤال؛ ما هو أقصى زمن إجمالي بالثواني لمحاولة واحدة؟',
    questionEn: 'A quiz has 20 questions with 10 seconds per question. What is the maximum total time in seconds for one attempt?',
    optionsAr: ['١٢٠ ثانية', '١٨٠ ثانية', '٢٠٠ ثانية', '٢٤٠ ثانية'],
    optionsEn: ['120 seconds', '180 seconds', '200 seconds', '240 seconds'],
    correctOptionIndex: 2,
    explanationAr: '٢٠ سؤالاً × ١٠ ثوانٍ = ٢٠٠ ثانية كحد أقصى.',
    explanationEn: '20 questions × 10 seconds = 200 seconds maximum.',
  },
  {
    category: 'wordplay_logic',
    difficulty: 'medium',
    questionAr: 'إذا ضمّت مجموعة ٤ لاعبين ولعب كل لاعب ضد الآخر مرة واحدة، كم إجمالي المباريات في المجموعة؟',
    questionEn: 'If a group has 4 players playing 1v1 round-robin (every pair plays once), how many total matches are played?',
    optionsAr: ['٤ مباريات', '٦ مباريات', '٨ مباريات', '١٢ مباراة'],
    optionsEn: ['4 matches', '6 matches', '8 matches', '12 matches'],
    correctOptionIndex: 1,
    explanationAr: 'عدد المباريات = ٤ × ٣ ÷ ٢ = ٦ مباريات.',
    explanationEn: 'By n(n−1)/2, 4 × 3 / 2 = 6 total matches.',
  },
];

export function createSeededQuizQuestions(): QuizQuestion[] {
  const baseCreated = '2027-02-25T12:00:00.000Z';
  return RAW_QUIZ_QUESTIONS.map((q, idx) => ({
    id: `qq-${String(idx + 1).padStart(2, '0')}`,
    category: q.category,
    difficulty: q.difficulty,
    // Strictly draft so human review is required before launch (AGENTS.md §16.1)
    reviewStatus: 'draft',
    questionAr: q.questionAr,
    questionEn: q.questionEn,
    optionsAr: q.optionsAr,
    optionsEn: q.optionsEn,
    correctOptionIndex: q.correctOptionIndex,
    explanationAr: q.explanationAr,
    explanationEn: q.explanationEn,
    createdAt: baseCreated,
    updatedAt: baseCreated,
  }));
}

// Name pools for 1,200 procedural quiz applicants (authentic Egyptian EN/AR pairs)
const QUIZ_FIRST_M: Array<[string, string]> = [
  ['Yassin', 'ياسين'],
  ['Mostafa', 'مصطفى'],
  ['Omar', 'عمر'],
  ['Ahmed', 'أحمد'],
  ['Karim', 'كريم'],
  ['Youssef', 'يوسف'],
  ['Mahmoud', 'محمود'],
  ['Ziad', 'زياد'],
  ['Seif', 'سيف'],
  ['Adam', 'آدم'],
  ['Tarek', 'طارق'],
  ['Khaled', 'خالد'],
  ['Hossam', 'حسام'],
  ['Amr', 'عمرو'],
  ['Sherif', 'شريف'],
  ['Bassem', 'باسم'],
  ['Hazem', 'حازم'],
  ['Adham', 'أدهم'],
  ['Mina', 'مينا'],
  ['Fady', 'فادي'],
  ['Marwan', 'مروان'],
  ['Belal', 'بلال'],
  ['Eslam', 'إسلام'],
  ['Ramy', 'رامي'],
  ['Yehia', 'يحيى'],
  ['Nader', 'نادر'],
  ['Hany', 'هاني'],
  ['Wael', 'وائل'],
  ['Walid', 'وليد'],
  ['Mohamed', 'محمد'],
];

const QUIZ_FIRST_F: Array<[string, string]> = [
  ['Salma', 'سلمى'],
  ['Mariam', 'مريم'],
  ['Nourhan', 'نورهان'],
  ['Malak', 'ملك'],
  ['Hana', 'هنا'],
  ['Jana', 'جنى'],
  ['Rawan', 'روان'],
  ['Menna', 'منة'],
  ['Sara', 'سارة'],
  ['Yara', 'يارا'],
  ['Reem', 'ريم'],
  ['Dina', 'دينا'],
  ['Farida', 'فريدة'],
  ['Nada', 'ندى'],
  ['Yasmin', 'ياسمين'],
  ['Laila', 'ليلى'],
  ['Rana', 'رنا'],
  ['Habiba', 'حبيبة'],
  ['Aya', 'آية'],
  ['Esraa', 'إسراء'],
  ['Mai', 'مي'],
  ['Hager', 'هاجر'],
  ['Donia', 'دنيا'],
  ['Zeina', 'زينة'],
  ['Shahd', 'شهد'],
  ['Nour', 'نور'],
  ['Talia', 'تاليا'],
  ['Karma', 'كارما'],
  ['Farah', 'فرح'],
  ['Jomana', 'جمانة'],
];

const QUIZ_LAST: Array<[string, string]> = [
  ['El-Sayed', 'السيد'],
  ['Hassan', 'حسن'],
  ['Mansour', 'منصور'],
  ['Ibrahim', 'إبراهيم'],
  ['El-Masry', 'المصري'],
  ['Gamal', 'جمال'],
  ['Farouk', 'فاروق'],
  ['Nassar', 'نصار'],
  ['Khattab', 'خطاب'],
  ['Shawky', 'شوقي'],
  ['Suleiman', 'سليمان'],
  ['Fawzy', 'فوزي'],
  ['Barakat', 'بركات'],
  ['Helmy', 'حلمي'],
  ['Zayed', 'زايد'],
  ['Rostom', 'رستم'],
  ['Allam', 'علام'],
  ['Sabry', 'صبري'],
  ['El-Shazly', 'الشاذلي'],
  ['Abdelrahman', 'عبد الرحمن'],
  ['Badr', 'بدر'],
  ['Galal', 'جلال'],
  ['Diab', 'دياب'],
  ['Lotfy', 'لطفي'],
  ['Raafat', 'رأفت'],
  ['Mekky', 'مكي'],
  ['Saleh', 'صالح'],
  ['Rashad', 'رشاد'],
  ['El-Gendy', 'الجندي'],
  ['Hamdy', 'حمدي'],
  ['Metwally', 'متولي'],
  ['Adel', 'عادل'],
  ['Samir', 'سمير'],
  ['Nabil', 'نبيل'],
  ['Tarek', 'طارق'],
  ['Anwar', 'أنور'],
  ['Ashraf', 'أشرف'],
  ['Mourad', 'مراد'],
  ['Kamel', 'كامل'],
  ['Osama', 'أسامة'],
];

// 5 intentional overlaps with the top tournament players (010-0000-0001..0005)
// so "Send qualified applicants to the tournament" showcases realistic duplicate-skipping in Impact Preview.
const OVERLAP_DEMO_APPLICANTS: Array<{
  fullName: string;
  fullNameAr: string;
  phone: string;
  email: string;
}> = [
  { fullName: 'Omar Hassan', fullNameAr: 'عمر حسن', phone: '010-0000-0001', email: 'omar.hassan@players.casino' },
  { fullName: 'Youssef Adel', fullNameAr: 'يوسف عادل', phone: '010-0000-0002', email: 'youssef.adel@players.casino' },
  { fullName: 'Mostafa Gamal', fullNameAr: 'مصطفى جمال', phone: '010-0000-0003', email: 'mostafa.gamal@players.casino' },
  { fullName: 'Karim Nabil', fullNameAr: 'كريم نبيل', phone: '010-0000-0004', email: 'karim.nabil@players.casino' },
  { fullName: 'Ahmed Samir', fullNameAr: 'أحمد سمير', phone: '010-0000-0005', email: 'ahmed.samir@players.casino' },
];

export interface QuizSeedBundle {
  quizQuestions: QuizQuestion[];
  quizApplicants: QuizApplicant[];
  quizAttempts: QuizAttempt[];
  quizEvents: QuizAttemptEvent[];
  quizHandoffs: QuizHandoffEvent[];
  quizSettings: QuizSettings;
}

/**
 * Generates deterministic seeded quiz data:
 * - 64 original bilingual draft questions
 * - N applicants (default 1,200) with realistic EN/AR names & 010-0000-xxxx fake phone numbers
 * - Authentic append-only QuizAttemptEvent logs deriving bell-curve scores, response times,
 *   ~3.5% incomplete/abandoned attempts, and ~4.5% client-side integrity-flagged attempts.
 */
export function createSeededQuizBundle(options?: {
  applicantCount?: number;
  nowMs?: number;
}): QuizSeedBundle {
  const nowMs = options?.nowMs ?? Date.now();
  const count = Math.max(0, options?.applicantCount ?? DEFAULT_QUIZ_APPLICANT_COUNT);
  const quizSettings = createDefaultQuizSettings(nowMs);
  const quizQuestions = createSeededQuizQuestions();

  if (count === 0) {
    return {
      quizQuestions,
      quizApplicants: [],
      quizAttempts: [],
      quizEvents: [],
      quizHandoffs: [],
      quizSettings,
    };
  }

  const rng = createSeededRng('casino-quiz-demo-seed-v4');
  const questionById = new Map(quizQuestions.map((q) => [q.id, q]));
  const questionsPerAttempt = quizSettings.questionsPerAttempt;
  const maxQMs = quizSettings.secondsPerQuestion * 1000;

  const quizApplicants: QuizApplicant[] = [];
  const quizAttempts: QuizAttempt[] = [];
  const quizEvents: QuizAttemptEvent[] = [];
  const quizHandoffs: QuizHandoffEvent[] = [];

  const windowStartMs = Date.parse(quizSettings.windowStartsAt);
  const spanMs = Math.max(60 * 60 * 1000, nowMs - windowStartMs - 20 * 60 * 1000);

  // Sample realistic normal-like target accuracy using Box-Muller / Irwin-Hall sum of 4 uniforms
  const sampleTargetCorrect = (idx: number): number => {
    if (idx < 5) {
      // Ensure the 5 intentional overlap applicants score high (17..19) so they sit well inside top 720
      return 17 + (idx % 3);
    }
    // Sum of 4 uniforms in [0,1] -> mean 2.0, std ~0.58; map to mean ~12.2 / 20
    const u = rng() + rng() + rng() + rng(); // [0..4]
    const raw = Math.round(2 + u * 5.05);
    return Math.max(2, Math.min(questionsPerAttempt, raw));
  };

  let evSeq = 0;

  for (let i = 0; i < count; i += 1) {
    const seqNum = i + 1;
    const applicantId = `qa-${String(seqNum).padStart(4, '0')}`;
    const attemptId = `qatt-${String(seqNum).padStart(4, '0')}`;

    let fullName: string;
    let fullNameAr: string;
    let phone: string;
    let email: string;

    if (i < OVERLAP_DEMO_APPLICANTS.length && count >= 10) {
      const ov = OVERLAP_DEMO_APPLICANTS[i];
      fullName = ov.fullName;
      fullNameAr = ov.fullNameAr;
      phone = ov.phone;
      email = ov.email;
    } else {
      const isFemale = i % 2 === 1;
      const firstPool = isFemale ? QUIZ_FIRST_F : QUIZ_FIRST_M;
      const first = firstPool[Math.floor(i / 2) % firstPool.length];
      const lastIdx = (Math.floor(i / 60) * 7 + i) % QUIZ_LAST.length;
      const last = QUIZ_LAST[lastIdx];
      fullName = `${first[0]} ${last[0]}`;
      fullNameAr = `${first[1]} ${last[1]}`;
      const phoneNum = 1001 + i;
      phone = `010-0000-${String(phoneNum).padStart(4, '0')}`;
      const slug = `${first[0]}.${last[0]}`.toLowerCase().replace(/[^a-z.]/g, '');
      email = `${slug}.${phoneNum}@applicants.casino-demo.test`;
    }

    const offsetMs = Math.floor(rng() * spanMs);
    const createdMs = windowStartMs + offsetMs;
    const verifiedMs = createdMs + 25_000;
    const startedMs = verifiedMs + 12_000;

    const applicant: QuizApplicant = {
      id: applicantId,
      fullName,
      fullNameAr,
      phone,
      normalizedPhone: normalizeQuizPhone(phone),
      email,
      normalizedEmail: normalizeQuizEmail(email),
      verifiedAt: new Date(verifiedMs).toISOString(),
      verificationChannel:
        i % 5 === 0 ? 'email' : i % 3 === 0 ? 'whatsapp' : 'whatsapp_or_sms',
      consentAcceptedAt: new Date(createdMs).toISOString(),
      createdAt: new Date(createdMs).toISOString(),
    };
    quizApplicants.push(applicant);

    // ~3.5% (~42 of 1200) incomplete / abandoned attempts (never for overlap demo rows)
    const isAbandoned = i >= 15 && i % 29 === 0;
    // ~4.5% (~54 of 1200) client-side integrity flagged attempts
    const isFlagged = i >= 10 && i % 22 === 0;

    const shuffleSeed = `seed-${applicantId}-v4`;
    const questionIds = selectShuffledQuestionIds(
      quizQuestions,
      questionsPerAttempt,
      shuffleSeed
    );

    const attempt: QuizAttempt = {
      id: attemptId,
      applicantId,
      shuffleSeed,
      questionIds,
      questionsCount: questionIds.length,
      secondsPerQuestion: quizSettings.secondsPerQuestion,
      startedAt: new Date(startedMs).toISOString(),
      createdAt: new Date(startedMs).toISOString(),
    };
    quizAttempts.push(attempt);

    // 1. started event
    evSeq += 1;
    quizEvents.push({
      id: `qev-${evSeq}`,
      attemptId,
      applicantId,
      type: 'started',
      createdAt: new Date(startedMs).toISOString(),
    });

    const targetCorrect = sampleTargetCorrect(i);
    // Pick exact indices that this simulated applicant answers correctly
    const indices = Array.from({ length: questionIds.length }, (_, k) => k);
    for (let k = indices.length - 1; k > 0; k -= 1) {
      const swapIdx = Math.floor(rng() * (k + 1));
      const tmp = indices[k];
      indices[k] = indices[swapIdx];
      indices[swapIdx] = tmp;
    }
    const correctSet = new Set(indices.slice(0, targetCorrect));

    const questionsToPlay = isAbandoned
      ? 4 + Math.floor(rng() * 11) // stopped between Q4 and Q14
      : questionIds.length;

    let cursorMs = startedMs + 400;

    for (let qIdx = 0; qIdx < questionsToPlay; qIdx += 1) {
      const qId = questionIds[qIdx];
      const q = questionById.get(qId)!;
      const optionOrder = getShuffledOptionOrder(attemptId, qId, shuffleSeed);
      const shownIso = new Date(cursorMs).toISOString();
      const deadlineIso = new Date(cursorMs + maxQMs).toISOString();

      const willCorrect = correctSet.has(qIdx);
      const willTimeout = !willCorrect && rng() < 0.28;

      if (willTimeout) {
        cursorMs += maxQMs;
        evSeq += 1;
        quizEvents.push({
          id: `qev-${evSeq}`,
          attemptId,
          applicantId,
          type: 'timed_out',
          questionId: qId,
          questionIndex: qIdx,
          shownAt: shownIso,
          deadlineAt: deadlineIso,
          responseTimeMs: maxQMs,
          createdAt: new Date(cursorMs).toISOString(),
        });
      } else {
        // Faster responses for higher-scoring applicants, realistic 1.6s..8.9s spread
        const skillBias = (questionsPerAttempt - targetCorrect) * 110;
        const responseMs = Math.max(
          1350,
          Math.min(maxQMs - 350, Math.round(2100 + skillBias + rng() * 5100))
        );
        cursorMs += responseMs;

        let canonicalChoice = q.correctOptionIndex;
        if (!willCorrect) {
          const wrongChoices = [0, 1, 2, 3].filter(
            (c) => c !== q.correctOptionIndex
          );
          canonicalChoice = wrongChoices[Math.floor(rng() * wrongChoices.length)];
        }
        const displayedSlot = Math.max(0, optionOrder.indexOf(canonicalChoice));

        evSeq += 1;
        quizEvents.push({
          id: `qev-${evSeq}`,
          attemptId,
          applicantId,
          type: 'answered',
          questionId: qId,
          questionIndex: qIdx,
          selectedOptionIndex: canonicalChoice,
          displayedSlotIndex: displayedSlot,
          shownAt: shownIso,
          deadlineAt: deadlineIso,
          responseTimeMs: responseMs,
          createdAt: new Date(cursorMs).toISOString(),
        });
      }

      // Attach realistic client-side integrity signals for flagged attempts
      if (isFlagged && (qIdx === 3 || (i % 44 === 0 && qIdx === 11))) {
        const sigRoll = (i + qIdx) % 3;
        const signalType =
          sigRoll === 0
            ? 'visibility_hidden'
            : sigRoll === 1
              ? 'page_refresh'
              : 'copy_attempt';
        evSeq += 1;
        quizEvents.push({
          id: `qev-${evSeq}`,
          attemptId,
          applicantId,
          type: 'integrity_signal',
          questionId: qId,
          questionIndex: qIdx,
          signalType,
          createdAt: new Date(cursorMs - 200).toISOString(),
        });
      }

      // Brief inter-question transition gap
      cursorMs += 250;
    }

    if (!isAbandoned) {
      evSeq += 1;
      quizEvents.push({
        id: `qev-${evSeq}`,
        attemptId,
        applicantId,
        type: 'finished',
        createdAt: new Date(cursorMs + 100).toISOString(),
      });
    }
  }

  return {
    quizQuestions,
    quizApplicants,
    quizAttempts,
    quizEvents,
    quizHandoffs,
    quizSettings,
  };
}
