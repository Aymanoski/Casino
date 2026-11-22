# Voiceover Narration Script & Exact Timecodes (`/video/NARRATION.md`)

> Use this script if you want to record your own human voice (in English, Egyptian Arabic, or both) to replace the bundled neural TTS (`en-US-AndrewNeural` / `ar-EG-ShakirNeural`).
>
> **Drop-in recording workflow:**
> 1. Record each scene below as an `.mp3` or `.wav` file inside:
>    - English: `video/public/audio/narration/custom/en/<sceneId>.mp3`
>    - Arabic: `video/public/audio/narration/custom/ar/<sceneId>.mp3`
> 2. Run `npm --prefix video run audio` (auto-detects your custom recordings and skips TTS for those scenes).
> 3. Run `npm run video:render`.

---

## Main Pitch Video — 16:9 (`3:12` = `192s`)

| Timecode | Scene ID | Max Duration | English Script | Egyptian Arabic Script |
|---|---|---|---|---|
| `00:00 – 00:18` | `a1-cold-open` | `17.4s` | Imagine Ramadan night. Seven hundred and twenty players started this tournament. Only two survived. Waiting in the Golden Seat on Final Night is Marwan Serry. This is the live platform built to run the entire championship, from draw to finale. | تخيّل ليلة النهائي في رمضان. سبعمية وعشرين لاعب بدأوا البطولة، واتنين بس وصلوا للآخر. واللي مستنّيهم على الكرسي الذهبي… مروان سري. دي المنصة الحقيقية اللي هتدير البطولة كلها من أول قرعة لحد آخر نقطة. |
| `00:18 – 00:20` | `b0-bumper` | *(SFX only)* | *(Title bumper: ONE MATCH · FIVE PERSPECTIVES — Group 1 · Match 3 · Table #1)* | *(فاصل: مباراة واحدة · خمس زوايا — المجموعة ١ · مباراة ٣ · طاولة #١)* |
| `00:20 – 00:36` | `b1-admin-setup` | `15.4s` | Everything starts with the Admin. Every number is adjustable: seven hundred and twenty players, groups of three, top one advances. One click draws all two hundred and forty groups and auto-schedules every table and judge without conflicts. | كل حاجة بتبدأ من الإدارة. كل رقم قابل للتعديل: سبعمية وعشرين لاعب، مجموعات من تلاتة، والأول يتأهل. بضغطة واحدة بتتسحب القرعة، وتتوزع الماتشات على الطاولات والحكام تلقائي من غير أي تعارض. |
| `00:36 – 00:54` | `b2-player-phone` | `17.4s` | On his phone, the player picks from twenty-four 3D avatars or crops his own photo. He sees his opponent, call time, and Table One — never the upcoming segments, so every game stays a surprise — plus a Judge Help Card in English or Arabic. | على موبايله، المتسابق بيختار من أربعة وعشرين أفاتار ثلاثي الأبعاد أو يرفع صورته. بيشوف منافسه، ميعاده، وطاولة رقم واحد — من غير ما يعرف الفقرات علشان تفضل مفاجأة — ومعاه كارت تواصل فوري مع الحكم، بالعربي أو بالإنجليزي. |
| `00:54 – 01:14` | `b3-scorer-console` | `19.4s` | At Table One, the Scorer runs a clean 1v1 console. Late player? Tap Contact, and every view is audited. Live play has zero clutter: Buzzed First, plus one, minus one, Yellow and Red cards tracked as real card icons, one-tap Undo, and Mark Absent for walkovers. | على طاولة واحد، الحكم شغّال على شاشة تحكم بسيطة وسريعة. لو لاعب اتأخر، بيدوس تواصل وكل عرض بيتسجل في السجل. وفي اللعب: مين داس الجرس الأول، زائد واحد، ناقص واحد، كارت أصفر وكارت أحمر بأيقونات واضحة، تراجع فوري، وتسجيل الغياب. |
| `01:14 – 01:24` | `b3b-split-money-shot` | `9.4s` | Watch all three screens at once. One tap from the Scorer — the venue Big Screen and every fan phone react instantaneously. | شوف التلات شاشات مع بعض في نفس اللحظة. ضغطة واحدة من الحكم… شاشة المسرح وموبايل الجمهور بيتحدثوا فوراً في نفس الثانية. |
| `01:24 – 01:40` | `b4-big-screen` | `15.4s` | On the venue Big Screens, draws are never allowed. A tied match automatically opens a sudden-death Tie-Breaker — fully mirrored in Arabic RTL — before crowning the winner and updating the live arena leaderboard. | وعلى شاشات القاعة، التعادل ممنوع. أول ما النتيجة تتعادل، جولة الحسم الفاصلة بتتفتح تلقائياً — وبواجهة عربية كاملة من اليمين للشمال — لحد ما يتوَّج الفائز وتتحدث لوحة الصدارة قدام الجمهور. |
| `01:40 – 01:52` | `b5-fan-view` | `11.4s` | Fans follow every update on phones and laptops: live group standings, the nightly schedule, and an interactive two-hundred-fifty-six-slot knockout bracket with visible BYEs and player-path tracking. | والجمهور بيتابع كل جديد من الموبايل واللابتوب: ترتيب المجموعات، جدول الليالي، وشجرة تصفيات تفاعلية لمتين ستة وخمسين مقعد فيها التخطي التلقائي وتتبع مسار أي لاعب. |
| `01:52 – 02:10` | `b6-admin-fairness` | `17.4s` | Back in Admin, every score and card arrives in order with exact date and time — like Yellow card, minus one. If a mistake happens, reverting it triggers an Impact Preview, then automatically fixes the winner, standings, and bracket — verified by nine integrity checks. | وعند الإدارة، كل نقطة وكارت بيوصلوا بالترتيب بالتاريخ والوقت، زي بطاقة صفراء ناقص واحد. ولو حصل خطأ، التراجع عنه بيطلعلك معاينة الأثر الأول، وبعدها بيصحّح الفائز والترتيب والشجرة تلقائياً، وتحت رقابة تسع فحوصات تناسق. |
| `02:10 – 02:42` | `c1-role-recap` | `31.4s` | Five perspectives, one synchronized system. The Admin configures, audits, and protects tournament integrity. The Scorer delivers fast, mistake-free judging at every table. The Player gets their table and judge help while segments stay a surprise. Big Screens turn every tap into live broadcast drama. And the Public Fan View keeps everyone glued to live groups, schedules, and the bracket. | خمس زوايا، ونظام واحد متكامل. الإدارة بتضبط القواعد وتراجع السجل وتحمي عدالة البطولة. الحكم بيدير طاولته بسرعة ودقة بدون أخطاء. المتسابق بيعرف طاولته وحكمه، والفقرات تفضل مفاجأة. شاشات العرض بتحوّل كل ضغطة لحماس تليفزيوني حي. وعرض الجمهور بيخلّي الكل متابع المجموعات والجدول والشجرة لحظة بلحظة. |
| `02:42 – 02:58` | `d1-marwan-final` | `15.4s` | Every match leads to one unforgettable night: the only three-player showdown in the tournament. Two finalists earn their way through seven hundred and twenty players to face you — Marwan Serry — centered in the Golden Seat. | وكل الماتشات دي طريقها واحد: المواجهة الثلاثية الوحيدة في البطولة. اتنين بس يعدّوا من سبعمية وعشرين لاعب، علشان يقفوا قدامك يا مروان — في النص، على الكرسي الذهبي — في ليلة نهائي مش هتتنسي. |
| `02:58 – 03:12` | `e1-close-cta` | `13.4s` | Customizable sponsor tiers are ready to tailor together, from Final Night partner to branded segments. Every date, venue, and package is ready for your stamp. Ready to claim the Golden Seat? | وباقات الرعاية جاهزة تتفصّل مع بعض — من شريك ليلة النهائي لراعي الفقرات. المواعيد والمكان والباقات كلها جاهزة لبصمتك. جاهز تاخد مكانك على الكرسي الذهبي؟ |

---

## Vertical Teaser — 9:16 (`1:08` = `68s`)

| Timecode | Scene ID | Max Duration | English Script | Egyptian Arabic Script |
|---|---|---|---|---|
| `00:00 – 00:09` | `t1-hook` | `8.4s` | Seven hundred and twenty players. One Ramadan tournament. Two finalists left to face Marwan Serry in the Golden Seat. | سبعمية وعشرين لاعب، بطولة رمضانية واحدة، واتنين بس هيوصلوا يواجهوا مروان سري على الكرسي الذهبي. |
| `00:09 – 00:20` | `t2-scale-player` | `10.4s` | Players see their table, 3D avatar, and judge contact — never the upcoming segments, in English or Arabic. | المتسابق يعرف طاولته، أفاتاره، وحكمه — من غير ما تتسرب الفقرات — بالعربي وبالإنجليزي. |
| `00:20 – 00:34` | `t3-split-live` | `13.4s` | One tap from the Scorer: Buzz, plus one, Yellow or Red card — the Big Screen and every fan phone react instantly, with sudden-death tie-breakers. | ضغطة واحدة من الحكم: الجرس، نقطة، أو كارت أصفر وأحمر — شاشة القاعة وموبايل الجمهور يتحدثوا فوراً، وجولة حسم تلقائية وقت التعادل. |
| `00:34 – 00:44` | `t4-fairness` | `9.4s` | Every action is timestamped. Revert a mistake, confirm the Impact Preview, and winners, standings, and the bracket fix themselves. | كل خطوة متسجلة بالوقت. لو حصل تعديل، معاينة الأثر تحمي الجولات، والفائز والترتيب والشجرة يتصححوا تلقائياً. |
| `00:44 – 00:54` | `t5-five-entities` | `9.4s` | Admin runs it. Scorer calls it. Player plays blind. Big Screens ignite the room. Fans track every round live. | الإدارة تدير، الحكم يحكم، اللاعب يتفاجئ، الشاشات تشعلل القاعة، والجمهور متابع لحظة بلحظة. |
| `00:54 – 01:08` | `t6-marwan-cta` | `13.4s` | All roads lead to your three-player Grand Final, with customizable sponsor tiers ready to build together. Ready for the Golden Seat? | وكل ده بيوصل للنهائي الثلاثي معاك، مع باقات رعاية جاهزة تتفصّل مع بعض. جاهز للكرسي الذهبي؟ |
