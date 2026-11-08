// ════════════════════════════════════════════════════════════════
// ALYAZOURI 2026 — Device + Weapon + Pro Profile Data
// ════════════════════════════════════════════════════════════════

export type Device = {
  name: string;
  fps: number;
  touchRate: number; // Hz
  screenSize: number; // inches
  resolution: string;
  gyroQuality: "excellent" | "good" | "average";
};

export type DeviceBrand = {
  id: string;
  name: string;
  icon: string;
  accent: string;
  devices: Device[];
};

const d = (name: string, fps: number, touchRate: number, screenSize: number, resolution: string, gyroQuality: Device["gyroQuality"]): Device =>
  ({ name, fps, touchRate, screenSize, resolution, gyroQuality });

export const BRANDS: DeviceBrand[] = [
  {
    id: "apple",
    name: "Apple",
    icon: "🍎",
    accent: "from-slate-300 to-slate-500",
    devices: [
      d("iPhone 16 Pro Max", 120, 240, 6.9, "2868×1320", "excellent"),
      d("iPhone 16 Pro", 120, 240, 6.3, "2622×1206", "excellent"),
      d("iPhone 16 Plus", 60, 120, 6.7, "2796×1290", "excellent"),
      d("iPhone 16", 60, 120, 6.1, "2556×1179", "excellent"),
      d("iPhone 15 Pro Max", 120, 240, 6.7, "2796×1290", "excellent"),
      d("iPhone 15 Pro", 120, 240, 6.1, "2556×1179", "excellent"),
      d("iPhone 15 Plus", 60, 120, 6.7, "2796×1290", "excellent"),
      d("iPhone 15", 60, 120, 6.1, "2556×1179", "excellent"),
      d("iPhone 14 Pro Max", 120, 240, 6.7, "2796×1290", "excellent"),
      d("iPhone 14 Pro", 120, 240, 6.1, "2556×1179", "excellent"),
      d("iPhone 14 Plus", 60, 120, 6.7, "2778×1284", "excellent"),
      d("iPhone 13 Pro Max", 120, 240, 6.7, "2778×1284", "excellent"),
      d("iPhone 13 Pro", 120, 240, 6.1, "2532×1170", "excellent"),
      d("iPhone 13", 60, 120, 6.1, "2532×1170", "excellent"),
      d("iPhone 12 Pro", 60, 120, 6.1, "2532×1170", "good"),
      d("iPhone 11 Pro Max", 60, 120, 6.5, "2688×1242", "good"),
      d("iPhone 11", 60, 120, 6.1, "1792×828", "good"),
      d("iPad Pro 13 (M4)", 120, 240, 13.0, "2752×2064", "excellent"),
      d("iPad Pro 12.9 (M2)", 120, 240, 12.9, "2732×2048", "excellent"),
      d("iPad Pro 11 (M4)", 120, 240, 11.0, "2420×1668", "excellent"),
      d("iPad Air M2", 60, 120, 11.0, "2360×1640", "excellent"),
      d("iPad Air 5", 60, 120, 10.9, "2360×1640", "good"),
      d("iPad Mini 6", 60, 120, 8.3, "2266×1488", "good"),
      d("iPad 10", 60, 60, 10.9, "2360×1640", "average"),
    ],
  },
  {
    id: "samsung",
    name: "Samsung",
    icon: "📱",
    accent: "from-blue-400 to-indigo-600",
    devices: [
      d("Galaxy S25 Ultra", 120, 240, 6.9, "3120×1440", "excellent"),
      d("Galaxy S25+", 120, 240, 6.7, "3120×1440", "excellent"),
      d("Galaxy S25", 120, 240, 6.2, "2340×1080", "excellent"),
      d("Galaxy S24 Ultra", 120, 240, 6.8, "3120×1440", "excellent"),
      d("Galaxy S24+", 120, 240, 6.7, "3120×1440", "excellent"),
      d("Galaxy S24", 120, 240, 6.2, "2340×1080", "excellent"),
      d("Galaxy S23 Ultra", 120, 240, 6.8, "3088×1440", "excellent"),
      d("Galaxy S22 Ultra", 120, 240, 6.8, "3088×1440", "excellent"),
      d("Galaxy S23+", 120, 240, 6.6, "2340×1080", "excellent"),
      d("Galaxy S23", 120, 240, 6.1, "2340×1080", "excellent"),
      d("Galaxy Z Fold 6", 120, 240, 7.6, "2160×1856", "excellent"),
      d("Galaxy Z Flip 6", 120, 240, 6.7, "2640×1080", "good"),
      d("Galaxy Tab S10 Ultra", 120, 240, 14.6, "2960×1848", "excellent"),
      d("Galaxy Tab S9 Ultra", 120, 240, 14.6, "2960×1848", "excellent"),
      d("Galaxy Tab S9+", 120, 240, 12.4, "2800×1752", "excellent"),
      d("Galaxy Tab S9", 120, 240, 11.0, "2560×1600", "excellent"),
    ],
  },
  {
    id: "xiaomi",
    name: "Xiaomi",
    icon: "📲",
    accent: "from-orange-400 to-red-500",
    devices: [
      d("Xiaomi 15 Ultra", 120, 240, 6.73, "3200×1440", "excellent"),
      d("Xiaomi 14 Ultra", 120, 240, 6.73, "3200×1440", "excellent"),
      d("Xiaomi 14 Pro", 120, 240, 6.73, "3200×1440", "excellent"),
      d("Xiaomi 14", 120, 240, 6.36, "2670×1200", "excellent"),
      d("Xiaomi 13T Pro", 144, 480, 6.67, "2712×1220", "excellent"),
      d("Redmi K70 Pro", 120, 480, 6.67, "3200×1440", "excellent"),
      d("Redmi K70", 120, 480, 6.67, "2712×1220", "excellent"),
      d("Poco F7 Pro", 120, 480, 6.67, "3200×1440", "excellent"),
      d("Poco F6 Pro", 120, 480, 6.67, "3200×1440", "excellent"),
      d("Poco F6", 120, 240, 6.67, "2712×1220", "good"),
      d("Poco X6 Pro", 120, 240, 6.67, "2712×1220", "good"),
      d("Redmi Note 13 Pro+", 120, 240, 6.67, "2712×1220", "good"),
      d("Redmi Note 13", 120, 240, 6.67, "2400×1080", "average"),
    ],
  },
  {
    id: "rog",
    name: "ASUS ROG",
    icon: "🎮",
    accent: "from-red-500 to-rose-700",
    devices: [
      d("ROG Phone 9 Ultimate", 185, 720, 6.78, "2400×1080", "excellent"),
      d("ROG Phone 9 Pro", 165, 720, 6.78, "2400×1080", "excellent"),
      d("ROG Phone 8 Pro", 165, 720, 6.78, "2400×1080", "excellent"),
      d("ROG Phone 7 Ultimate", 165, 720, 6.78, "2400×1080", "excellent"),
    ],
  },
  {
    id: "oneplus",
    name: "OnePlus",
    icon: "⚡",
    accent: "from-red-400 to-pink-600",
    devices: [
      d("OnePlus 13", 120, 240, 6.82, "3168×1440", "excellent"),
      d("OnePlus 12", 120, 240, 6.82, "3168×1440", "excellent"),
      d("OnePlus 11", 120, 240, 6.7, "3216×1440", "excellent"),
      d("OnePlus 12R", 120, 240, 6.78, "2780×1264", "good"),
      d("OnePlus Nord 4", 120, 240, 6.74, "2772×1240", "good"),
    ],
  },
  {
    id: "oppo",
    name: "OPPO",
    icon: "📸",
    accent: "from-emerald-400 to-teal-600",
    devices: [
      d("OPPO Find X8 Pro", 120, 240, 6.78, "2780×1264", "excellent"),
      d("OPPO Find X7 Ultra", 120, 240, 6.82, "3168×1440", "excellent"),
      d("OPPO Reno 12 Pro", 120, 240, 6.7, "2412×1080", "good"),
      d("OPPO Reno 12", 120, 240, 6.7, "2412×1080", "good"),
    ],
  },
  {
    id: "realme",
    name: "Realme",
    icon: "🌟",
    accent: "from-yellow-400 to-amber-600",
    devices: [
      d("Realme GT 7 Pro", 120, 480, 6.78, "2780×1264", "excellent"),
      d("Realme GT 6", 120, 240, 6.78, "2780×1264", "good"),
      d("Realme GT Neo 6", 120, 240, 6.78, "2780×1264", "good"),
    ],
  },
  {
    id: "huawei",
    name: "Huawei",
    icon: "🛰️",
    accent: "from-rose-400 to-red-600",
    devices: [
      d("Huawei Mate 60 Pro", 120, 240, 6.82, "2720×1260", "good"),
      d("Huawei P60 Pro", 120, 240, 6.67, "2700×1220", "good"),
      d("Huawei Mate X5", 120, 240, 7.85, "2496×2224", "good"),
    ],
  },
  {
    id: "gaming",
    name: "Gaming",
    icon: "🕹️",
    accent: "from-fuchsia-500 to-purple-700",
    devices: [
      d("RedMagic 10 Pro", 144, 960, 6.85, "2688×1216", "excellent"),
      d("RedMagic 9 Pro", 120, 960, 6.8, "2480×1116", "excellent"),
      d("RedMagic 8 Pro", 120, 960, 6.8, "2480×1116", "excellent"),
      d("Lenovo Legion Y700", 144, 240, 8.8, "2560×1600", "excellent"),
      d("Lenovo Legion Phone 2 Pro", 144, 720, 6.92, "2460×1080", "excellent"),
    ],
  },
];

export type WeaponCategory = {
  id: string;
  name: string;
  icon: string;
  weapons: { name: string; recoil: number; range: number; type: string }[];
};

const w = (name: string, recoil: number, range: number, type: string) => ({ name, recoil, range, type });

export const WEAPONS: WeaponCategory[] = [
  {
    id: "ar",
    name: "بنادق AR",
    icon: "🔫",
    weapons: [
      w("M416", 72, 65, "AR"),
      w("AKM", 85, 68, "AR"),
      w("M762", 88, 70, "AR"),
      w("SCAR-L", 62, 60, "AR"),
      w("G36C", 65, 62, "AR"),
      w("AUG", 60, 64, "AR"),
      w("QBZ", 64, 60, "AR"),
      w("M16A4", 55, 75, "AR"),
      w("FAMAS", 68, 58, "AR"),
      w("ACE32", 78, 66, "AR"),
      w("Groza", 82, 62, "AR"),
      w("Honey Badger", 70, 58, "AR"),
      w("Mk47 Mutant", 58, 72, "AR"),
      w("K2", 66, 62, "AR"),
    ],
  },
  {
    id: "smg",
    name: "رشاشات SMG",
    icon: "💥",
    weapons: [
      w("UZI", 38, 40, "SMG"),
      w("UMP45", 35, 48, "SMG"),
      w("Vector", 42, 45, "SMG"),
      w("MP5K", 38, 46, "SMG"),
      w("Tommy Gun", 45, 42, "SMG"),
      w("P90", 30, 45, "SMG"),
      w("JS9", 34, 44, "SMG"),
      w("PP-19 Bizon", 32, 48, "SMG"),
      w("MP9", 36, 43, "SMG"),
    ],
  },
  {
    id: "sniper",
    name: "قناصات Sniper",
    icon: "🎯",
    weapons: [
      w("AWM", 95, 100, "Sniper"),
      w("M24", 80, 95, "Sniper"),
      w("Kar98k", 78, 92, "Sniper"),
      w("Win94", 65, 88, "Sniper"),
      w("Mosin-Nagant", 78, 92, "Sniper"),
      w("Lynx AMR", 98, 96, "Sniper"),
      w("M1 Garand", 70, 85, "Sniper"),
    ],
  },
  {
    id: "dmr",
    name: "DMR شبه قناصة",
    icon: "🔭",
    weapons: [
      w("Mini14", 35, 82, "DMR"),
      w("SKS", 52, 75, "DMR"),
      w("SLR", 65, 72, "DMR"),
      w("Mk14", 70, 78, "DMR"),
      w("QBU", 38, 80, "DMR"),
      w("VSS", 25, 70, "DMR"),
      w("Mk12", 40, 80, "DMR"),
      w("Dragunov", 58, 76, "DMR"),
    ],
  },
  {
    id: "lmg",
    name: "بنادق LMG",
    icon: "🌀",
    weapons: [
      w("M249", 58, 65, "LMG"),
      w("DP-28", 50, 60, "LMG"),
      w("MG3", 65, 62, "LMG"),
    ],
  },
  {
    id: "shotgun",
    name: "خراطيش Shotgun",
    icon: "🦃",
    weapons: [
      w("S12K", 70, 25, "Shotgun"),
      w("S1897", 85, 28, "Shotgun"),
      w("S686", 90, 26, "Shotgun"),
      w("DBS", 75, 30, "Shotgun"),
      w("M1014", 72, 28, "Shotgun"),
      w("NS2000", 82, 27, "Shotgun"),
      w("O12", 68, 32, "Shotgun"),
    ],
  },
];

export const FINGERS = [2, 3, 4, 5, 6] as const;

export type PlayStyle = { id: string; icon: string };
export const STYLES: PlayStyle[] = [
  { id: "headshot", icon: "🎯" },
  { id: "spray", icon: "🔥" },
  { id: "competitive", icon: "🏆" },
  { id: "close", icon: "🥊" },
  { id: "reflex", icon: "⚡" },
  { id: "conqueror", icon: "👑" },
];

// ════════════════════════════════════════════════════════════════
// PRO PROFILES — multipliers feed the sensitivity engine
// ════════════════════════════════════════════════════════════════
export type ProProfile = {
  id: string;
  name: string;
  nameAr: string;
  recoilControl: number;
  tracking: number;
  flicking: number;
  longRange: number;
  cqcPower: number;
  description: string;
  descriptionAr: string;
  strengths: string[];
  strengthsAr: string[];
  weaknesses: string[];
  weaknessesAr: string[];
  bestFor: string[];
  bestForAr: string[];
  cqcMul: number;
  scopeNearMul: number;
  scopeFarMul: number;
  gyroMul: number;
  gyroFarMul: number;
};

export const PRO_PROFILES: ProProfile[] = [
  {
    id: "balanced",
    name: "Balanced",
    nameAr: "متوازن",
    recoilControl: 78, tracking: 82, flicking: 80, longRange: 75, cqcPower: 76,
    description: "An all-rounder profile tuned for every range with rock-solid stability.",
    descriptionAr: "بروفايل شامل مضبوط لكل المسافات باستقرار صلب.",
    strengths: ["Consistent at any range", "Easy to learn", "Great for ranked"],
    strengthsAr: ["ثابت على كل المسافات", "سهل التعلّم", "ممتاز للرانكد"],
    weaknesses: ["Not the fastest flicks"],
    weaknessesAr: ["ليس الأسرع في الفليك"],
    bestFor: ["Ranked", "Solo", "Squad"],
    bestForAr: ["رانكد", "سولو", "سكواد"],
    cqcMul: 1.0, scopeNearMul: 1.0, scopeFarMul: 1.0, gyroMul: 1.0, gyroFarMul: 1.0,
  } as ProProfile,
  {
    id: "aggressive",
    name: "Aggressive",
    nameAr: "هجومي",
    recoilControl: 70, tracking: 88, flicking: 92, longRange: 60, cqcPower: 95,
    description: "Built for rushers who live in close quarters — lightning fast reactions.",
    descriptionAr: "مصمم للمهاجمين في المسافات القريبة — ردود فعل خاطفة.",
    strengths: ["Insane CQC", "Fast flicks", "Hip-fire monster"],
    strengthsAr: ["قريب مدى خارق", "فليك سريع", "وحش الهيب-فاير"],
    weaknesses: ["Weaker long range"],
    weaknessesAr: ["أضعف في المدى البعيد"],
    bestFor: ["Rushing", "CQC", "Hot drops"],
    bestForAr: ["اشتباك", "قريب", "هبوط ساخن"],
    cqcMul: 1.05, scopeNearMul: 1.02, scopeFarMul: 0.96, gyroMul: 1.03, gyroFarMul: 0.97,
  } as ProProfile,
  {
    id: "sniper",
    name: "Sniper",
    nameAr: "قنّاص",
    recoilControl: 85, tracking: 70, flicking: 90, longRange: 98, cqcPower: 50,
    description: "Long-range precision king — locked-in scopes and head-level micro-aim.",
    descriptionAr: "ملك الدقة بعيدة المدى — سكوب ثابت وتصويب ميكرو على مستوى الرأس.",
    strengths: ["Best long range", "Headshot precision", "Stable scopes"],
    strengthsAr: ["الأفضل بعيد المدى", "دقة هيدشوت", "سكوب ثابت"],
    weaknesses: ["Weak in CQC"],
    weaknessesAr: ["ضعيف قريب المدى"],
    bestFor: ["Sniping", "Squad support", "Long range"],
    bestForAr: ["قنص", "دعم السكواد", "مدى بعيد"],
    cqcMul: 0.94, scopeNearMul: 0.97, scopeFarMul: 0.93, gyroMul: 0.96, gyroFarMul: 0.92,
  } as ProProfile,
  {
    id: "sprayer",
    name: "Sprayer",
    nameAr: "سبراير",
    recoilControl: 95, tracking: 90, flicking: 72, longRange: 70, cqcPower: 84,
    description: "Recoil-control specialist — full-auto spray that stays on target.",
    descriptionAr: "متخصص في التحكم بالارتداد — سبراي أوتوماتيكي يبقى على الهدف.",
    strengths: ["Best recoil control", "Spray transfer", "Mid-range beast"],
    strengthsAr: ["أفضل تحكم ارتداد", "نقل السبراي", "وحش المدى المتوسط"],
    weaknesses: ["Slower flicks"],
    weaknessesAr: ["فليك أبطأ"],
    bestFor: ["Spray", "Mid range", "Full auto"],
    bestForAr: ["سبراي", "مدى متوسط", "أوتو"],
    cqcMul: 1.02, scopeNearMul: 1.01, scopeFarMul: 0.98, gyroMul: 1.04, gyroFarMul: 1.0,
  } as ProProfile,
  {
    id: "conqueror",
    name: "Conqueror",
    nameAr: "كونكر",
    recoilControl: 90, tracking: 92, flicking: 95, longRange: 90, cqcPower: 88,
    description: "Tournament-grade precision across the board — for Conqueror-tier players.",
    descriptionAr: "دقة بطولية شاملة — للاعبي مستوى الكونكر.",
    strengths: ["Elite all-range", "Tournament ready", "Maximum precision"],
    strengthsAr: ["نخبة كل المسافات", "جاهز للبطولات", "أقصى دقة"],
    weaknesses: ["Requires skill"],
    weaknessesAr: ["يحتاج مهارة"],
    bestFor: ["Conqueror", "Tournaments", "Pro"],
    bestForAr: ["كونكر", "بطولات", "محترف"],
    cqcMul: 0.99, scopeNearMul: 0.98, scopeFarMul: 0.95, gyroMul: 1.01, gyroFarMul: 0.96,
  } as ProProfile,
];

export type ProRecommendation = {
  gyro: string;
  minFingers: number;
  preferredWeaponName: string;
  weaponFocus: string[];
  weaponFocusAr: string[];
  note: string;
  noteAr: string;
  featureStack: string[];
  featureStackAr: string[];
  warmup: string[];
  warmupAr: string[];
};

export const PRO_RECOMMENDATIONS: Record<string, ProRecommendation> = {
  balanced: {
    gyro: "Always On",
    minFingers: 4,
    preferredWeaponName: "M416",
    weaponFocus: ["AR", "Versatile"],
    weaponFocusAr: ["AR", "متعدد"],
    note: "The safest profile. Keep gyro Always On and 4 fingers for a stable, ranked-ready setup.",
    noteAr: "أأمن بروفايل. ابقَ الجايرو Always On و4 أصابع لإعداد مستقر وجاهز للرانكد.",
    featureStack: ["DPI Calc", "Touch Test", "Stability Analysis"],
    featureStackAr: ["حاسبة DPI", "اختبار اللمس", "تحليل الاستقرار"],
    warmup: ["10 min TDM", "Flick drill", "Spray control"],
    warmupAr: ["10 دقائق TDM", "تمرين فليك", "تحكم سبراي"],
  },
  aggressive: {
    gyro: "Always On",
    minFingers: 4,
    preferredWeaponName: "M762",
    weaponFocus: ["SMG", "CQC AR"],
    weaponFocusAr: ["SMG", "AR قريب"],
    note: "Higher CQC sens + strong gyro lets you snap onto targets the instant you push.",
    noteAr: "حساسية قريب أعلى + جايرو قوي يتيح الانقضاض على الأهداف لحظة الدفع.",
    featureStack: ["Touch Test", "DPI Calc", "HUD Preview"],
    featureStackAr: ["اختبار اللمس", "حاسبة DPI", "معاينة HUD"],
    warmup: ["CQC arena", "Hip-fire drill", "Reflex taps"],
    warmupAr: ["ساحة قريب", "تمرين هيب-فاير", "نقرات رد الفعل"],
  },
  sniper: {
    gyro: "Scope On",
    minFingers: 3,
    preferredWeaponName: "Kar98k",
    weaponFocus: ["Sniper", "DMR"],
    weaponFocusAr: ["قنّاص", "DMR"],
    note: "Lower scope sens + gyro Scope On keeps your crosshair glued to head level.",
    noteAr: "حساسية سكوب أقل + جايرو Scope On يبقي التصويب عند مستوى الرأس.",
    featureStack: ["Stability Analysis", "Equations", "Touch Test"],
    featureStackAr: ["تحليل الاستقرار", "المعادلات", "اختبار اللمس"],
    warmup: ["Flick shots", "Tracking drill", "Scope control"],
    warmupAr: ["تصويب خاطف", "تمرين تتبع", "تحكم السكوب"],
  },
  sprayer: {
    gyro: "Always On",
    minFingers: 4,
    preferredWeaponName: "ACE32",
    weaponFocus: ["AR", "LMG"],
    weaponFocusAr: ["AR", "LMG"],
    note: "Max recoil-comp gyro keeps full-auto spray tight. Compensate down as you fire.",
    noteAr: "جايرو تعويض ارتداد أقصى يبقي السبراي مضبوطاً. اسحب للأسفل أثناء الإطلاق.",
    featureStack: ["DPI Calc", "Stability Analysis", "HUD Preview"],
    featureStackAr: ["حاسبة DPI", "تحليل الاستقرار", "معاينة HUD"],
    warmup: ["Spray transfer", "Recoil pattern", "Burst control"],
    warmupAr: ["نقل السبراي", "نمط الارتداد", "تحكم البورست"],
  },
  conqueror: {
    gyro: "Always On",
    minFingers: 5,
    preferredWeaponName: "Groza",
    weaponFocus: ["AR", "All"],
    weaponFocusAr: ["AR", "الكل"],
    note: "Tournament tuning. Demands 5 fingers and Always-On gyro for full-map dominance.",
    noteAr: "ضبط بطولي. يتطلب 5 أصابع وجايرو Always On للسيطرة على كامل الخريطة.",
    featureStack: ["All Tools", "Touch Test", "Stability Analysis"],
    featureStackAr: ["كل الأدوات", "اختبار اللمس", "تحليل الاستقرار"],
    warmup: ["Full map rotation", "5-finger drill", "1v4 scenarios"],
    warmupAr: ["دوران كامل للخريطة", "تمرين 5 أصابع", "سيناريوهات 1 ضد 4"],
  },
};
