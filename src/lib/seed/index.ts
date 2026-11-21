import {
  AVATAR_LIBRARY_KEYS,
  MARWAN_PLAYER_ID,
  type AbsenceEvent,
  type AuditEntry,
  type BuzzEvent,
  type CheckInEvent,
  type ContentItem,
  type DatabaseSnapshot,
  type Group,
  type Match,
  type MatchLifecycleEvent,
  type Player,
  type Round,
  type ScoreEvent,
  type Segment,
  type Settings,
  type Sponsor,
  type TournamentSettings,
  type User,
} from '@/lib/schemas';
import {
  autoScheduleMatches,
  generateGroupRoundRobinPairs,
  generateGroups,
  generateKnockout,
  propagateWinners,
} from '@/lib/engine';

export const SEED_VERSION = 3;

export type SeedPresetSize = 12 | 48 | 720;

export interface CreateSeedOptions {
  totalPlayers?: number;
  groupSize?: number;
  advancePerGroup?: number;
  pointsPerGroupWin?: number;
  tablesCount?: number;
  slotMinutes?: number;
  includeFinalWithMarwan?: boolean;
  /** When false, creates a clean all-scheduled tournament with zero simulated matches */
  includeDemoProgress?: boolean;
}

// First 27 curated entries from AGENTS.md §9 (seed pool prefix)
const INITIAL_27_PLAYERS: Array<{
  fullName: string;
  fullNameAr: string;
  nickname: string;
  nicknameAr: string;
  email: string;
}> = [
  { fullName: 'Omar Hassan', fullNameAr: 'عمر حسن', nickname: 'The Fox', nicknameAr: 'الثعلب', email: 'omar.hassan@players.casino' },
  { fullName: 'Youssef Adel', fullNameAr: 'يوسف عادل', nickname: 'Joe', nicknameAr: 'جو', email: 'youssef.adel@players.casino' },
  { fullName: 'Mostafa Gamal', fullNameAr: 'مصطفى جمال', nickname: 'Tofa', nicknameAr: 'توفة', email: 'mostafa.gamal@players.casino' },
  { fullName: 'Karim Nabil', fullNameAr: 'كريم نبيل', nickname: 'K-Nab', nicknameAr: 'كيمو', email: 'karim.nabil@players.casino' },
  { fullName: 'Ahmed Samir', fullNameAr: 'أحمد سمير', nickname: 'Sammoora', nicknameAr: 'سمورة', email: 'ahmed.samir@players.casino' },
  { fullName: 'Mahmoud Fathy', fullNameAr: 'محمود فتحي', nickname: 'Abu Fathy', nicknameAr: 'أبو فتحي', email: 'mahmoud.fathy@players.casino' },
  { fullName: 'Ali Tarek', fullNameAr: 'علي طارق', nickname: 'Ali Baba', nicknameAr: 'علي بابا', email: 'ali.tarek@players.casino' },
  { fullName: 'Hossam Ragab', fullNameAr: 'حسام رجب', nickname: 'Hoss', nicknameAr: 'حس', email: 'hossam.ragab@players.casino' },
  { fullName: 'Ibrahim Zaki', fullNameAr: 'إبراهيم زكي', nickname: 'Brahim', nicknameAr: 'إبراهيمو', email: 'ibrahim.zaki@players.casino' },
  { fullName: 'Khaled Mansour', fullNameAr: 'خالد منصور', nickname: 'Khaldoon', nicknameAr: 'خلدون', email: 'khaled.mansour@players.casino' },
  { fullName: 'Tamer Essam', fullNameAr: 'تامر عصام', nickname: 'Timo', nicknameAr: 'تيمو', email: 'tamer.essam@players.casino' },
  { fullName: 'Sherif Magdy', fullNameAr: 'شريف مجدي', nickname: 'Sheriff', nicknameAr: 'الشريف', email: 'sherif.magdy@players.casino' },
  { fullName: 'Amr Wael', fullNameAr: 'عمرو وائل', nickname: 'Amoora', nicknameAr: 'عمورة', email: 'amr.wael@players.casino' },
  { fullName: 'Hany Salah', fullNameAr: 'هاني صلاح', nickname: 'Hanoon', nicknameAr: 'حنون', email: 'hany.salah@players.casino' },
  { fullName: 'Walid Anwar', fullNameAr: 'وليد أنور', nickname: 'Wally', nicknameAr: 'والي', email: 'walid.anwar@players.casino' },
  { fullName: 'Mina Girgis', fullNameAr: 'مينا جرجس', nickname: 'Mino', nicknameAr: 'مينو', email: 'mina.girgis@players.casino' },
  { fullName: 'Fady Samy', fullNameAr: 'فادي سامي', nickname: 'Fadi', nicknameAr: 'فادو', email: 'fady.samy@players.casino' },
  { fullName: 'Nour El-Din Hesham', fullNameAr: 'نور الدين هشام', nickname: 'Nouro', nicknameAr: 'نورو', email: 'nour.hesham@players.casino' },
  { fullName: 'Salma Reda', fullNameAr: 'سلمى رضا', nickname: 'Salsabeel', nicknameAr: 'سلسبيل', email: 'salma.reda@players.casino' },
  { fullName: 'Mariam Hatem', fullNameAr: 'مريم حاتم', nickname: 'Mimi', nicknameAr: 'ميمي', email: 'mariam.hatem@players.casino' },
  { fullName: 'Dina Yasser', fullNameAr: 'دينا ياسر', nickname: 'Dodo', nicknameAr: 'دودو', email: 'dina.yasser@players.casino' },
  { fullName: 'Farida Ashraf', fullNameAr: 'فريدة أشرف', nickname: 'Fofo', nicknameAr: 'فوفو', email: 'farida.ashraf@players.casino' },
  { fullName: 'Nada Ehab', fullNameAr: 'ندى إيهاب', nickname: 'Nody', nicknameAr: 'نودي', email: 'nada.ehab@players.casino' },
  { fullName: 'Yasmin Mourad', fullNameAr: 'ياسمين مراد', nickname: 'Yaso', nicknameAr: 'ياسو', email: 'yasmin.mourad@players.casino' },
  { fullName: 'Laila Kamel', fullNameAr: 'ليلى كامل', nickname: 'Lulu', nicknameAr: 'لولو', email: 'laila.kamel@players.casino' },
  { fullName: 'Rana Sherif', fullNameAr: 'رنا شريف', nickname: 'Rouny', nicknameAr: 'روني', email: 'rana.sherif@players.casino' },
  { fullName: 'Habiba Osama', fullNameAr: 'حبيبة أسامة', nickname: 'Bibo', nicknameAr: 'بيبو', email: 'habiba.osama@players.casino' },
];

const FIRST_NAMES_M: Array<[string, string, string, string]> = [
  ['Ziad', 'زياد', 'Zizo', 'زيزو'],
  ['Seif', 'سيف', 'Sefo', 'سيفو'],
  ['Adam', 'آدم', 'Adom', 'أدوم'],
  ['Ramy', 'رامي', 'Ramo', 'رامو'],
  ['Bassem', 'باسم', 'Beso', 'بيسو'],
  ['Hazem', 'حازم', 'Hazo', 'حازو'],
  ['Adham', 'أدهم', 'Adhoom', 'أدهوم'],
  ['Mohab', 'مهاب', 'Hoba', 'هوبا'],
  ['Marwan', 'مروان', 'Maro', 'مارو'],
  ['Yehia', 'يحيى', 'Yoyo', 'يويو'],
  ['Shady', 'شادي', 'Shado', 'شادو'],
  ['Ayman', 'أيمن', 'Eimo', 'إيمو'],
  ['Medhat', 'مدحت', 'Mido', 'ميدو'],
  ['Samer', 'سامر', 'Sam', 'سام'],
  ['Eslam', 'إسلام', 'Sola', 'سولا'],
  ['Moataz', 'معتز', 'Zizo-M', 'ميزو'],
  ['Belal', 'بلال', 'Bilo', 'بيلو'],
  ['Tarek', 'طارق', 'Tito', 'تيتو'],
  ['Mohamed', 'محمد', 'Mo', 'مو'],
  ['Hassan', 'حسن', 'Hasso', 'حسو'],
  ['Nader', 'نادر', 'Nado', 'نادو'],
  ['Wael', 'وائل', 'Welo', 'ويلو'],
  ['Hatem', 'حاتم', 'Hato', 'حاتو'],
  ['Essam', 'عصام', 'Esso', 'عصو'],
];

const FIRST_NAMES_F: Array<[string, string, string, string]> = [
  ['Malak', 'ملك', 'Moka', 'موكا'],
  ['Nourhan', 'نورهان', 'Noura', 'نورا'],
  ['Hana', 'هنا', 'Hano', 'هانو'],
  ['Jana', 'جنى', 'Jiji', 'جيجي'],
  ['Rawan', 'روان', 'Roro', 'رورو'],
  ['Menna', 'منة', 'Meno', 'مينو'],
  ['Sara', 'سارة', 'Saso', 'ساسو'],
  ['Yara', 'يارا', 'Yoyo-Y', 'ياري'],
  ['Reem', 'ريم', 'Rima', 'ريما'],
  ['Hager', 'هاجر', 'Gogo', 'جوجو'],
  ['Nour', 'نور', 'Nony', 'نوني'],
  ['Mai', 'مي', 'Maya', 'مايا'],
  ['Aya', 'آية', 'Ayoush', 'أيوش'],
  ['Esraa', 'إسراء', 'Soso', 'سوسو'],
  ['Donia', 'دنيا', 'Dody', 'دودي'],
  ['Logy', 'لوجي', 'Lolo', 'لولو'],
  ['Talia', 'تاليا', 'Tota', 'توتا'],
  ['Karma', 'كارما', 'Koko', 'كوكو'],
  ['Zeina', 'زينة', 'Zizi', 'زيزي'],
  ['Shahd', 'شهد', 'Shosho', 'شوشو'],
];

const LAST_NAMES: Array<[string, string]> = [
  ['El-Sayed', 'السيد'],
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
];

export function formatFakePhone(index1Based: number): {
  phone: string;
  whatsapp: string;
} {
  const padded = String(index1Based).padStart(4, '0');
  return {
    phone: `010-0000-${padded}`,
    whatsapp: `+20100000${padded}`,
  };
}

export function deterministicAvatarKey(seedNum: number): string {
  return AVATAR_LIBRARY_KEYS[(Math.abs(seedNum - 1)) % AVATAR_LIBRARY_KEYS.length];
}

/**
 * Procedurally generates N realistic fictional tournament players (default 720)
 * plus the special guest participant Marwan Serry (`player-marwan`).
 */
export function generateProceduralPlayers(count: number): Player[] {
  const safeCount = Math.max(4, count);
  const createdAt = '2027-02-20T12:00:00.000Z';
  const emptyStats = () => ({
    matchesPlayed: 0,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    totalPoints: 0,
    groupPoints: 0,
    yellowCards: 0,
    redCards: 0,
    absences: 0,
  });

  const players: Player[] = [];

  for (let i = 0; i < safeCount; i++) {
    const seed = i + 1;
    const id = `player-${seed}`;
    const contactPhone = formatFakePhone(seed);
    const avatarKey = deterministicAvatarKey(seed);

    if (i < INITIAL_27_PLAYERS.length) {
      const base = INITIAL_27_PLAYERS[i];
      players.push({
        id,
        fullName: base.fullName,
        fullNameAr: base.fullNameAr,
        nickname: base.nickname,
        nicknameAr: base.nicknameAr,
        avatarSeed: `seed-${seed}-${base.nickname.toLowerCase().replace(/\s+/g, '')}`,
        avatar: { photoUrl: null, avatarKey },
        contact: {
          phone: contactPhone.phone,
          whatsapp: contactPhone.whatsapp,
          email: base.email,
        },
        phone: contactPhone.phone,
        email: base.email,
        seed,
        isGuest: false,
        isHost: false,
        status: 'registered',
        stats: emptyStats(),
        createdAt,
      });
    } else {
      const idx = i - INITIAL_27_PLAYERS.length;
      const isFemale = idx % 2 === 1;
      const pool = isFemale ? FIRST_NAMES_F : FIRST_NAMES_M;
      const firstTuple = pool[Math.floor(idx / 2) % pool.length];
      const lastTuple = LAST_NAMES[(idx * 7 + Math.floor(idx / pool.length)) % LAST_NAMES.length];
      const fullName = `${firstTuple[0]} ${lastTuple[0]}`;
      const fullNameAr = `${firstTuple[1]} ${lastTuple[1]}`;
      const suffix = Math.floor(idx / (pool.length * 2)) + 1;
      const nickname = suffix > 1 ? `${firstTuple[2]} ${suffix}` : firstTuple[2];
      const nicknameAr = suffix > 1 ? `${firstTuple[3]} ${suffix}` : firstTuple[3];
      const email = `player${String(seed).padStart(3, '0')}@players.casino`;

      players.push({
        id,
        fullName,
        fullNameAr,
        nickname,
        nicknameAr,
        avatarSeed: `seed-${seed}-${firstTuple[2].toLowerCase().replace(/\s+/g, '')}`,
        avatar: { photoUrl: null, avatarKey },
        contact: {
          phone: contactPhone.phone,
          whatsapp: contactPhone.whatsapp,
          email,
        },
        phone: contactPhone.phone,
        email,
        seed,
        isGuest: false,
        isHost: false,
        status: 'registered',
        stats: emptyStats(),
        createdAt,
      });
    }
  }

  // Special guest participant: Marwan Serry (name only, no photo, excluded from rankings/standings/stats)
  players.push({
    id: MARWAN_PLAYER_ID,
    fullName: 'Marwan Serry',
    fullNameAr: 'مروان سري',
    nickname: 'The Host',
    nicknameAr: 'المقدّم والنجم',
    avatarSeed: 'marwan-serry-golden-seat',
    avatar: { photoUrl: null, avatarKey: 'avatar-01' },
    contact: {
      phone: '010-0000-0000',
      whatsapp: '+201000000000',
      email: 'final-host@casinoelal3ab.com',
    },
    phone: '010-0000-0000',
    email: 'final-host@casinoelal3ab.com',
    seed: 0,
    isGuest: true,
    isHost: true,
    status: 'finalist',
    stats: emptyStats(),
    createdAt,
  });

  return players;
}

export function createSegmentsSeed(): Segment[] {
  return [
    {
      id: 'seg-1',
      nameEn: 'A Song by the Artist',
      nameAr: 'أغنية للفنان / للفنانة',
      category: 'music',
      descriptionEn: 'The host names a singer; the first player to buzz and sing a valid line from their catalog takes the point.',
      descriptionAr: 'يذكر المقدم اسم مطرب أو مطربة، وأول لاعب يضغط الجرس ويغني مقطعاً صحيحاً يحصد النقطة.',
      durationSec: 45,
      presetPoints: [1, -1],
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
      presetPoints: [1, -1],
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
      presetPoints: [1, -1],
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
      presetPoints: [1, -1],
      order: 4,
    },
    {
      id: 'seg-5',
      nameEn: 'Guess the Singer / Track',
      nameAr: 'تخمين المغني أو الأغنية',
      category: 'music',
      descriptionEn: 'Rapid-fire musical clues where players score for naming both the vocalist and the song.',
      descriptionAr: 'تلميحات موسيقية سريعة يحصل فيها اللاعب على النقطة عند تسمية المطرب والأغنية معاً.',
      durationSec: 45,
      presetPoints: [1, -1],
      order: 5,
    },
    {
      id: 'seg-6',
      nameEn: 'Reversed Words',
      nameAr: 'كلمات معكوسة',
      category: 'wordplay',
      descriptionEn: 'Flip the letters of spoken words in your head and pronounce the reversed word cleanly under pressure.',
      descriptionAr: 'اقلب حروف الكلمات المنطوقة في ذهنك وانطق الكلمة معكوسة بدقة وتحت ضغط الوقت.',
      durationSec: 45,
      presetPoints: [1, -1],
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
      presetPoints: [1, -1],
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
      presetPoints: [1, -1],
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
      presetPoints: [1, -1],
      order: 9,
    },
    {
      id: 'seg-10',
      nameEn: 'Egyptian Cinema and Series Trivia',
      nameAr: 'أسئلة أفلام ومسلسلات مصرية',
      category: 'popculture',
      descriptionEn: 'Iconic scenes, Ramadan drama classics, and unforgettable characters from Egyptian screen history.',
      descriptionAr: 'مشاهد خالدة، مسلسلات رمضانية شهيرة، وشخصيات لا تُنسى من تاريخ السينما والدراما المصرية.',
      durationSec: 60,
      presetPoints: [1, -1],
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
      presetPoints: [1, -1],
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
      presetPoints: [1, -1],
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
      presetPoints: [1, -1],
      order: 13,
    },
    {
      id: 'seg-14',
      nameEn: 'General Knowledge',
      nameAr: 'معلومات عامة',
      category: 'general',
      descriptionEn: 'High-stakes trivia spanning geography, history, science, sports, and Ramadan traditions.',
      descriptionAr: 'معلومات عامة سريعة تشمل الجغرافيا والتاريخ والعلوم والرياضة والتقاليد الرمضانية.',
      durationSec: 60,
      presetPoints: [1, -1],
      order: 14,
    },
    {
      id: 'seg-15',
      nameEn: 'Audience and Fan Questions',
      nameAr: 'فقرة الجمهور / السوشيال ميديا',
      category: 'special',
      descriptionEn: 'Wildcard questions submitted by live studio guests and social media followers.',
      descriptionAr: 'أسئلة مفاجئة من جمهور الاستوديو ومتابعي السوشيال ميديا.',
      durationSec: 60,
      presetPoints: [1, -1],
      order: 15,
    },
    {
      id: 'seg-16',
      nameEn: 'Tie-Breaker and Penalty Challenge',
      nameAr: 'جولة التحدي / الحسم',
      category: 'special',
      descriptionEn: 'Sudden-death showdown activated whenever a match ends tied—one decisive point settles the winner.',
      descriptionAr: 'جولة الحسم الفاصلة عند انتهاء المباراة بالتعادل—نقطة حاسمة واحدة تحدد الفائز.',
      durationSec: 30,
      presetPoints: [1, -1],
      order: 16,
    },
  ];
}

export function createDemoSeedState(
  demoPlayerIds: [string, string] = ['player-1', 'player-2']
): {
  game: Match;
  match: Match;
  scoreEvents: ScoreEvent[];
  buzzEvents: BuzzEvent[];
  matchEvents: MatchLifecycleEvent[];
} {
  const [dp1, dp2] = demoPlayerIds;
  const demoSegments = ['seg-1', 'seg-3', 'seg-6', 'seg-10', 'seg-13', 'seg-15'];
  const baseMs = Date.parse('2027-03-05T21:00:00.000Z');
  const matchId = 'game-demo';

  const match: Match = {
    id: matchId,
    type: 'group',
    roundId: 'round-demo',
    round: 1,
    slot: 1,
    isGroupTieBreak: false,
    participants: [
      { slotIndex: 0, playerId: dp1, guest: false, isBye: false, feeder: { kind: 'fixed', playerId: dp1 } },
      { slotIndex: 1, playerId: dp2, guest: false, isBye: false, feeder: { kind: 'fixed', playerId: dp2 } },
    ],
    playerIds: [dp1, dp2],
    tableNumber: 1,
    tableName: 'Pitch Live Table — Exhibition 1v1 Showcase',
    tableNameAr: 'طاولة العرض المباشر — تجربة البث (١ ضد ١)',
    scheduledAt: '2027-03-05T21:00:00.000Z',
    startedAt: '2027-03-05T21:01:00.000Z',
    status: 'live',
    result: null,
    judgeUserId: 'user-scorer-1',
    scorerUserId: 'user-scorer-1',
    currentSegmentIndex: 2,
    segmentIds: demoSegments,
    isFinal: false,
    isDemo: true,
    activeBuzzPlayerId: dp2,
    replayEpoch: 0,
    version: 1,
    timer: {
      status: 'paused',
      durationSec: 45,
      remainingSec: 32,
      endsAt: null,
    },
  };

  const matchEvents: MatchLifecycleEvent[] = [
    {
      id: 'me-demo-start',
      matchId,
      type: 'started',
      byUserId: 'user-scorer-1',
      replayEpoch: 0,
      createdAt: new Date(baseMs + 60_000).toISOString(),
    },
  ];

  const scoreEvents: ScoreEvent[] = [
    {
      id: 'score-demo-5',
      matchId,
      gameId: matchId,
      segmentId: 'seg-6',
      playerId: dp2,
      delta: 1,
      note: 'Reversed Arabic proverb on first buzz',
      kind: 'point',
      byUserId: 'user-scorer-1',
      replayEpoch: 0,
      createdAt: new Date(baseMs + 5 * 60_000).toISOString(),
    },
    {
      id: 'score-demo-4',
      matchId,
      gameId: matchId,
      segmentId: 'seg-3',
      playerId: dp1,
      delta: -1,
      note: 'Yellow card (−1): Early buzz before prompt',
      kind: 'yellow',
      byUserId: 'user-scorer-1',
      replayEpoch: 0,
      createdAt: new Date(baseMs + 4 * 60_000).toISOString(),
    },
    {
      id: 'score-demo-3',
      matchId,
      gameId: matchId,
      segmentId: 'seg-3',
      playerId: dp1,
      delta: 1,
      note: 'Put the word in a Ramadan anthem',
      kind: 'point',
      byUserId: 'user-scorer-1',
      replayEpoch: 0,
      createdAt: new Date(baseMs + 3 * 60_000).toISOString(),
    },
    {
      id: 'score-demo-2',
      matchId,
      gameId: matchId,
      segmentId: 'seg-1',
      playerId: dp2,
      delta: 1,
      note: 'Classic track answered fast',
      kind: 'point',
      byUserId: 'user-scorer-1',
      replayEpoch: 0,
      createdAt: new Date(baseMs + 2 * 60_000).toISOString(),
    },
    {
      id: 'score-demo-1',
      matchId,
      gameId: matchId,
      segmentId: 'seg-1',
      playerId: dp1,
      delta: 1,
      note: 'Opening buzz winner',
      kind: 'point',
      byUserId: 'user-scorer-1',
      replayEpoch: 0,
      createdAt: new Date(baseMs + 90_000).toISOString(),
    },
  ];

  const buzzEvents: BuzzEvent[] = [
    {
      id: 'buzz-demo-2',
      matchId,
      gameId: matchId,
      segmentId: 'seg-6',
      playerId: dp2,
      byUserId: 'user-scorer-1',
      cleared: false,
      replayEpoch: 0,
      createdAt: new Date(baseMs + 5 * 60_000).toISOString(),
    },
    {
      id: 'buzz-demo-1',
      matchId,
      gameId: matchId,
      segmentId: 'seg-3',
      playerId: dp1,
      byUserId: 'user-scorer-1',
      cleared: false,
      replayEpoch: 0,
      createdAt: new Date(baseMs + 3 * 60_000).toISOString(),
    },
  ];

  return { game: match, match, scoreEvents, buzzEvents, matchEvents };
}

export function createDefaultUsers(): User[] {
  return [
    {
      id: 'user-admin',
      name: 'Admin',
      nameAr: 'مدير البطولة',
      email: 'admin@casinoelal3ab.com',
      phone: '010-9000-0000',
      whatsapp: '+201090000000',
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
      phone: '010-9000-0001',
      whatsapp: '+201090000001',
      role: 'scorer',
      language: 'en',
      titleEn: 'Lead Stage Judge (Tables 1–3)',
      titleAr: 'حكم المسرح الرئيسي (طاولات ١–٣)',
    },
    {
      id: 'user-scorer-2',
      name: 'Scorer 2',
      nameAr: 'حكم طاولة ٢',
      email: 'scorer2@casinoelal3ab.com',
      phone: '010-9000-0002',
      whatsapp: '+201090000002',
      role: 'scorer',
      language: 'en',
      titleEn: 'Stage Judge (Tables 4–6)',
      titleAr: 'حكم طاولة (طاولات ٤–٦)',
    },
    {
      id: 'user-scorer-3',
      name: 'Scorer 3',
      nameAr: 'حكم طاولة ٣',
      email: 'scorer3@casinoelal3ab.com',
      phone: '010-9000-0003',
      whatsapp: '+201090000003',
      role: 'scorer',
      language: 'en',
      titleEn: 'Stage Judge (Tables 7–9)',
      titleAr: 'حكم طاولة (طاولات ٧–٩)',
    },
    {
      id: 'user-scorer-4',
      name: 'Scorer 4',
      nameAr: 'حكم طاولة ٤',
      email: 'scorer4@casinoelal3ab.com',
      phone: '010-9000-0004',
      whatsapp: '+201090000004',
      role: 'scorer',
      language: 'en',
      titleEn: 'Final & Reserve Judge (Tables 10–12)',
      titleAr: 'حكم النهائي والاحتياط (طاولات ١٠–١٢)',
    },
    {
      id: 'user-checkin',
      name: 'Gate Staff',
      nameAr: 'مسؤول استقبال اللاعبين',
      email: 'checkin@casinoelal3ab.com',
      phone: '010-9000-0010',
      whatsapp: '+201090000010',
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
      phone: '010-9000-0011',
      whatsapp: '+201090000011',
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
      titleEn: 'Group 1 Contestant',
      titleAr: 'متسابق المجموعة ١',
    },
    {
      id: 'user-player-4',
      name: 'Karim Nabil "K-Nab"',
      nameAr: 'كريم نبيل "كيمو"',
      email: 'karim.nabil@players.casino',
      role: 'player',
      playerId: 'player-4',
      language: 'en',
      titleEn: 'Group Stage Contestant',
      titleAr: 'متسابق دور المجموعات',
    },
    {
      id: 'user-player-19',
      name: 'Salma Reda "Salsabeel"',
      nameAr: 'سلمى رضا "سلسبيل"',
      email: 'salma.reda@players.casino',
      role: 'player',
      playerId: 'player-19',
      language: 'en',
      titleEn: 'Group Stage Contestant',
      titleAr: 'متسابقة دور المجموعات',
    },
  ];
}

export function createSponsorsSeed(): Sponsor[] {
  return [
    {
      id: 'sponsor-1',
      name: 'Title Partner Slot (Placeholder)',
      nameAr: 'الراعي الرسمي الرئيسي (مساحة مبدئية)',
      tier: 'presenting',
      tierLabelEn: 'Presenting Title Partner',
      tierLabelAr: 'شريك اللقب الرئيسي',
      logoText: 'YOUR BRAND HERE',
      blurb: 'Headline naming rights across the entire Ramadan tournament, studio broadcast frame, and all 720-player digital brackets.',
      blurbAr: 'حقوق التسمية الرئيسية للبطولة بالكامل وإطار شاشة البث المباشر وجميع جداول التصفيات.',
      benefitsEn: [
        'Primary branding on the Main Stage & Big Screen frame',
        'Co-branded segments during the Grand Final with Marwan Serry',
        'Dedicated showcase card on all public spectator routes',
        'Contact us for tailored Ramadan sponsorship packages',
      ],
      benefitsAr: [
        'الظهور الرئيسي على المسرح وشاشة البث الكبرى',
        'رعاية مشتركة لفقرات النهائي الكبير مع مروان سري',
        'بطاقة عرض مميزة في جميع صفحات الجمهور المباشرة',
        'تواصل معنا لتخصيص باقة الرعاية الرمضانية',
      ],
      order: 1,
    },
    {
      id: 'sponsor-2',
      name: 'Final Night Showcase Partner (Placeholder)',
      nameAr: 'شريك ليلة النهائي الكبير (مساحة مبدئية)',
      tier: 'finalNight',
      tierLabelEn: 'Final Night Partner',
      tierLabelAr: 'شريك ليلة النهائي',
      logoText: 'FINAL NIGHT PARTNER',
      blurb: 'Exclusive ownership of the Grand Final showdown featuring the top 2 finalists against Marwan Serry.',
      blurbAr: 'رعاية حصرية لمواجهة النهائي الكبير التي تجمع المتأهلين الاثنين أمام مروان سري.',
      benefitsEn: [
        'Exclusive branding on the Grand Final broadcast & countdown',
        'On-stage trophy & prize handover moment',
        'Contact us for availability and deliverables',
      ],
      benefitsAr: [
        'ظهور حصري على بث النهائي الكبير والعد التنازلي',
        'لحظة تسليم الكأس والجائزة على المسرح الرئيسي',
        'تواصل معنا للتفاصيل والمزايا المتاحة',
      ],
      order: 2,
    },
    {
      id: 'sponsor-3',
      name: 'Challenge Segment Partner (Placeholder)',
      nameAr: 'شريك فقرات التحدي (مساحة مبدئية)',
      tier: 'segment',
      tierLabelEn: 'Segment Partner',
      tierLabelAr: 'راعي الفقرات',
      logoText: 'SEGMENT SPONSOR',
      blurb: 'Own signature rapid-fire music, cinema, or sudden-death tie-breaker segments across every match.',
      blurbAr: 'تملّك فقرات الغناء والسينما أو جولة الحسم الفاصلة طوال ليالي البطولة.',
      benefitsEn: [
        'Sponsor callout on live segment title cards on venue screens',
        'Featured presence across spectator schedule & live feeds',
        'Contact us to claim your favorite segment category',
      ],
      benefitsAr: [
        'ذكر اسم الراعي على شاشات عرض عناوين الفقرات المباشرة',
        'تواجد مميز في جدول المباريات وسجل النتائج',
        'تواصل معنا لحجز فئة الفقرات المفضلة لعلامتك',
      ],
      order: 3,
    },
    {
      id: 'sponsor-4',
      name: 'Hospitality & Community Partner (Placeholder)',
      nameAr: 'شريك الضيافة والمجتمع (مساحة مبدئية)',
      tier: 'community',
      tierLabelEn: 'Community Partner',
      tierLabelAr: 'شريك المجتمع',
      logoText: 'COMMUNITY PARTNER',
      blurb: 'Power the Ramadan Suhoor lounge, contestant check-in experience, and fan community activations.',
      blurbAr: 'رعاية سحور اللاعبين وتجربة استقبال الجمهور وتفعيلات السوشيال ميديا.',
      benefitsEn: [
        'Venue lounge activation and contestant welcome kit',
        'Digital recognition across the tournament platform',
        'Contact us for partnership options',
      ],
      benefitsAr: [
        'تفعيل ميداني في صالة الضيافة وحقائب استقبال اللاعبين',
        'إبراز رقمي على منصة البطولة طوال الشهر',
        'تواصل معنا لمعرفة خيارات الشراكة',
      ],
      order: 4,
    },
  ];
}

export function createContentItemsSeed(): ContentItem[] {
  const nowIso = '2027-02-28T18:00:00.000Z';
  return [
    {
      id: 'content-1',
      key: 'announcement-live',
      category: 'announcement',
      titleEn: 'Group Stage Live Across 12 Tables!',
      titleAr: 'دور المجموعات مباشر الآن عبر ١٢ طاولة!',
      bodyEn: '720 players drawn into 240 groups of 3 are battling in 1v1 round-robin matches. Top winner from each group advances to the 256-slot knockout bracket!',
      bodyAr: '٧٢٠ لاعباً موزعين على ٢٤٠ مجموعة من ٣ لاعبين يتنافسون بنظام الدوري (١ ضد ١). يتأهل متصدر كل مجموعة إلى التصفيات الإقصائية!',
      badgeEn: 'LIVE UPDATE',
      badgeAr: 'تحديث مباشر',
      order: 1,
      updatedAt: nowIso,
    },
    {
      id: 'content-2',
      key: 'rule-format',
      category: 'rule',
      titleEn: 'Groups → Single-Elimination Knockouts → 1v1v1 Grand Final',
      titleAr: 'المجموعات ← الإقصائيات (١ ضد ١) ← النهائي الكبير (٣ لاعبين)',
      bodyEn: 'Contestants are drawn into groups of 3 and play 1v1 round-robin matches (3 group points per win, zero draws). Group winners enter the 1v1 single-elimination knockout bracket seeded by group number (with best-winner BYEs where needed), culminating in the 2 surviving finalists facing Marwan Serry in a 3-player Grand Final.',
      bodyAr: 'يُقسّم المتسابقون إلى مجموعات من ٣ لاعبين ويلعبون مباريات فردية (١ ضد ١) بنظام الدوري (٣ نقاط للفوز ولا يوجد تعادل). يتأهل المتصدرون إلى الإقصائيات الفردية وصولاً إلى النهائي الكبير بين المتأهلَين الاثنين ومروان سري.',
      badgeEn: 'FORMAT',
      badgeAr: 'نظام البطولة',
      order: 2,
      updatedAt: nowIso,
    },
    {
      id: 'content-3',
      key: 'rule-scoring',
      category: 'rule',
      titleEn: 'Scoring, Yellow & Red Cards, and No Draws',
      titleAr: 'احتساب النقاط، البطاقات الصفراء والحمراء، ومنع التعادل',
      bodyEn: 'Judges award +1 or −1 points per play, plus Yellow cards (−1) and Red cards (−2) tracked in every match and tournament record. If a match ends level, a sudden-death Tie-Breaker segment immediately decides the winner. Marking a player absent in a 1v1 results in an immediate walkover victory.',
      bodyAr: 'يمنح الحكام +١ أو −١ نقطة، بالإضافة إلى البطاقة الصفراء (−١) والبطاقة الحمراء (−٢) المحسوبة في سجل المباراة والبطولة. في حال التعادل تُفتح جولة حسم فاصلة فوراً. وفي حال غياب لاعب في مباراة ١ ضد ١ يُحتسب فوز انسحابي فوري للمنافس.',
      badgeEn: 'SCORING',
      badgeAr: 'النقاط والبطاقات',
      order: 3,
      updatedAt: nowIso,
    },
    {
      id: 'content-4',
      key: 'rule-surprise',
      category: 'rule',
      titleEn: 'Surprise Segments & Fair Play',
      titleAr: 'مفاجأة الفقرات واللعب النظيف',
      bodyEn: 'Specific match segments remain hidden from players until they go live on stage so every contestant competes on pure wit, music memory, and speed. Zero gambling or real-money wagering — strictly a Ramadan skill & trivia celebration.',
      bodyAr: 'تبقى فقرات كل مباراة مفاجأة غير ظاهرة للمتسابقين حتى انطلاقها مباشرة على المسرح لضمان تكافؤ الفرص. مسابقة معلومات وترفيه رمضانية بالكامل بدون أي مراهنات.',
      badgeEn: 'FAIR PLAY',
      badgeAr: 'اللعب النظيف',
      order: 4,
      updatedAt: nowIso,
    },
    {
      id: 'content-5',
      key: 'schedule-blurb',
      category: 'scheduleBlurb',
      titleEn: 'Ramadan 2027 Nights Schedule (Editable Placeholder)',
      titleAr: 'جدول ليالي رمضان ٢٠٢٧ (مواعيد مبدئية قابلة للتعديل)',
      bodyEn: 'Matches run nightly across 12 live studio tables in 30-minute conflict-free slots. Exact dates, venue, and Grand Final broadcast time are editable placeholders in Admin Settings.',
      bodyAr: 'تُقام المباريات يومياً عبر ١٢ طاولة مباشرة بفترات ٣٠ دقيقة دون أي تعارض في المواعيد. التواريخ والمكان وموعد النهائي مبدئية وقابلة للتعديل من إعدادات البطولة.',
      badgeEn: 'SCHEDULE',
      badgeAr: 'الجدول',
      order: 5,
      updatedAt: nowIso,
    },
  ];
}

export function buildBracketConfigCompat(t: TournamentSettings) {
  const groupsCount = Math.max(1, Math.floor(t.totalPlayers / Math.max(2, t.groupSize)));
  const qualifiers = groupsCount * t.advancePerGroup;
  return {
    totalPlayers: t.totalPlayers,
    playersPerGame: 2,
    round1Games: groupsCount * ((t.groupSize * (t.groupSize - 1)) / 2),
    round2Games: Math.max(1, Math.ceil(qualifiers / 2)),
    semiGames: 2,
    semiAdvanceCount: 1,
  };
}

/**
 * Generates a full, event-sourced, invariant-clean DatabaseSnapshot.
 * Default preset: 720 players (240 groups of 3, 720 group matches, 256-slot KO + Marwan Final).
 * Also supports 12 and 48 presets (and any custom settings).
 */
export function createSeedSnapshot(options: CreateSeedOptions = {}): DatabaseSnapshot {
  const tournament: TournamentSettings = {
    totalPlayers: options.totalPlayers ?? 720,
    groupSize: options.groupSize ?? 3,
    advancePerGroup: options.advancePerGroup ?? 1,
    pointsPerGroupWin: options.pointsPerGroupWin ?? 3,
    tablesCount: options.tablesCount ?? 12,
    slotMinutes: options.slotMinutes ?? 30,
    includeFinalWithMarwan: options.includeFinalWithMarwan ?? true,
  };
  const includeDemoProgress = options.includeDemoProgress ?? true;

  const segments = createSegmentsSeed();
  const users = createDefaultUsers();
  const players = generateProceduralPlayers(tournament.totalPlayers);
  const sponsors = createSponsorsSeed();
  const contentItems = createContentItemsSeed();

  const stdSegIds = ['seg-1', 'seg-3', 'seg-6', 'seg-10', 'seg-13', 'seg-14'];
  const finalSegIds = [
    'seg-1',
    'seg-3',
    'seg-4',
    'seg-6',
    'seg-8',
    'seg-10',
    'seg-13',
    'seg-15',
  ];

  // 1. Groups & Round 1 (Group Stage)
  const groupRound: Round = {
    id: 'round-groups',
    name: {
      en: 'Group Stage — 1v1 Round-Robin',
      ar: 'دور المجموعات — دوري ١ ضد ١',
    },
    order: 1,
    stage: 'group',
    advancePerGame: tournament.advancePerGroup,
    status: 'upcoming',
  };

  const groups: Group[] = generateGroups(players, tournament, {
    preserveOrder: true,
    roundId: groupRound.id,
  });

  const groupMatches: Match[] = [];
  let gSlot = 1;
  for (const group of groups) {
    const pairs = generateGroupRoundRobinPairs(group.playerIds);
    pairs.forEach(([pA, pB], pairIdx) => {
      const matchId = `match-g${group.number}-m${pairIdx + 1}`;
      groupMatches.push({
        id: matchId,
        type: 'group',
        groupId: group.id,
        roundId: groupRound.id,
        round: 1,
        slot: gSlot++,
        isGroupTieBreak: false,
        participants: [
          { slotIndex: 0, playerId: pA, feeder: { kind: 'fixed', playerId: pA } },
          { slotIndex: 1, playerId: pB, feeder: { kind: 'fixed', playerId: pB } },
        ],
        playerIds: [pA, pB],
        tableNumber: ((gSlot - 2) % tournament.tablesCount) + 1,
        tableName: `Group ${group.number} · Match ${pairIdx + 1}`,
        tableNameAr: `المجموعة ${group.number} · مباراة ${pairIdx + 1}`,
        scheduledAt: '2027-03-05T19:00:00.000Z',
        judgeUserId: 'user-scorer-1',
        scorerUserId: 'user-scorer-1',
        segmentIds: stdSegIds,
        currentSegmentIndex: 0,
        status: 'scheduled',
        result: null,
        isFinal: false,
        isDemo: false,
        podOrder: gSlot - 1,
        replayEpoch: 0,
        version: 1,
        timer: { status: 'idle', durationSec: 45, remainingSec: 45 },
      });
    });
  }

  // 2. Knockout + Grand Final skeleton
  const koTree = generateKnockout(groups, tournament, {
    startRoundOrder: 2,
    defaultSegmentIds: stdSegIds,
    finalSegmentIds: finalSegIds,
    defaultJudgeUserId: 'user-scorer-1',
    baseScheduledAtIso: '2027-03-14T20:00:00.000Z',
  });

  const rounds: Round[] = [groupRound, ...koTree.rounds];
  const rawTournamentMatches = [...groupMatches, ...koTree.matches];

  // 3. Conflict-free auto-schedule across tables & judges
  const scheduledTournamentMatches = autoScheduleMatches(
    rawTournamentMatches,
    users,
    tournament,
    '2027-03-05T19:00:00.000Z'
  );

  // 4. Isolated Landing Page Demo match (always picks existing players from current roster)
  const demoP1 = players.find((p) => p.id === 'player-1')?.id ?? players[0].id;
  const demoP2 =
    players.find((p) => p.id === 'player-19')?.id ??
    players.find((p) => !p.isGuest && p.id !== demoP1)?.id ??
    players[1].id;
  const demoSeed = createDemoSeedState([demoP1, demoP2]);

  const matches: Match[] = [...scheduledTournamentMatches, demoSeed.match];
  const scoreEvents: ScoreEvent[] = [...demoSeed.scoreEvents];
  const absenceEvents: AbsenceEvent[] = [];
  const buzzEvents: BuzzEvent[] = [...demoSeed.buzzEvents];
  const matchEvents: MatchLifecycleEvent[] = [...demoSeed.matchEvents];
  const checkInEvents: CheckInEvent[] = [];
  const auditEntries: AuditEntry[] = [];

  // 5. Populate realistic mid-tournament demo story via pure append-only events!
  if (includeDemoProgress && groups.length >= 2) {
    const completeGroupCount =
      groups.length >= 20 ? 12 : Math.max(1, Math.floor(groups.length / 2));
    const liveGroupCount = Math.min(3, Math.max(1, groups.length - completeGroupCount));

    let evSeq = 1;
    const baseStoryMs = Date.parse('2027-03-05T19:00:00.000Z');
    const nextIso = () => new Date(baseStoryMs + evSeq++ * 30_000).toISOString();

    const addPoint = (
      matchId: string,
      playerId: string,
      delta: number,
      kind: 'point' | 'yellow' | 'red',
      byUserId: string,
      segId: string,
      note?: string
    ) => {
      scoreEvents.push({
        id: `se-seed-${evSeq}`,
        matchId,
        gameId: matchId,
        segmentId: segId,
        playerId,
        delta,
        kind,
        note,
        byUserId,
        replayEpoch: 0,
        createdAt: nextIso(),
      });
    };

    // Complete groups 1..completeGroupCount (including a 3-way cycle in Group 4 and a walkover in Group 6!)
    for (let gIdx = 0; gIdx < completeGroupCount; gIdx++) {
      const group = groups[gIdx];
      const gMatches = scheduledTournamentMatches.filter(
        (m) => m.groupId === group.id
      );

      // Check-in players of completed groups
      for (const pid of group.playerIds) {
        checkInEvents.push({
          id: `ci-seed-${evSeq}`,
          playerId: pid,
          status: 'checkedIn',
          byUserId: 'user-checkin',
          createdAt: nextIso(),
        });
      }

      gMatches.forEach((m, mIdx) => {
        const p0 = m.participants[0].playerId!;
        const p1 = m.participants[1].playerId!;

        // Special demo story: Group 6 Match 3 -> walkover due to absence!
        if (group.number === 6 && mIdx === 2) {
          absenceEvents.push({
            id: `abs-seed-${evSeq}`,
            matchId: m.id,
            playerId: p1,
            action: 'marked',
            reason: 'No-show at table call',
            byUserId: m.judgeUserId,
            replayEpoch: 0,
            createdAt: nextIso(),
          });
          auditEntries.push({
            id: `audit-seed-${evSeq}`,
            actorUserId: m.judgeUserId,
            action: 'match.markAbsent',
            entityType: 'absence',
            entityId: m.id,
            summary: `Marked ${p1} absent in ${m.tableName} — walkover victory awarded to ${p0}.`,
            summaryAr: `تم تسجيل غياب ${p1} في ${m.tableNameAr} — فوز انسحابي لـ ${p0}.`,
            before: { status: 'scheduled' },
            after: { status: 'finished', resultType: 'walkover', winnerId: p0 },
            automatic: false,
            createdAt: nextIso(),
          });
          return;
        }

        matchEvents.push({
          id: `me-seed-start-${evSeq}`,
          matchId: m.id,
          type: 'started',
          byUserId: m.judgeUserId,
          replayEpoch: 0,
          createdAt: nextIso(),
        });

        // Special demo story: Group 4 -> 3-way cycle (A beats B, B beats C, C beats A; A wins on points diff!)
        if (group.number === 4 && gMatches.length === 3) {
          if (mIdx === 0) {
            // A vs B -> A wins 5-1 (+4 diff)
            for (let k = 0; k < 5; k++) addPoint(m.id, p0, 1, 'point', m.judgeUserId, stdSegIds[k % stdSegIds.length]);
            addPoint(m.id, p1, 1, 'point', m.judgeUserId, stdSegIds[1]);
          } else if (mIdx === 1) {
            // B vs C -> B wins 3-2 (+1 diff)
            for (let k = 0; k < 3; k++) addPoint(m.id, p0, 1, 'point', m.judgeUserId, stdSegIds[k % stdSegIds.length]);
            for (let k = 0; k < 2; k++) addPoint(m.id, p1, 1, 'point', m.judgeUserId, stdSegIds[k % stdSegIds.length]);
          } else {
            // A vs C -> C wins 3-2 (so C beats A by 1; final diffs: A=+3, B=-3, C=0 -> A qualifies!)
            for (let k = 0; k < 2; k++) addPoint(m.id, p0, 1, 'point', m.judgeUserId, stdSegIds[k % stdSegIds.length]);
            for (let k = 0; k < 3; k++) addPoint(m.id, p1, 1, 'point', m.judgeUserId, stdSegIds[k % stdSegIds.length]);
          }
        } else {
          // Standard realistic 1v1 scorelines with occasional yellow/red cards
          const winnerPid = mIdx === 1 ? p0 : p0;
          const loserPid = winnerPid === p0 ? p1 : p0;
          const winPts = 4 + ((group.number + mIdx) % 3);
          const losePts = 2 + ((group.number + mIdx) % 2);

          for (let k = 0; k < winPts; k++) {
            addPoint(m.id, winnerPid, 1, 'point', m.judgeUserId, stdSegIds[k % stdSegIds.length]);
          }
          for (let k = 0; k < losePts; k++) {
            addPoint(m.id, loserPid, 1, 'point', m.judgeUserId, stdSegIds[(k + 1) % stdSegIds.length]);
          }
          if ((group.number + mIdx) % 3 === 0) {
            addPoint(
              m.id,
              loserPid,
              -1,
              'yellow',
              m.judgeUserId,
              stdSegIds[2],
              'Yellow card (−1): False buzz'
            );
          }
          if (group.number % 5 === 0 && mIdx === 0) {
            addPoint(
              m.id,
              loserPid,
              -2,
              'red',
              m.judgeUserId,
              stdSegIds[4],
              'Red card (−2): Unsportsmanlike interruption'
            );
          }
        }

        matchEvents.push({
          id: `me-seed-fin-${evSeq}`,
          matchId: m.id,
          type: 'finished',
          byUserId: m.judgeUserId,
          replayEpoch: 0,
          createdAt: nextIso(),
        });
        m.currentSegmentIndex = stdSegIds.length - 1;
      });
    }

    // Live matches in next liveGroupCount groups (1 live match per group => disjoint players!)
    for (let offset = 0; offset < liveGroupCount; offset++) {
      const group = groups[completeGroupCount + offset];
      if (!group) break;
      const gMatches = scheduledTournamentMatches.filter(
        (m) => m.groupId === group.id
      );
      if (gMatches.length === 0) continue;

      for (const pid of group.playerIds) {
        checkInEvents.push({
          id: `ci-seed-${evSeq}`,
          playerId: pid,
          status: 'checkedIn',
          byUserId: 'user-checkin',
          createdAt: nextIso(),
        });
      }

      // Finish match 1 of the group, make match 2 LIVE (so players don't overlap live matches!)
      const m0 = gMatches[0];
      const liveM = gMatches[1] ?? gMatches[0];

      if (m0 && m0.id !== liveM.id) {
        const p0 = m0.participants[0].playerId!;
        const p1 = m0.participants[1].playerId!;
        matchEvents.push({
          id: `me-seed-start-${evSeq}`,
          matchId: m0.id,
          type: 'started',
          byUserId: m0.judgeUserId,
          replayEpoch: 0,
          createdAt: nextIso(),
        });
        addPoint(m0.id, p0, 1, 'point', m0.judgeUserId, stdSegIds[0]);
        addPoint(m0.id, p0, 1, 'point', m0.judgeUserId, stdSegIds[1]);
        addPoint(m0.id, p0, 1, 'point', m0.judgeUserId, stdSegIds[2]);
        addPoint(m0.id, p1, 1, 'point', m0.judgeUserId, stdSegIds[1]);
        matchEvents.push({
          id: `me-seed-fin-${evSeq}`,
          matchId: m0.id,
          type: 'finished',
          byUserId: m0.judgeUserId,
          replayEpoch: 0,
          createdAt: nextIso(),
        });
        m0.currentSegmentIndex = stdSegIds.length - 1;
      }

      const lp0 = liveM.participants[0].playerId!;
      const lp1 = liveM.participants[1].playerId!;
      matchEvents.push({
        id: `me-seed-live-${evSeq}`,
        matchId: liveM.id,
        type: 'started',
        byUserId: liveM.judgeUserId,
        replayEpoch: 0,
        createdAt: nextIso(),
      });
      addPoint(liveM.id, lp0, 1, 'point', liveM.judgeUserId, stdSegIds[0], 'Fast buzzer answer');
      addPoint(liveM.id, lp0, 1, 'point', liveM.judgeUserId, stdSegIds[1]);
      addPoint(liveM.id, lp1, 1, 'point', liveM.judgeUserId, stdSegIds[1]);
      addPoint(liveM.id, lp1, -1, 'yellow', liveM.judgeUserId, stdSegIds[2], 'Yellow card (−1)');
      addPoint(liveM.id, lp1, 1, 'point', liveM.judgeUserId, stdSegIds[2]);
      liveM.currentSegmentIndex = 2;
      liveM.timer = { status: 'paused', durationSec: 45, remainingSec: 28, endsAt: null };
      buzzEvents.push({
        id: `buzz-seed-${evSeq}`,
        matchId: liveM.id,
        gameId: liveM.id,
        segmentId: stdSegIds[2],
        playerId: lp0,
        byUserId: liveM.judgeUserId,
        cleared: false,
        replayEpoch: 0,
        createdAt: nextIso(),
      });
    }

    auditEntries.push({
      id: `audit-seed-init`,
      actorUserId: 'user-admin',
      action: 'tournament.generate',
      entityType: 'bracket',
      entityId: 'tournament-bracket',
      summary: `Generated ${tournament.totalPlayers}-player tournament: ${groups.length} groups of ${tournament.groupSize}, ${groupMatches.length} group matches, ${koTree.matches.length} knockout/final matches (${koTree.byesCount} BYEs).`,
      summaryAr: `تم توليد بطولة ${tournament.totalPlayers} لاعب: ${groups.length} مجموعة (${tournament.groupSize} لاعبين)، ${groupMatches.length} مباراة مجموعات و${koTree.matches.length} مباراة إقصائية.`,
      before: null,
      after: {
        totalPlayers: tournament.totalPlayers,
        groupsCount: groups.length,
        matchesCount: scheduledTournamentMatches.length,
        byesCount: koTree.byesCount,
      },
      automatic: false,
      createdAt: new Date(baseStoryMs).toISOString(),
    });
  }

  const settings: Settings = {
    id: 'global-settings',
    eventName: 'Casino El Al3ab — Ramadan Tournament',
    eventNameAr: 'كازينو الألعاب — بطولة رمضان الكبرى',
    eventDates: 'Ramadan 2027 (Placeholder Dates)',
    eventDatesAr: 'رمضان ٢٠٢٧ (مواعيد مبدئية)',
    finalNightIso: '2027-03-22T21:00:00.000Z',
    venue: 'Cairo Grand Studio Arena (Placeholder Venue)',
    venueAr: 'استوديو القاهرة الكبرى (موقع مبدئي)',
    prizeText: 'Grand Trophy + Championship Prize Package (Placeholder)',
    prizeTextAr: 'كأس البطولة وحزمة الجوائز الكبرى (مبدئية)',
    contactEmail: 'partnerships@casinoelal3ab-demo.com',
    defaultLanguage: 'en',
    useArabicIndicDigits: false,
    delightersEnabled: false,
    soundEnabled: false,
    tournament,
    bracketConfig: buildBracketConfigCompat(tournament),
    updatedAt: '2027-02-28T18:00:00.000Z',
  };

  // 6. Run pure engine propagation so ALL derived fields (winners, statuses, standings,
  //    qualifiers, knockout slots, round statuses, player stats/status) are 100% consistent!
  const propagated = propagateWinners({
    players,
    groups,
    rounds,
    matches,
    scoreEvents,
    absenceEvents,
    buzzEvents,
    matchEvents,
    checkInEvents,
    settings: tournament,
  });

  return {
    version: SEED_VERSION,
    players: propagated.players,
    users,
    groups,
    rounds: propagated.rounds,
    segments,
    matches: propagated.matches,
    scoreEvents: scoreEvents.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    absenceEvents: absenceEvents.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    buzzEvents: buzzEvents.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    matchEvents: matchEvents.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    checkInEvents: checkInEvents.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    auditEntries: auditEntries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    sponsors,
    contentItems,
    settings,
  };
}
