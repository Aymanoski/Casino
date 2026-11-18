import type {
  AuditEntry,
  BuzzEvent,
  ContentItem,
  DatabaseSnapshot,
  Game,
  Player,
  Round,
  ScoreEvent,
  Segment,
  Settings,
  Sponsor,
  User,
} from '@/lib/schemas';

export const SEED_VERSION = 1;

const RAW_PLAYERS: Array<{
  id: string;
  fullName: string;
  fullNameAr: string;
  nickname: string;
  nicknameAr: string;
  seed: number;
}> = [
  { id: 'player-1', fullName: 'Omar Hassan', fullNameAr: 'عمر حسن', nickname: 'The Fox', nicknameAr: 'الثعلب', seed: 1 },
  { id: 'player-2', fullName: 'Youssef Adel', fullNameAr: 'يوسف عادل', nickname: 'Joe', nicknameAr: 'جو', seed: 2 },
  { id: 'player-3', fullName: 'Mostafa Gamal', fullNameAr: 'مصطفى جمال', nickname: 'Tofa', nicknameAr: 'توفة', seed: 3 },
  { id: 'player-4', fullName: 'Karim Nabil', fullNameAr: 'كريم نبيل', nickname: 'K-Nab', nicknameAr: 'كيمو', seed: 4 },
  { id: 'player-5', fullName: 'Ahmed Samir', fullNameAr: 'أحمد سمير', nickname: 'Sammoora', nicknameAr: 'سمورة', seed: 5 },
  { id: 'player-6', fullName: 'Mahmoud Fathy', fullNameAr: 'محمود فتحي', nickname: 'Abu Fathy', nicknameAr: 'أبو فتحي', seed: 6 },
  { id: 'player-7', fullName: 'Ali Tarek', fullNameAr: 'علي طارق', nickname: 'Ali Baba', nicknameAr: 'علي بابا', seed: 7 },
  { id: 'player-8', fullName: 'Hossam Ragab', fullNameAr: 'حسام رجب', nickname: 'Hoss', nicknameAr: 'حس', seed: 8 },
  { id: 'player-9', fullName: 'Ibrahim Zaki', fullNameAr: 'إبراهيم زكي', nickname: 'Brahim', nicknameAr: 'إبراهيمو', seed: 9 },
  { id: 'player-10', fullName: 'Khaled Mansour', fullNameAr: 'خالد منصور', nickname: 'Khaldoon', nicknameAr: 'خلدون', seed: 10 },
  { id: 'player-11', fullName: 'Tamer Essam', fullNameAr: 'تامر عصام', nickname: 'Timo', nicknameAr: 'تيمو', seed: 11 },
  { id: 'player-12', fullName: 'Sherif Magdy', fullNameAr: 'شريف مجدي', nickname: 'Sheriff', nicknameAr: 'الشريف', seed: 12 },
  { id: 'player-13', fullName: 'Amr Wael', fullNameAr: 'عمرو وائل', nickname: 'Amoora', nicknameAr: 'عمورة', seed: 13 },
  { id: 'player-14', fullName: 'Hany Salah', fullNameAr: 'هاني صلاح', nickname: 'Hanoon', nicknameAr: 'حنون', seed: 14 },
  { id: 'player-15', fullName: 'Walid Anwar', fullNameAr: 'وليد أنور', nickname: 'Wally', nicknameAr: 'والي', seed: 15 },
  { id: 'player-16', fullName: 'Mina Girgis', fullNameAr: 'مينا جرجس', nickname: 'Mino', nicknameAr: 'مينو', seed: 16 },
  { id: 'player-17', fullName: 'Fady Samy', fullNameAr: 'فادي سامي', nickname: 'Fadi', nicknameAr: 'فادو', seed: 17 },
  { id: 'player-18', fullName: 'Nour El-Din Hesham', fullNameAr: 'نور الدين هشام', nickname: 'Nouro', nicknameAr: 'نورو', seed: 18 },
  { id: 'player-19', fullName: 'Salma Reda', fullNameAr: 'سلمى رضا', nickname: 'Salsabeel', nicknameAr: 'سلسبيل', seed: 19 },
  { id: 'player-20', fullName: 'Mariam Hatem', fullNameAr: 'مريم حاتم', nickname: 'Mimi', nicknameAr: 'ميمي', seed: 20 },
  { id: 'player-21', fullName: 'Dina Yasser', fullNameAr: 'دينا ياسر', nickname: 'Dodo', nicknameAr: 'دودو', seed: 21 },
  { id: 'player-22', fullName: 'Farida Ashraf', fullNameAr: 'فريدة أشرف', nickname: 'Fofo', nicknameAr: 'فوفو', seed: 22 },
  { id: 'player-23', fullName: 'Nada Ehab', fullNameAr: 'ندى إيهاب', nickname: 'Nody', nicknameAr: 'نودي', seed: 23 },
  { id: 'player-24', fullName: 'Yasmin Mourad', fullNameAr: 'ياسمين مراد', nickname: 'Yaso', nicknameAr: 'ياسو', seed: 24 },
  { id: 'player-25', fullName: 'Laila Kamel', fullNameAr: 'ليلى كامل', nickname: 'Lulu', nicknameAr: 'لولو', seed: 25 },
  { id: 'player-26', fullName: 'Rana Sherif', fullNameAr: 'رنا شريف', nickname: 'Rouny', nicknameAr: 'روني', seed: 26 },
  { id: 'player-27', fullName: 'Habiba Osama', fullNameAr: 'حبيبة أسامة', nickname: 'Bibo', nicknameAr: 'بيبو', seed: 27 },
];

export function createSeedSnapshot(): DatabaseSnapshot {
  const segments: Segment[] = [
    // Music and singing (1-5)
    {
      id: 'seg-1',
      nameEn: 'A Song by the Artist',
      nameAr: 'أغنية للفنان / للفنانة',
      category: 'music',
      descriptionEn: 'The host names a singer; the first player to buzz and sing a valid line from their catalog takes the points.',
      descriptionAr: 'يذكر المقدم اسم مطرب أو مطربة، وأول لاعب يضغط الجرس ويغني مقطعاً صحيحاً يحصد النقاط.',
      durationSec: 45,
      presetPoints: [10, 5, -5],
      order: 1,
    },
    {
      id: 'seg-2',
      nameEn: 'A Song by a Famous Band',
      nameAr: 'أغنية لفرقة مشهورة',
      category: 'music',
      descriptionEn: 'Identify or perform a hit track recorded by an iconic Arab or international musical group before time runs out.',
      descriptionAr: 'تعرّف على أغنية شهيرة لفرقة موسيقية عربية أو عالمية أو غنِّ مقطعاً منها قبل انتهاء الوقت.',
      durationSec: 45,
      presetPoints: [10, 5, -5],
      order: 2,
    },
    {
      id: 'seg-3',
      nameEn: 'Put the Word in a Song',
      nameAr: 'حط الكلمة في أغنية',
      category: 'music',
      descriptionEn: 'A random everyday word appears on screen—buzz in and sing real lyrics containing that exact word.',
      descriptionAr: 'تظهر كلمة عشوائية على الشاشة، وعليك الضغط سريعاً وغناء كوبليه حقيقي يحتوي على هذه الكلمة بالضبط.',
      durationSec: 30,
      presetPoints: [10, 5, -5],
      order: 3,
    },
    {
      id: 'seg-4',
      nameEn: 'Reversed / Unreversed Song',
      nameAr: 'أغنية معكوسة / غير معكوسة',
      category: 'music',
      descriptionEn: 'Listen to a short audio hook or backwards lyric clue and decode the original track title first.',
      descriptionAr: 'استمع إلى جملة موسيقية أو كلمات مقلوبة واكشف اسم الأغنية الأصلية قبل منافسيك.',
      durationSec: 60,
      presetPoints: [10, 5, -5],
      order: 4,
    },
    {
      id: 'seg-5',
      nameEn: 'Guess the Singer / Track',
      nameAr: 'تخمين المغني أو الأغنية',
      category: 'music',
      descriptionEn: 'Rapid-fire musical clues where players earn full points for naming both the vocalist and the song.',
      descriptionAr: 'تلميحات موسيقية سريعة يحصل فيها اللاعب على النقاط الكاملة عند تسمية المطرب والأغنية معاً.',
      durationSec: 45,
      presetPoints: [10, 5, -5],
      order: 5,
    },

    // Wordplay and speed (6-9)
    {
      id: 'seg-6',
      nameEn: 'Reversed Words',
      nameAr: 'كلمات معكوسة',
      category: 'wordplay',
      descriptionEn: 'Flip the letters of spoken words in your head and pronounce the reversed word cleanly under pressure.',
      descriptionAr: 'اقلب حروف الكلمات المنطوقة في ذهنك وانطق الكلمة معكوسة بدقة وتحت ضغط الوقت.',
      durationSec: 45,
      presetPoints: [10, 5, -5],
      order: 6,
    },
    {
      id: 'seg-7',
      nameEn: 'A Word Takes You, A Word Brings You',
      nameAr: 'كلمة توديك وكلمة تجيبك',
      category: 'wordplay',
      descriptionEn: 'Chain associations and witty verbal pivots without hesitating, repeating a word, or breaking rhythm.',
      descriptionAr: 'سلسلة من الروابط اللفظية السريعة دون تردد أو تكرار أو كسر الإيقاع.',
      durationSec: 60,
      presetPoints: [10, 5, -5],
      order: 7,
    },
    {
      id: 'seg-8',
      nameEn: 'The Description',
      nameAr: 'الوصف',
      category: 'wordplay',
      descriptionEn: 'Decode clever riddles and indirect descriptions as clues narrow from vague to unmistakable.',
      descriptionAr: 'فكّ شفرة الأوصاف الذكية والتلميحات المتدرجة من الغموض إلى الوضوح بأسرع وقت.',
      durationSec: 60,
      presetPoints: [10, 5, -5],
      order: 8,
    },
    {
      id: 'seg-9',
      nameEn: 'Name / List It',
      nameAr: 'اذكر / عدّد',
      category: 'wordplay',
      descriptionEn: 'Beat the countdown by naming as many valid items in the target category as you can before buzzing out.',
      descriptionAr: 'سابق العد التنازلي بتعداد أكبر قدر ممكن من الإجابات الصحيحة داخل الفئة المطلوبة.',
      durationSec: 45,
      presetPoints: [10, 5, -5],
      order: 9,
    },

    // Pop culture, cinema and characters (10-13)
    {
      id: 'seg-10',
      nameEn: 'Egyptian Cinema and Series Trivia',
      nameAr: 'أسئلة أفلام ومسلسلات مصرية',
      category: 'popculture',
      descriptionEn: 'Iconic scenes, Ramadan drama classics, and unforgettable characters from Egyptian screen history.',
      descriptionAr: 'مشاهد خالدة، مسلسلات رمضانية شهيرة، وشخصيات لا تُنسى من تاريخ السينما والدراما المصرية.',
      durationSec: 60,
      presetPoints: [10, 5, -5],
      order: 10,
    },
    {
      id: 'seg-11',
      nameEn: 'International Cinema',
      nameAr: 'السينما العالمية',
      category: 'popculture',
      descriptionEn: 'World box-office hits, legendary directors, plot twists, and Oscar-winning performances.',
      descriptionAr: 'أشهر الأفلام العالمية، المخرجون الكبار، الحبكات الدرامية، والأعمال الحائزة على الجوائز.',
      durationSec: 60,
      presetPoints: [10, 5, -5],
      order: 11,
    },
    {
      id: 'seg-12',
      nameEn: 'Famous Figure / A Place Lived In',
      nameAr: 'شخصية شهيرة / مكان يسكن فيه',
      category: 'popculture',
      descriptionEn: 'Connect historical icons, celebrities, or fictional characters to their signature cities and landmarks.',
      descriptionAr: 'اربط بين الشخصيات الشهيرة أو الخيالية والمدن أو الأماكن المرتبطة بها.',
      durationSec: 60,
      presetPoints: [10, 5, -5],
      order: 12,
    },
    {
      id: 'seg-13',
      nameEn: 'Who Said the Quote?',
      nameAr: 'مين قال المقولة',
      category: 'popculture',
      descriptionEn: 'Famous one-liners from comedies, plays, and football commentary—name the speaker and work.',
      descriptionAr: 'إفيهات ومقولات شهيرة من المسرحيات والأفلام والتعليق الرياضي—اذكر صاحب المقولة والعمل.',
      durationSec: 45,
      presetPoints: [10, 5, -5],
      order: 13,
    },

    // General and special (14-16)
    {
      id: 'seg-14',
      nameEn: 'General Knowledge',
      nameAr: 'معلومات عامة',
      category: 'general',
      descriptionEn: 'High-stakes trivia spanning geography, history, science, sports, and Ramadan traditions.',
      descriptionAr: 'معلومات عامة سريعة تشمل الجغرافيا والتاريخ والعلوم والرياضة والتقاليد الرمضانية.',
      durationSec: 60,
      presetPoints: [10, 5, -5],
      order: 14,
    },
    {
      id: 'seg-15',
      nameEn: 'Audience and Fan Questions',
      nameAr: 'فقرة الجمهور / السوشيال ميديا',
      category: 'special',
      descriptionEn: 'Wildcard questions submitted by live studio guests and social media followers with bonus stakes.',
      descriptionAr: 'أسئلة مفاجئة من جمهور الاستوديو ومتابعي السوشيال ميديا بنقاط مضاعفة.',
      durationSec: 60,
      presetPoints: [15, 10, -5],
      order: 15,
    },
    {
      id: 'seg-16',
      nameEn: 'Tie-Breaker and Penalty Challenge',
      nameAr: 'جولة التحدي / الحسم',
      category: 'special',
      descriptionEn: 'Sudden-death showdown activated when qualifying seats are tied—one decisive buzz settles the table.',
      descriptionAr: 'جولة الحسم الفاصلة عند التعادل على بطاقات التأهل—ضغطة جرس واحدة تحسم الفائز.',
      durationSec: 30,
      presetPoints: [15, 5, -5],
      order: 16,
    },
  ];

  const users: User[] = [
    {
      id: 'user-admin',
      name: 'Admin',
      nameAr: 'مدير البطولة',
      email: 'admin@casinoelal3ab.com',
      role: 'superAdmin',
      language: 'en',
      titleEn: 'Tournament Director (Super Admin)',
      titleAr: 'مدير البطولة (صلاحيات كاملة)',
    },
    {
      id: 'user-scorer-1',
      name: 'Scorer 1',
      nameAr: 'حكم طاولة ١',
      email: 'scorer1@casinoelal3ab.com',
      role: 'scorer',
      language: 'en',
      titleEn: 'Lead Table Scorer (Table 1 & Live R2)',
      titleAr: 'حكم النقاط الرئيسي (طاولة ١ والمباشر)',
    },
    {
      id: 'user-scorer-2',
      name: 'Scorer 2',
      nameAr: 'حكم طاولة ٢',
      email: 'scorer2@casinoelal3ab.com',
      role: 'scorer',
      language: 'en',
      titleEn: 'Stage Scorer (Table 2)',
      titleAr: 'حكم نقاط (طاولة ٢)',
    },
    {
      id: 'user-scorer-3',
      name: 'Scorer 3',
      nameAr: 'حكم طاولة ٣',
      email: 'scorer3@casinoelal3ab.com',
      role: 'scorer',
      language: 'en',
      titleEn: 'Stage Scorer (Table 3)',
      titleAr: 'حكم نقاط (طاولة ٣)',
    },
    {
      id: 'user-scorer-4',
      name: 'Scorer 4',
      nameAr: 'حكم طاولة ٤',
      email: 'scorer4@casinoelal3ab.com',
      role: 'scorer',
      language: 'en',
      titleEn: 'Final & Reserve Scorer',
      titleAr: 'حكم النهائي والاحتياط',
    },
    {
      id: 'user-checkin',
      name: 'Gate Staff',
      nameAr: 'مسؤول استقبال اللاعبين',
      email: 'checkin@casinoelal3ab.com',
      role: 'checkIn',
      language: 'en',
      titleEn: 'VIP & Player Check-In Desk',
      titleAr: 'مكتب تسجيل حضور اللاعبين',
    },
    {
      id: 'user-content',
      name: 'Content Editor',
      nameAr: 'محرر المحتوى والفقرات',
      email: 'content@casinoelal3ab.com',
      role: 'content',
      language: 'en',
      titleEn: 'Show Producer & Content Manager',
      titleAr: 'منتج العرض ومدير المحتوى',
    },
    {
      id: 'user-player-1',
      name: 'Omar Hassan "The Fox"',
      nameAr: 'عمر حسن "الثعلب"',
      email: 'omar.hassan@players.casino',
      role: 'player',
      playerId: 'player-1',
      language: 'en',
      titleEn: 'Semi-Finalist Contestant',
      titleAr: 'متسابق متأهل لنصف النهائي',
    },
    {
      id: 'user-player-4',
      name: 'Karim Nabil "K-Nab"',
      nameAr: 'كريم نبيل "كيمو"',
      email: 'karim.nabil@players.casino',
      role: 'player',
      playerId: 'player-4',
      language: 'en',
      titleEn: 'Live Round 2 Contestant',
      titleAr: 'متسابق في المباراة المباشرة',
    },
    {
      id: 'user-player-19',
      name: 'Salma Reda "Salsabeel"',
      nameAr: 'سلمى رضا "سلسبيل"',
      email: 'salma.reda@players.casino',
      role: 'player',
      playerId: 'player-19',
      language: 'en',
      titleEn: 'Round 2 Contestant',
      titleAr: 'متسابقة في الدور الثاني',
    },
  ];

  const rounds: Round[] = [
    {
      id: 'round-1',
      name: { en: 'Round 1 — Opening Tables', ar: 'الدور الأول — طاولات التصفيات' },
      order: 1,
      advancePerGame: 1,
      status: 'live',
    },
    {
      id: 'round-2',
      name: { en: 'Round 2 — Quarter-Final Tables', ar: 'الدور الثاني — ربع النهائي' },
      order: 2,
      advancePerGame: 1,
      status: 'live',
    },
    {
      id: 'round-semi',
      name: { en: 'Semi-Final — The Golden Qualifier', ar: 'نصف النهائي — تصفية المقعدين' },
      order: 3,
      advancePerGame: 2,
      status: 'upcoming',
    },
    {
      id: 'round-final',
      name: { en: 'The Grand Final — vs. Marwan Serry', ar: 'النهائي الكبير — في مواجهة مروان سري' },
      order: 4,
      advancePerGame: 1,
      status: 'upcoming',
    },
  ];

  const stdSegments = ['seg-1', 'seg-3', 'seg-6', 'seg-10', 'seg-13', 'seg-14'];
  const r2Segments = ['seg-2', 'seg-4', 'seg-7', 'seg-10', 'seg-12', 'seg-15'];
  const finalSegments = [
    'seg-1',
    'seg-3',
    'seg-4',
    'seg-6',
    'seg-8',
    'seg-10',
    'seg-13',
    'seg-15',
  ];

  // Games:
  // Pod A: G1 (p1,p2,p3 -> p1 wins), G2 (p7,p8,p9 -> p7 wins), G3 (p13,p14,p15 -> p13 wins) => R2 G10 (p1,p7,p13 -> p1 wins!)
  // Pod B: G4 (p4,p5,p6 -> p4 wins), G5 (p10,p11,p12 -> p10 wins), G6 (p16,p17,p18 -> p18 wins) => R2 G11 (p4,p10,p18 -> LIVE!)
  // Pod C: G7 (p19,p20,p21 -> p19 wins), G8 (p22,p23,p24 -> p22 wins), G9 (p25,p26,p27 -> SCHEDULED) => R2 G12 (p19,p22,p25 -> SCHEDULED)
  const games: Game[] = [
    {
      id: 'game-1',
      roundId: 'round-1',
      tableName: 'Table 1 — Lantern Court',
      tableNameAr: 'طاولة ١ — قاعة الفانوس',
      scheduledAt: '2026-11-16T20:00:00.000Z',
      startedAt: '2026-11-16T20:02:00.000Z',
      finishedAt: '2026-11-16T20:42:00.000Z',
      status: 'finished',
      scorerUserId: 'user-scorer-1',
      playerIds: ['player-1', 'player-2', 'player-3'],
      currentSegmentIndex: 5,
      segmentIds: stdSegments,
      winnerPlayerId: 'player-1',
      advancingPlayerIds: ['player-1'],
      isFinal: false,
      podOrder: 1,
      timer: { status: 'idle', durationSec: 60, remainingSec: 0 },
    },
    {
      id: 'game-2',
      roundId: 'round-1',
      tableName: 'Table 2 — Crescent Lounge',
      tableNameAr: 'طاولة ٢ — صالون الهلال',
      scheduledAt: '2026-11-16T20:00:00.000Z',
      startedAt: '2026-11-16T20:03:00.000Z',
      finishedAt: '2026-11-16T20:45:00.000Z',
      status: 'finished',
      scorerUserId: 'user-scorer-2',
      playerIds: ['player-7', 'player-8', 'player-9'],
      currentSegmentIndex: 5,
      segmentIds: stdSegments,
      winnerPlayerId: 'player-7',
      advancingPlayerIds: ['player-7'],
      isFinal: false,
      podOrder: 2,
      timer: { status: 'idle', durationSec: 60, remainingSec: 0 },
    },
    {
      id: 'game-3',
      roundId: 'round-1',
      tableName: 'Table 3 — Velvet Stage',
      tableNameAr: 'طاولة ٣ — المسرح المخملي',
      scheduledAt: '2026-11-16T21:00:00.000Z',
      startedAt: '2026-11-16T21:01:00.000Z',
      finishedAt: '2026-11-16T21:40:00.000Z',
      status: 'finished',
      scorerUserId: 'user-scorer-3',
      playerIds: ['player-13', 'player-14', 'player-15'],
      currentSegmentIndex: 5,
      segmentIds: stdSegments,
      winnerPlayerId: 'player-13',
      advancingPlayerIds: ['player-13'],
      isFinal: false,
      podOrder: 3,
      timer: { status: 'idle', durationSec: 60, remainingSec: 0 },
    },
    {
      id: 'game-4',
      roundId: 'round-1',
      tableName: 'Table 4 — Gold Majlis',
      tableNameAr: 'طاولة ٤ — المجلس الذهبي',
      scheduledAt: '2026-11-16T21:00:00.000Z',
      startedAt: '2026-11-16T21:04:00.000Z',
      finishedAt: '2026-11-16T21:48:00.000Z',
      status: 'finished',
      scorerUserId: 'user-scorer-1',
      playerIds: ['player-4', 'player-5', 'player-6'],
      currentSegmentIndex: 5,
      segmentIds: stdSegments,
      winnerPlayerId: 'player-4',
      advancingPlayerIds: ['player-4'],
      isFinal: false,
      podOrder: 4,
      timer: { status: 'idle', durationSec: 60, remainingSec: 0 },
    },
    {
      id: 'game-5',
      roundId: 'round-1',
      tableName: 'Table 5 — Starlight Hall',
      tableNameAr: 'طاولة ٥ — قاعة النجوم',
      scheduledAt: '2026-11-17T20:00:00.000Z',
      startedAt: '2026-11-17T20:01:00.000Z',
      finishedAt: '2026-11-17T20:39:00.000Z',
      status: 'finished',
      scorerUserId: 'user-scorer-2',
      playerIds: ['player-10', 'player-11', 'player-12'],
      currentSegmentIndex: 5,
      segmentIds: stdSegments,
      winnerPlayerId: 'player-10',
      advancingPlayerIds: ['player-10'],
      isFinal: false,
      podOrder: 5,
      timer: { status: 'idle', durationSec: 60, remainingSec: 0 },
    },
    {
      id: 'game-6',
      roundId: 'round-1',
      tableName: 'Table 6 — Nile Royale',
      tableNameAr: 'طاولة ٦ — نايل رويال',
      scheduledAt: '2026-11-17T20:00:00.000Z',
      startedAt: '2026-11-17T20:05:00.000Z',
      finishedAt: '2026-11-17T20:47:00.000Z',
      status: 'finished',
      scorerUserId: 'user-scorer-3',
      playerIds: ['player-16', 'player-17', 'player-18'],
      currentSegmentIndex: 5,
      segmentIds: stdSegments,
      winnerPlayerId: 'player-18',
      advancingPlayerIds: ['player-18'],
      isFinal: false,
      podOrder: 6,
      timer: { status: 'idle', durationSec: 60, remainingSec: 0 },
    },
    {
      id: 'game-7',
      roundId: 'round-1',
      tableName: 'Table 7 — Emerald Club',
      tableNameAr: 'طاولة ٧ — النادي الزمردي',
      scheduledAt: '2026-11-17T21:00:00.000Z',
      startedAt: '2026-11-17T21:02:00.000Z',
      finishedAt: '2026-11-17T21:44:00.000Z',
      status: 'finished',
      scorerUserId: 'user-scorer-1',
      playerIds: ['player-19', 'player-20', 'player-21'],
      currentSegmentIndex: 5,
      segmentIds: stdSegments,
      winnerPlayerId: 'player-19',
      advancingPlayerIds: ['player-19'],
      isFinal: false,
      podOrder: 7,
      timer: { status: 'idle', durationSec: 60, remainingSec: 0 },
    },
    {
      id: 'game-8',
      roundId: 'round-1',
      tableName: 'Table 8 — Cairo Crown',
      tableNameAr: 'طاولة ٨ — تاج القاهرة',
      scheduledAt: '2026-11-17T21:00:00.000Z',
      startedAt: '2026-11-17T21:06:00.000Z',
      finishedAt: '2026-11-17T21:50:00.000Z',
      status: 'finished',
      scorerUserId: 'user-scorer-2',
      playerIds: ['player-22', 'player-23', 'player-24'],
      currentSegmentIndex: 5,
      segmentIds: stdSegments,
      winnerPlayerId: 'player-22',
      advancingPlayerIds: ['player-22'],
      isFinal: false,
      podOrder: 8,
      timer: { status: 'idle', durationSec: 60, remainingSec: 0 },
    },
    {
      id: 'game-9',
      roundId: 'round-1',
      tableName: 'Table 9 — Sovereign Deck',
      tableNameAr: 'طاولة ٩ — جناح النخبة',
      scheduledAt: '2026-11-18T21:30:00.000Z',
      status: 'scheduled',
      scorerUserId: 'user-scorer-3',
      playerIds: ['player-25', 'player-26', 'player-27'],
      currentSegmentIndex: 0,
      segmentIds: stdSegments,
      isFinal: false,
      podOrder: 9,
      timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
    },

    // Round 2 (3 games)
    {
      id: 'game-10',
      roundId: 'round-2',
      tableName: 'Quarter-Final A — Main Stage',
      tableNameAr: 'ربع النهائي أ — المسرح الرئيسي',
      scheduledAt: '2026-11-18T19:00:00.000Z',
      startedAt: '2026-11-18T19:02:00.000Z',
      finishedAt: '2026-11-18T19:49:00.000Z',
      status: 'finished',
      scorerUserId: 'user-scorer-2',
      playerIds: ['player-1', 'player-7', 'player-13'],
      currentSegmentIndex: 5,
      segmentIds: r2Segments,
      winnerPlayerId: 'player-1',
      advancingPlayerIds: ['player-1'],
      isFinal: false,
      podOrder: 1,
      timer: { status: 'idle', durationSec: 60, remainingSec: 0 },
    },
    {
      id: 'game-11',
      roundId: 'round-2',
      tableName: 'Quarter-Final B — Main Stage (LIVE)',
      tableNameAr: 'ربع النهائي ب — المسرح الرئيسي (مباشر)',
      scheduledAt: '2026-11-18T20:15:00.000Z',
      startedAt: '2026-11-18T20:16:00.000Z',
      status: 'live',
      scorerUserId: 'user-scorer-1',
      playerIds: ['player-4', 'player-10', 'player-18'],
      currentSegmentIndex: 3,
      segmentIds: r2Segments,
      isFinal: false,
      activeBuzzPlayerId: 'player-4',
      podOrder: 2,
      timer: { status: 'paused', durationSec: 60, remainingSec: 38 },
    },
    {
      id: 'game-12',
      roundId: 'round-2',
      tableName: 'Quarter-Final C — Main Stage',
      tableNameAr: 'ربع النهائي ج — المسرح الرئيسي',
      scheduledAt: '2026-11-19T20:00:00.000Z',
      status: 'scheduled',
      scorerUserId: 'user-scorer-3',
      playerIds: ['player-19', 'player-22', 'player-25'],
      currentSegmentIndex: 0,
      segmentIds: r2Segments,
      isFinal: false,
      podOrder: 3,
      timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
    },

    // Semi-Final (1 game, top 2 advance)
    {
      id: 'game-13',
      roundId: 'round-semi',
      tableName: 'The Golden Semi-Final (Top 2 Advance)',
      tableNameAr: 'نصف النهائي الذهبي (يتأهل الأول والثاني)',
      scheduledAt: '2026-11-20T21:00:00.000Z',
      status: 'scheduled',
      scorerUserId: 'user-scorer-4',
      playerIds: ['player-1', 'player-4', 'player-19'],
      currentSegmentIndex: 0,
      segmentIds: r2Segments,
      isFinal: false,
      podOrder: 1,
      timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
    },

    // The Grand Final (2 Finalists + Marwan Serry)
    {
      id: 'game-14',
      roundId: 'round-final',
      tableName: 'The Grand Final — Against Marwan Serry',
      tableNameAr: 'النهائي الكبير — في مواجهة مروان سري',
      scheduledAt: '2026-11-22T22:00:00.000Z',
      status: 'scheduled',
      scorerUserId: 'user-scorer-4',
      playerIds: ['player-1', 'player-19', 'player-marwan'],
      currentSegmentIndex: 0,
      segmentIds: finalSegments,
      isFinal: true,
      podOrder: 1,
      timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
    },
  ];

  // Build realistic ScoreEvents for finished games (G1..G8, G10) + Live Game (G11)
  const scoreEvents: ScoreEvent[] = [];
  const buzzEvents: BuzzEvent[] = [];
  const auditEntries: AuditEntry[] = [];

  const finishedConfigs: Array<{
    gameId: string;
    scorerId: string;
    baseTime: string;
    players: [string, string, string];
    scoresPerSeg: Array<[number, number, number]>;
    segments: string[];
  }> = [
    {
      gameId: 'game-1',
      scorerId: 'user-scorer-1',
      baseTime: '2026-11-16T20:10:00.000Z',
      players: ['player-1', 'player-2', 'player-3'],
      scoresPerSeg: [
        [10, 5, 0],
        [10, 0, 5],
        [5, 10, -5],
        [10, 5, 5],
        [10, 5, 0],
        [10, 5, 5],
      ],
      segments: stdSegments,
    },
    {
      gameId: 'game-2',
      scorerId: 'user-scorer-2',
      baseTime: '2026-11-16T20:12:00.000Z',
      players: ['player-7', 'player-8', 'player-9'],
      scoresPerSeg: [
        [10, 0, 5],
        [5, 10, 0],
        [10, 5, 0],
        [10, 0, 5],
        [5, 5, 10],
        [10, 5, -5],
      ],
      segments: stdSegments,
    },
    {
      gameId: 'game-3',
      scorerId: 'user-scorer-3',
      baseTime: '2026-11-16T21:10:00.000Z',
      players: ['player-13', 'player-14', 'player-15'],
      scoresPerSeg: [
        [10, 5, 0],
        [10, 5, 0],
        [0, 10, 5],
        [10, 0, 5],
        [10, 5, -5],
        [5, 5, 10],
      ],
      segments: stdSegments,
    },
    {
      gameId: 'game-4',
      scorerId: 'user-scorer-1',
      baseTime: '2026-11-16T21:15:00.000Z',
      players: ['player-4', 'player-5', 'player-6'],
      scoresPerSeg: [
        [10, 5, 0],
        [10, 5, 5],
        [10, -5, 5],
        [5, 10, 0],
        [10, 5, 5],
        [10, 0, 5],
      ],
      segments: stdSegments,
    },
    {
      gameId: 'game-5',
      scorerId: 'user-scorer-2',
      baseTime: '2026-11-17T20:10:00.000Z',
      players: ['player-10', 'player-11', 'player-12'],
      scoresPerSeg: [
        [10, 5, 0],
        [5, 5, 10],
        [10, 0, 5],
        [10, 5, 0],
        [10, 5, 5],
        [5, 10, -5],
      ],
      segments: stdSegments,
    },
    {
      gameId: 'game-6',
      scorerId: 'user-scorer-3',
      baseTime: '2026-11-17T20:15:00.000Z',
      players: ['player-16', 'player-17', 'player-18'],
      scoresPerSeg: [
        [5, 0, 10],
        [0, 5, 10],
        [10, 5, 5],
        [5, -5, 10],
        [0, 10, 10],
        [5, 5, 10],
      ],
      segments: stdSegments,
    },
    {
      gameId: 'game-7',
      scorerId: 'user-scorer-1',
      baseTime: '2026-11-17T21:10:00.000Z',
      players: ['player-19', 'player-20', 'player-21'],
      scoresPerSeg: [
        [10, 5, 0],
        [10, 0, 5],
        [10, 5, 5],
        [5, 10, 0],
        [10, 5, -5],
        [10, 5, 5],
      ],
      segments: stdSegments,
    },
    {
      gameId: 'game-8',
      scorerId: 'user-scorer-2',
      baseTime: '2026-11-17T21:14:00.000Z',
      players: ['player-22', 'player-23', 'player-24'],
      scoresPerSeg: [
        [10, 5, 0],
        [5, 10, 0],
        [10, 5, 5],
        [10, 0, 5],
        [10, -5, 5],
        [5, 5, 5],
      ],
      segments: stdSegments,
    },
    {
      gameId: 'game-10',
      scorerId: 'user-scorer-2',
      baseTime: '2026-11-18T19:08:00.000Z',
      players: ['player-1', 'player-7', 'player-13'],
      scoresPerSeg: [
        [10, 5, 0],
        [10, 5, 5],
        [5, 10, 0],
        [10, 5, -5],
        [10, 0, 10],
        [15, 10, 5],
      ],
      segments: r2Segments,
    },
  ];

  let eventCounter = 1;
  let buzzCounter = 1;
  let auditCounter = 1;

  for (const cfg of finishedConfigs) {
    const startMs = new Date(cfg.baseTime).getTime();

    cfg.scoresPerSeg.forEach((segScores, segIdx) => {
      const segId = cfg.segments[segIdx];
      segScores.forEach((pts, pIdx) => {
        if (pts === 0) return;
        const playerId = cfg.players[pIdx];
        const ts = new Date(startMs + (segIdx * 5 + pIdx) * 60_000).toISOString();

        if (pts > 0) {
          buzzEvents.push({
            id: `buzz-${buzzCounter++}`,
            gameId: cfg.gameId,
            segmentId: segId,
            playerId,
            byUserId: cfg.scorerId,
            cleared: false,
            createdAt: ts,
          });
        }

        const scoreId = `score-${eventCounter++}`;
        scoreEvents.push({
          id: scoreId,
          gameId: cfg.gameId,
          segmentId: segId,
          playerId,
          delta: pts,
          note: pts > 0 ? 'Correct answer on buzzer' : 'Penalty on wrong buzz',
          kind: 'preset',
          byUserId: cfg.scorerId,
          createdAt: ts,
        });
      });
    });

    const endIso = new Date(startMs + 34 * 60_000).toISOString();
    auditEntries.push({
      id: `audit-${auditCounter++}`,
      actorUserId: cfg.scorerId,
      action: 'game.finish',
      entityType: 'game',
      entityId: cfg.gameId,
      summary: `Completed ${cfg.gameId.toUpperCase()} and confirmed winner advancement.`,
      summaryAr: `تم إنهاء المباراة ${cfg.gameId.toUpperCase()} واعتماد تأهل الفائز.`,
      before: { status: 'live' },
      after: { status: 'finished', winnerPlayerId: cfg.players[0] },
      createdAt: endIso,
    });
  }

  // Live Game (game-11) events so the live game has rich activity right now
  const liveGameEvents: Array<{
    segId: string;
    playerId: string;
    delta: number;
    note: string;
    minutesAgo: number;
  }> = [
    { segId: 'seg-2', playerId: 'player-4', delta: 10, note: 'Named Wama track in 2s', minutesAgo: 22 },
    { segId: 'seg-2', playerId: 'player-10', delta: 5, note: 'Bonus chorus line', minutesAgo: 20 },
    { segId: 'seg-4', playerId: 'player-18', delta: 10, note: 'Decoded reversed Amr Diab hook', minutesAgo: 16 },
    { segId: 'seg-4', playerId: 'player-4', delta: 10, note: 'Second reversed track solved', minutesAgo: 14 },
    { segId: 'seg-7', playerId: 'player-10', delta: 10, note: 'Unbroken 12-word chain', minutesAgo: 10 },
    { segId: 'seg-7', playerId: 'player-18', delta: -5, note: 'Repeated keyword under timer', minutesAgo: 8 },
    { segId: 'seg-10', playerId: 'player-4', delta: 10, note: 'El Kit Kat quote & character', minutesAgo: 4 },
    { segId: 'seg-10', playerId: 'player-18', delta: 10, note: 'Ramadan series trivia steal', minutesAgo: 2 },
  ];

  const refNow = new Date('2026-11-18T20:40:00.000Z').getTime();
  liveGameEvents.forEach((ev) => {
    const ts = new Date(refNow - ev.minutesAgo * 60_000).toISOString();
    buzzEvents.push({
      id: `buzz-${buzzCounter++}`,
      gameId: 'game-11',
      segmentId: ev.segId,
      playerId: ev.playerId,
      byUserId: 'user-scorer-1',
      cleared: false,
      createdAt: ts,
    });
    const scoreId = `score-${eventCounter++}`;
    scoreEvents.push({
      id: scoreId,
      gameId: 'game-11',
      segmentId: ev.segId,
      playerId: ev.playerId,
      delta: ev.delta,
      note: ev.note,
      kind: 'preset',
      byUserId: 'user-scorer-1',
      createdAt: ts,
    });
    auditEntries.push({
      id: `audit-${auditCounter++}`,
      actorUserId: 'user-scorer-1',
      action: 'score.add',
      entityType: 'score',
      entityId: scoreId,
      summary: `Applied ${ev.delta > 0 ? `+${ev.delta}` : ev.delta} pts to ${ev.playerId} in Quarter-Final B (${ev.note})`,
      summaryAr: `تم تسجيل ${ev.delta > 0 ? `+${ev.delta}` : ev.delta} نقطة في ربع النهائي ب (${ev.note})`,
      before: null,
      after: { playerId: ev.playerId, delta: ev.delta, segmentId: ev.segId },
      createdAt: ts,
    });
  });

  // Compute accurate player stats and statuses from games + scoreEvents
  const eliminatedIds = new Set<string>([
    'player-2', 'player-3',
    'player-8', 'player-9',
    'player-14', 'player-15',
    'player-5', 'player-6',
    'player-11', 'player-12',
    'player-16', 'player-17',
    'player-20', 'player-21',
    'player-23', 'player-24',
    'player-7', 'player-13', // eliminated in R2 G10
  ]);

  const activeIds = new Set<string>([
    'player-1', // won R1 G1 & R2 G10 -> Semi-finalist
    'player-4', 'player-10', 'player-18', // playing live in R2 G11
    'player-19', 'player-22', // won R1 G7 & G8, awaiting R2 G12
  ]);

  const checkedInIds = new Set<string>(['player-25', 'player-26']);
  // player-27 left as 'registered' so check-in staff has someone to check in during the demo!

  const players: Player[] = RAW_PLAYERS.map((raw) => {
    const pEvents = scoreEvents.filter((e) => e.playerId === raw.id);
    const totalPoints = pEvents.reduce((acc, e) => acc + e.delta, 0);
    const gamesPlayed = games.filter(
      (g) =>
        (g.status === 'finished' || g.status === 'live') &&
        g.playerIds.includes(raw.id)
    ).length;
    const wins = games.filter(
      (g) => g.status === 'finished' && g.winnerPlayerId === raw.id
    ).length;

    let status: Player['status'] = 'registered';
    if (eliminatedIds.has(raw.id)) status = 'eliminated';
    else if (activeIds.has(raw.id)) status = 'active';
    else if (checkedInIds.has(raw.id)) status = 'checkedIn';

    return {
      id: raw.id,
      fullName: raw.fullName,
      fullNameAr: raw.fullNameAr,
      nickname: raw.nickname,
      nicknameAr: raw.nicknameAr,
      avatarSeed: `seed-${raw.seed}-${raw.nickname.toLowerCase().replace(/\s+/g, '')}`,
      phone: `+20 100 555 ${String(1000 + raw.seed)}`,
      email: `${raw.fullName.toLowerCase().replace(/[^a-z]/g, '.')}@players.casino`,
      status,
      seed: raw.seed,
      isHost: false,
      stats: {
        gamesPlayed,
        wins,
        totalPoints,
      },
      createdAt: '2026-11-10T12:00:00.000Z',
    };
  });

  // Add Marwan Serry's special Final Boss record (name only, no photo per AGENTS.md §10)
  players.push({
    id: 'player-marwan',
    fullName: 'Marwan Serry',
    fullNameAr: 'مروان سري',
    nickname: 'The Final Boss',
    nicknameAr: 'صاحب الكازينو',
    avatarSeed: 'golden-seat-marwan',
    phone: 'VIP-GOLDEN-SEAT',
    email: 'marwan@finalnight.casino',
    status: 'finalist',
    seed: 0,
    isHost: true,
    stats: {
      gamesPlayed: 0,
      wins: 0,
      totalPoints: 0,
    },
    createdAt: '2026-11-10T12:00:00.000Z',
  });

  const sponsors: Sponsor[] = [
    {
      id: 'sponsor-1',
      name: 'Nile Crown Telecom (Placeholder)',
      nameAr: 'نايل كراون للاتصالات (نموذج راعٍ)',
      tier: 'presenting',
      tierLabelEn: 'Presenting Partner',
      tierLabelAr: 'الراعي الرسمي الرئيسي',
      logoText: 'NILE CROWN',
      blurb: 'Title branding across the entire Ramadan tournament, stage marquee, and live broadcast.',
      blurbAr: 'الرعاية الحصرية للبطولة بالكامل وعلى المسرح الرئيسي والبث المباشر.',
      benefitsEn: [
        '“Presented by” title lockup on Main Stage & Big Screen',
        'Custom branded question segment in every knockout game',
        'VIP hospitality lounge & on-stage Grand Final trophy presentation with Marwan Serry',
        'Contact us for partnership package',
      ],
      benefitsAr: [
        'اقتران الاسم بشعار البطولة الرئيسي وشاشة العرض العملاقة',
        'فقرة أسئلة مخصصة باسم الراعي في جميع مباريات الإقصاء',
        'جناح ضيافة لكبار الزوار والمشاركة في تسليم كأس النهائي مع مروان سري',
        'تواصل معنا لتفاصيل الرعاية',
      ],
      order: 1,
    },
    {
      id: 'sponsor-2',
      name: 'Al-Futtaim Royal Oasis (Placeholder)',
      nameAr: 'واحة الفطيم الملكية (نموذج راعٍ)',
      tier: 'finalNight',
      tierLabelEn: 'Final Night Partner',
      tierLabelAr: 'شريك ليلة النهائي',
      logoText: 'ROYAL OASIS',
      blurb: 'Exclusive ownership of the Grand Final showdown featuring the top 2 finalists against Marwan Serry.',
      blurbAr: 'رعاية ليلة النهائي الكبرى التي تجمع المتأهلين النهائيين في مواجهة مروان سري.',
      benefitsEn: [
        'Golden Seat & Final Night broadcast frame branding',
        'Executive seating at the Final Night live taping',
        'Full social reel & highlight cut integration',
        'Contact us for partnership package',
      ],
      benefitsAr: [
        'شعار الراعي على إطار المقعد الذهبي وبث ليلة النهائي',
        'مقاعد خاصة لكبار الضيوف في تصوير ليلة النهائي',
        'تغطية كاملة في مقاطع السوشيال ميديا والملخصات',
        'تواصل معنا لتفاصيل الرعاية',
      ],
      order: 2,
    },
    {
      id: 'sponsor-3',
      name: 'Kahوة & Crème Roasters (Placeholder)',
      nameAr: 'محمصة قهوة وكريم (نموذج راعٍ)',
      tier: 'segment',
      tierLabelEn: 'Segment Partner',
      tierLabelAr: 'راعي الفقرات التفاعلية',
      logoText: 'KAHWA & CREME',
      blurb: 'Powering the high-speed buzzer segments, table timers, and player Suhoor lounge.',
      blurbAr: 'رعاية فقرات السرعة والجرس ومؤقت الطاولات واستراحة السحور.',
      benefitsEn: [
        'Branded badge on Segment Timer & Scoreboard overlays',
        'Product placement on contestant tables & Suhoor majlis',
        'Contact us for partnership package',
      ],
      benefitsAr: [
        'ظهور الشعار على مؤقت الفقرات ولوحة النتائج',
        'تواجد المنتجات على طاولات المتسابقين ومجلس السحور',
        'تواصل معنا لتفاصيل الرعاية',
      ],
      order: 3,
    },
    {
      id: 'sponsor-4',
      name: 'Cairo Creative Hub (Placeholder)',
      nameAr: 'ملتقى القاهرة الإبداعي (نموذج راعٍ)',
      tier: 'community',
      tierLabelEn: 'Community Partner',
      tierLabelAr: 'شريك المجتمع والجمهور',
      logoText: 'CAIRO HUB',
      blurb: 'Supporting the live audience trivia segment and community qualifiers across Ramadan.',
      blurbAr: 'دعم فقرة أسئلة الجمهور والفعاليات المصاحبة طوال ليالي رمضان.',
      benefitsEn: [
        'Co-branded Audience & Social Media segment (#15)',
        'Logo placement on public bracket & leaderboard pages',
        'Contact us for partnership package',
      ],
      benefitsAr: [
        'رعاية فقرة الجمهور والسوشيال ميديا (فقرة ١٥)',
        'ظهور الشعار في صفحات الجدول والترتيب العام',
        'تواصل معنا لتفاصيل الرعاية',
      ],
      order: 4,
    },
  ];

  const contentItems: ContentItem[] = [
    {
      id: 'content-1',
      key: 'hero-announcement',
      category: 'announcement',
      titleEn: 'Quarter-Final Table B is LIVE Now on the Main Stage!',
      titleAr: 'مباراة ربع النهائي (ب) جارية الآن مباشرة على المسرح الرئيسي!',
      bodyEn: 'Karim "K-Nab", Khaled "Khaldoon", and Nour "Nouro" are battling for the second seat in the Golden Semi-Final.',
      bodyAr: 'منافسة مشتعلة بين كريم "كيمو" وخالد "خلدون" ونور "نورو" لحسم المقعد الثاني في نصف النهائي الذهبي.',
      badgeEn: 'LIVE TONIGHT',
      badgeAr: 'مباشر الليلة',
      order: 1,
      updatedAt: '2026-11-18T20:15:00.000Z',
    },
    {
      id: 'content-2',
      key: 'rule-three-player',
      category: 'rule',
      titleEn: 'Three Players, One Table, Pure Speed & Wit',
      titleAr: 'ثلاثة لاعبين، طاولة واحدة، سرعة وبديهة خالصة',
      bodyEn: 'Every session features exactly 3 contestants and 1 dedicated table scorer playing across 6 to 8 curated segments.',
      bodyAr: 'تضم كل مباراة ٣ متسابقين وحكم طاولة مخصص يتنافسون عبر ٦ إلى ٨ فقرات متنوعة.',
      badgeEn: 'CORE FORMAT',
      badgeAr: 'نظام اللعب',
      order: 2,
      updatedAt: '2026-11-15T12:00:00.000Z',
    },
    {
      id: 'content-3',
      key: 'rule-buzzer-scoring',
      category: 'rule',
      titleEn: 'Stage Buzzer & Segment Point Presets',
      titleAr: 'جرس المسرح ونقاط الفقرات الفورية',
      bodyEn: 'The scorer locks in who buzzed first. Correct answers earn +10 or +5 points; wrong interrupts risk a -5 penalty.',
      bodyAr: 'يحدد الحكم أول من ضغط الجرس. الإجابات الصحيحة تمنح +١٠ أو +٥ نقاط، والإجابة الخاطئة قد تخصم -٥ نقاط.',
      badgeEn: 'SCORING',
      badgeAr: 'احتساب النقاط',
      order: 3,
      updatedAt: '2026-11-15T12:00:00.000Z',
    },
    {
      id: 'content-4',
      key: 'rule-final-marwan',
      category: 'rule',
      titleEn: 'The Grand Final: Two Finalists vs. Marwan Serry',
      titleAr: 'النهائي الكبير: المتأهلان في مواجهة مروان سري',
      bodyEn: 'In the Semi-Final, the top 2 players advance together to face Marwan Serry himself in a 3-seat finale under the spotlights.',
      bodyAr: 'في نصف النهائي يتأهل صاحبا المركزين الأول والثاني معاً لمواجهة مروان سري شخصياً على طاولة النهائي.',
      badgeEn: 'THE FINAL',
      badgeAr: 'ليلة النهائي',
      order: 4,
      updatedAt: '2026-11-15T12:00:00.000Z',
    },
    {
      id: 'content-5',
      key: 'schedule-blurb-main',
      category: 'scheduleBlurb',
      titleEn: 'Four Nights of Ramadan Showdowns (Placeholder Schedule)',
      titleAr: 'أربع ليالٍ من المنافسات الرمضانية (جدول مبدئي قابل للتعديل)',
      bodyEn: 'All dates, call times, and studio tables below are editable placeholders for the Ramadan 2027 pitch.',
      bodyAr: 'جميع المواعيد والتوقيتات والطاولات أدناه هي بيانات مبدئية قابلة للتعديل من لوحة التحكم لعرض رمضان ٢٠٢٧.',
      badgeEn: 'RAMADAN 2027',
      badgeAr: 'رمضان ٢٠٢٧',
      order: 5,
      updatedAt: '2026-11-15T12:00:00.000Z',
    },
  ];

  const settings: Settings = {
    id: 'global-settings',
    eventName: 'Casino El Al3ab — Ramadan Tournament',
    eventNameAr: 'بطولة كازينو الألعاب الرمضانية',
    eventDates: 'Ramadan 2027 · Nights 14–18 (Placeholder)',
    eventDatesAr: 'رمضان ٢٠٢٧ · الليالي ١٤ إلى ١٨ (موعد مبدئي)',
    finalNightIso: '2027-03-22T21:00:00.000Z',
    venue: 'Grand Nile Studio, Cairo (Placeholder Venue)',
    venueAr: 'استوديو النيل الكبير، القاهرة (موقع مبدئي)',
    prizeText: 'Grand Championship Trophy + Sponsor Prize Package (Placeholder)',
    prizeTextAr: 'كأس البطولة الذهبي + جوائز الرعاة الكبرى (قيمة مبدئية)',
    contactEmail: 'partnerships@casinoelal3ab-pitch.com',
    defaultLanguage: 'en',
    useArabicIndicDigits: false,
    delightersEnabled: false,
    soundEnabled: false,
    bracketConfig: {
      totalPlayers: 27,
      playersPerGame: 3,
      round1Games: 9,
      round2Games: 3,
      semiGames: 1,
      semiAdvanceCount: 2,
    },
    updatedAt: '2026-11-18T06:00:00.000Z',
  };

  return {
    version: SEED_VERSION,
    players,
    users,
    rounds,
    segments,
    games,
    scoreEvents,
    buzzEvents,
    auditEntries,
    sponsors,
    contentItems,
    settings,
  };
}
