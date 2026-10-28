export const bn = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)])

export type Place = {
  id: string
  upazila: string
  district: string
  lon: number
  lat: number
  requests: number
  flooded: boolean
  categories: string[]
  status: {
    pending: number
    verifying: number
    ongoing: number
    done: number
  }
}

export const PLACES: Place[] = [
  {
    id: "kurigram-sadar",
    upazila: "কুড়িগ্রাম সদর",
    district: "কুড়িগ্রাম",
    lon: 89.65,
    lat: 25.8,
    requests: 14,
    flooded: true,
    categories: ["খাদ্য", "বিশুদ্ধ পানি", "উদ্ধার"],
    status: { pending: 4, verifying: 3, ongoing: 5, done: 2 },
  },
  {
    id: "gaibandha-sadar",
    upazila: "গাইবান্ধা সদর",
    district: "গাইবান্ধা",
    lon: 89.54,
    lat: 25.33,
    requests: 9,
    flooded: true,
    categories: ["খাদ্য", "ওষুধ"],
    status: { pending: 2, verifying: 2, ongoing: 3, done: 2 },
  },
  {
    id: "sirajganj-chowhali",
    upazila: "চৌহালী",
    district: "সিরাজগঞ্জ",
    lon: 89.6,
    lat: 24.4,
    requests: 6,
    flooded: false,
    categories: ["আশ্রয়", "খাদ্য"],
    status: { pending: 3, verifying: 2, ongoing: 1, done: 0 },
  },
  {
    id: "sunamganj-sadar",
    upazila: "সুনামগঞ্জ সদর",
    district: "সুনামগঞ্জ",
    lon: 91.4,
    lat: 25.05,
    requests: 21,
    flooded: true,
    categories: ["উদ্ধার", "খাদ্য", "বিশুদ্ধ পানি", "ওষুধ"],
    status: { pending: 6, verifying: 5, ongoing: 7, done: 3 },
  },
  {
    id: "sylhet-companiganj",
    upazila: "কোম্পানীগঞ্জ",
    district: "সিলেট",
    lon: 91.9,
    lat: 25.0,
    requests: 11,
    flooded: true,
    categories: ["উদ্ধার", "খাদ্য"],
    status: { pending: 3, verifying: 3, ongoing: 4, done: 1 },
  },
  {
    id: "netrokona-kalmakanda",
    upazila: "কলমাকান্দা",
    district: "নেত্রকোনা",
    lon: 90.85,
    lat: 25.0,
    requests: 5,
    flooded: false,
    categories: ["খাদ্য"],
    status: { pending: 2, verifying: 1, ongoing: 2, done: 0 },
  },
  {
    id: "jamalpur-islampur",
    upazila: "ইসলামপুর",
    district: "জামালপুর",
    lon: 89.85,
    lat: 25.1,
    requests: 7,
    flooded: true,
    categories: ["খাদ্য", "আশ্রয়"],
    status: { pending: 2, verifying: 1, ongoing: 3, done: 1 },
  },
  {
    id: "feni-chhagalnaiya",
    upazila: "ছাগলনাইয়া",
    district: "ফেনী",
    lon: 91.5,
    lat: 23.05,
    requests: 8,
    flooded: true,
    categories: ["উদ্ধার", "আশ্রয়", "ওষুধ"],
    status: { pending: 1, verifying: 2, ongoing: 3, done: 2 },
  },
  {
    id: "noakhali-companiganj",
    upazila: "কোম্পানীগঞ্জ (নোয়াখালী)",
    district: "নোয়াখালী",
    lon: 91.1,
    lat: 22.7,
    requests: 4,
    flooded: false,
    categories: ["খাদ্য", "বিশুদ্ধ পানি"],
    status: { pending: 1, verifying: 1, ongoing: 1, done: 1 },
  },
  {
    id: "khulna-koyra",
    upazila: "কয়রা",
    district: "খুলনা",
    lon: 89.3,
    lat: 22.35,
    requests: 3,
    flooded: false,
    categories: ["বিশুদ্ধ পানি"],
    status: { pending: 1, verifying: 1, ongoing: 1, done: 0 },
  },
]

export const DISTRICTS = [
  "কুড়িগ্রাম",
  "গাইবান্ধা",
  "সিরাজগঞ্জ",
  "সুনামগঞ্জ",
  "সিলেট",
  "নেত্রকোনা",
  "জামালপুর",
  "ফেনী",
  "নোয়াখালী",
  "খুলনা",
  "ঢাকা",
  "চট্টগ্রাম",
  "রংপুর",
  "বরিশাল",
]
export const UPAZILAS: Record<string, string[]> = {
  কুড়িগ্রাম: ["কুড়িগ্রাম সদর", "উলিপুর", "চিলমারী", "নাগেশ্বরী"],
  গাইবান্ধা: ["গাইবান্ধা সদর", "ফুলছড়ি", "সাঘাটা"],
  সিরাজগঞ্জ: ["চৌহালী", "কাজীপুর", "বেলকুচি"],
  সুনামগঞ্জ: ["সুনামগঞ্জ সদর", "ছাতক", "দোয়ারাবাজার"],
  সিলেট: ["কোম্পানীগঞ্জ", "গোয়াইনঘাট", "জৈন্তাপুর"],
  নেত্রকোনা: ["কলমাকান্দা", "দুর্গাপুর"],
  জামালপুর: ["ইসলামপুর", "দেওয়ানগঞ্জ"],
  ফেনী: ["ছাগলনাইয়া", "পরশুরাম", "ফুলগাজী"],
  নোয়াখালী: ["কোম্পানীগঞ্জ (নোয়াখালী)", "সুবর্ণচর"],
  খুলনা: ["কয়রা", "দাকোপ"],
  ঢাকা: ["কেরানীগঞ্জ", "সাভার"],
  চট্টগ্রাম: ["সীতাকুণ্ড", "মিরসরাই"],
  রংপুর: ["গঙ্গাচড়া", "কাউনিয়া"],
  বরিশাল: ["মুলাদী", "হিজলা"],
}

export const AID = ["খাদ্য", "বিশুদ্ধ পানি", "ওষুধ", "উদ্ধার", "আশ্রয়"]

export type Req = {
  id: string
  type: "direct" | "proxy"
  district: string
  upazila: string
  people: number
  aid: string[]
  time: string
  verify: "pending" | "verified" | "rejected"
  priority: "high" | "medium" | "low"
  team?: string
  mission: "pending" | "assigned" | "ongoing" | "done"
  note: string
  phone: string
  reporter: string
}

export const REQUESTS: Req[] = [
  {
    id: "SH-24-0412",
    type: "direct",
    district: "সুনামগঞ্জ",
    upazila: "সুনামগঞ্জ সদর",
    people: 12,
    aid: ["উদ্ধার", "খাদ্য"],
    time: "৯ অক্টো, সকাল ৮:১২",
    verify: "pending",
    priority: "high",
    mission: "pending",
    note: "বাড়ির নিচতলা ডুবে গেছে। শিশু ও বয়স্ক মানুষ ছাদে আটকে আছেন।",
    phone: "০১৭১১-০০০০১২",
    reporter: "আবেদনকারী নিজেই",
  },
  {
    id: "SH-24-0411",
    type: "proxy",
    district: "কুড়িগ্রাম",
    upazila: "কুড়িগ্রাম সদর",
    people: 5,
    aid: ["বিশুদ্ধ পানি", "ওষুধ"],
    time: "৯ অক্টো, সকাল ৭:৪০",
    verify: "verified",
    priority: "high",
    team: "তিস্তা উদ্ধার দল",
    mission: "ongoing",
    note: "আত্মীয়ের পরিবার বাঁধের ওপর আশ্রয় নিয়েছে। পানীয় জল শেষ।",
    phone: "০১৮১২-০০০০৪৫",
    reporter: "সাদিয়া ইসলাম (প্রতিবেশী)",
  },
  {
    id: "SH-24-0409",
    type: "direct",
    district: "ফেনী",
    upazila: "ছাগলনাইয়া",
    people: 8,
    aid: ["আশ্রয়", "খাদ্য"],
    time: "৮ অক্টো, রাত ১১:২০",
    verify: "verified",
    priority: "medium",
    team: "ফেনী সবুজ দল",
    mission: "assigned",
    note: "ঘর পানিতে তলিয়ে গেছে, স্কুলে আশ্রয় প্রয়োজন।",
    phone: "০১৯১৫-০০০০৭৭",
    reporter: "আবেদনকারী নিজেই",
  },
  {
    id: "SH-24-0405",
    type: "direct",
    district: "গাইবান্ধা",
    upazila: "গাইবান্ধা সদর",
    people: 3,
    aid: ["ওষুধ"],
    time: "৮ অক্টো, রাত ৯:০৫",
    verify: "pending",
    priority: "medium",
    mission: "pending",
    note: "ডায়াবেটিসের রোগীর জন্য জরুরি ওষুধ প্রয়োজন।",
    phone: "০১৬২২-০০০০৩৩",
    reporter: "আবেদনকারী নিজেই",
  },
  {
    id: "SH-24-0398",
    type: "proxy",
    district: "সিরাজগঞ্জ",
    upazila: "চৌহালী",
    people: 20,
    aid: ["খাদ্য", "আশ্রয়"],
    time: "৮ অক্টো, বিকাল ৪:৩০",
    verify: "verified",
    priority: "low",
    team: "যমুনা তীর স্বেচ্ছাসেবক",
    mission: "done",
    note: "চরের ২০টি পরিবারের শুকনো খাবার প্রয়োজন ছিল।",
    phone: "০১৭৭৭-০০০০৯৯",
    reporter: "রাকিব হাসান (ইউপি সদস্যের সহকারী)",
  },
  {
    id: "SH-24-0391",
    type: "direct",
    district: "নেত্রকোনা",
    upazila: "কলমাকান্দা",
    people: 6,
    aid: ["খাদ্য"],
    time: "৮ অক্টো, দুপুর ১২:১০",
    verify: "rejected",
    priority: "low",
    mission: "pending",
    note: "তথ্য অসম্পূর্ণ, যোগাযোগ করা যায়নি।",
    phone: "০১৫১৫-০০০০২২",
    reporter: "আবেদনকারী নিজেই",
  },
]

export const SUPPLIERS = [
  {
    id: "s1",
    name: "রহমান ট্রেডার্স",
    cat: "খাদ্যসামগ্রী",
    place: "সিলেট, কোম্পানীগঞ্জ",
    contact: "০১৭১২-০০০১০১",
    verified: true,
    avail: "সরবরাহে প্রস্তুত",
    res: [
      {
        name: "চাল (৫ কেজি প্যাকেট)",
        cat: "খাদ্য",
        qty: 1200,
        status: "মজুদ আছে",
        note: "গুদাম: সিলেট সদর",
      },
      {
        name: "শুকনো খাবারের প্যাকেট",
        cat: "খাদ্য",
        qty: 340,
        status: "মজুদ আছে",
        note: "চিড়া, গুড়, বিস্কুট",
      },
    ],
  },
  {
    id: "s2",
    name: "নদীপথ বোট সার্ভিস",
    cat: "পরিবহন",
    place: "সুনামগঞ্জ, সদর",
    contact: "০১৮১৯-০০০২০২",
    verified: true,
    avail: "আংশিক প্রস্তুত",
    res: [
      {
        name: "ইঞ্জিনচালিত নৌকা",
        cat: "উদ্ধার",
        qty: 6,
        status: "সীমিত",
        note: "২টি মেরামতাধীন",
      },
    ],
  },
  {
    id: "s3",
    name: "আরোগ্য মেডিক্যাল সাপ্লাই",
    cat: "চিকিৎসা",
    place: "গাইবান্ধা, সদর",
    contact: "০১৬১১-০০০৩০৩",
    verified: false,
    avail: "যাচাই চলছে",
    res: [
      {
        name: "ওরস্যালাইন",
        cat: "ওষুধ",
        qty: 2500,
        status: "মজুদ আছে",
        note: "মেয়াদ ২০২৭ পর্যন্ত",
      },
      {
        name: "প্রাথমিক চিকিৎসা বক্স",
        cat: "ওষুধ",
        qty: 0,
        status: "মজুদ শেষ",
        note: "নতুন চালান অপেক্ষমাণ",
      },
    ],
  },
]

export const statusLabel: Record<string, string> = {
  pending: "অপেক্ষমাণ",
  verified: "যাচাইকৃত",
  rejected: "বাতিল",
  assigned: "দল নির্ধারিত",
  ongoing: "কার্যক্রম চলমান",
  done: "সম্পন্ন",
  high: "জরুরি",
  medium: "মাঝারি",
  low: "সাধারণ",
}
