import { REQUESTS, SUPPLIERS } from "./data"
import { getLanguage } from "./locale"
import { isProfileImage } from "./profile-image"

export const VERSION = 1
export const SKILLS = [
  "নৌকা চালনা",
  "প্রাথমিক চিকিৎসা",
  "রান্না ও খাদ্য বিতরণ",
  "সাঁতার",
  "যোগাযোগ সমন্বয়",
  "যানবাহন চালনা",
]
export const ORGANIZATION_TYPES = [
  "বেসরকারি উন্নয়ন সংস্থা (এনজিও)",
  "অলাভজনক / দাতব্য সংস্থা",
  "স্থানীয় কমিউনিটি সংগঠন",
  "সরকারি প্রতিষ্ঠান",
  "শিক্ষাপ্রতিষ্ঠানভিত্তিক সংগঠন",
]
export type Role = "volunteer" | "org" | "admin"
export type Verification = "pending" | "verified" | "rejected"
export type MissionStatus = "assigned" | "acknowledged" | "ongoing" | "problem" | "done" | "cancelled" | "failed"
export type Account = {
  id: string
  name: string
  role: Role
  volunteerId?: string
  orgId?: string
}
export type Volunteer = {
  id: string
  name: string
  phone: string
  district: string
  upazila: string
  areas: string[]
  skills: string[]
  availability: "available" | "limited" | "unavailable"
  vehicleAccess: boolean
  swimmingCapability: boolean
  profileImage?: string
}
export type Organization = {
  id: string
  adminId: string
  name: string
  description: string
  organizationType: string
  contactEmail: string
  contactPhone: string
  areas: string[]
  locations: string[]
  verification: Verification
  reason: string
  createdAt: string
  profileImage?: string
}
export type Membership = {
  id: string
  orgId: string
  volunteerId: string
  status: "pending" | "approved" | "rejected"
  reason: string
  updatedAt: string
}
export type Team = {
  id: string
  orgId: string
  name: string
  areas: string[]
  memberIds: string[]
  leaderId: string
  availability: "ready" | "limited" | "unavailable"
  capabilities: string[]
}
export type HelpRequest = {
  id: string
  requesterUserId?: string
  victimName: string
  phone: string
  reporter: string
  reporterPhone: string
  relation: string
  district: string
  upazila: string
  people: number
  aid: string[]
  note: string
  isProxy: boolean
  risks: string[]
  priority: "high" | "medium" | "low"
  verification: Verification | "clarification"
  reviewNote: string
  trackingCode: string
  createdAt: string
  updatedAt: string
}
export type Mission = {
  id: string
  requestId: string
  teamId: string
  status: MissionStatus
  createdAt: string
  updatedAt: string
  history: {
    at: string
    text: string
    status: MissionStatus
  }[]
}
export type Resource = {
  id: string
  name: string
  cat: string
  qty: number
  note: string
}
export type Supplier = {
  id: string
  name: string
  cat: string
  place: string
  contact: string
  verified: boolean
  res: Resource[]
}
export type DemoState = {
  version: number
  sessionId: string | null
  accounts: Account[]
  volunteers: Volunteer[]
  organizations: Organization[]
  memberships: Membership[]
  teams: Team[]
  requests: HelpRequest[]
  missions: Mission[]
  suppliers: Supplier[]
}
export const labels: Record<string, string> = {
  pending: "যাচাই অপেক্ষমাণ",
  verified: "যাচাইকৃত",
  rejected: "প্রত্যাখ্যাত",
  clarification: "তথ্য স্পষ্টকরণ প্রয়োজন",
  approved: "সদস্যপদ অনুমোদিত",
  assigned: "নেতার স্বীকৃতি অপেক্ষমাণ",
  acknowledged: "দল স্বীকৃতি দিয়েছে",
  ongoing: "কার্যক্রম চলমান",
  problem: "সমস্যা জানানো হয়েছে",
  done: "সহায়তা সম্পন্ন",
  cancelled: "কার্যক্রম বাতিল",
  failed: "কার্যক্রম ব্যর্থ",
  ready: "প্রস্তুত",
  limited: "সীমিত প্রাপ্যতা",
  unavailable: "অনুপলব্ধ",
  available: "এখনই প্রস্তুত",
}
export const time = (value: string) =>
  new Date(value).toLocaleString(getLanguage() === "en" ? "en-BD" : "bn-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  })
export const active = (m: Mission) =>
  !["done", "cancelled", "failed"].includes(m.status)
export function missionStage(m: Mission): "assigned" | "acknowledged" | "ongoing" | "done" {
  if (["assigned", "acknowledged", "ongoing", "done"].includes(m.status)) {
    return m.status as "assigned" | "acknowledged" | "ongoing" | "done"
  }
  const previous = [...m.history].reverse().find(entry =>
    ["assigned", "acknowledged", "ongoing", "done"].includes(entry.status),
  )
  return (previous?.status ?? "assigned") as "assigned" | "acknowledged" | "ongoing" | "done"
}
export const account = (s: DemoState) =>
  s.accounts.find((a) => a.id === s.sessionId)
export const membership = (s: DemoState, volunteerId?: string) =>
  s.memberships.find(
    (m) => m.volunteerId === volunteerId && m.status === "approved",
  )
export const teamFor = (s: DemoState, volunteerId?: string) =>
  s.teams.find((t) => t.memberIds.includes(volunteerId ?? ""))
export const latestMission = (s: DemoState, requestId: string) =>
  s.missions.filter((m) => m.requestId === requestId).slice(-1)[0]
export const progress = (s: DemoState, r: HelpRequest) => {
  if (r.verification !== "verified") return labels[r.verification]
  const m = latestMission(s, r.id)
  return m
    ? ["cancelled", "failed"].includes(m.status)
      ? "পুনরায় দল নির্ধারণ অপেক্ষমাণ"
      : labels[m.status]
    : "যাচাইকৃত · দল নির্ধারণ অপেক্ষমাণ"
}
export function canViewMission(s: DemoState, m: Mission) {
  const a = account(s),
    t = s.teams.find((t) => t.id === m.teamId)
  return (
    !!a &&
    !!t &&
    (a.role === "admin" ||
      (a.role === "org" && a.orgId === t.orgId) ||
      (a.role === "volunteer" && t.memberIds.includes(a.volunteerId ?? "")))
  )
}
export function eligibility(s: DemoState, t: Team, r: HelpRequest): string[] {
  const reasons: string[] = []
  if (
    s.organizations.find((o) => o.id === t.orgId)?.verification !== "verified"
  )
    reasons.push("সংগঠন যাচাইকৃত নয়")
  if (!t.areas.includes(r.district) && !t.areas.includes(r.upazila))
    reasons.push("কার্যএলাকা মেলে না")
  if (t.availability !== "ready") reasons.push("দল প্রস্তুত নয়")
  if (s.missions.some((m) => m.teamId === t.id && active(m)))
    reasons.push("অন্য সক্রিয় কার্যক্রম রয়েছে")
  if (!t.leaderId || !t.memberIds.includes(t.leaderId))
    reasons.push("দলের নেতা নেই")
  if (
    t.memberIds.some(
      (id) =>
        !s.memberships.some(
          (m) =>
            m.volunteerId === id &&
            m.orgId === t.orgId &&
            m.status === "approved",
        ),
    )
  )
    reasons.push("অনুমোদিত সদস্য প্রয়োজন")
  if (!r.aid.every((need) => t.capabilities.includes(need)))
    reasons.push("প্রয়োজনীয় সক্ষমতা অসম্পূর্ণ")
  return reasons
}

export function seed(): DemoState {
  const createdAt = "2026-07-01T08:00:00.000Z"
  const volunteers: Volunteer[] = [
    ["v1", "ফারজানা আক্তার", "কুড়িগ্রাম", "কুড়িগ্রাম সদর"],
    ["v2", "নাসির উদ্দিন", "কুড়িগ্রাম", "উলিপুর"],
    ["v3", "রাফিয়া সুলতানা", "সুনামগঞ্জ", "সুনামগঞ্জ সদর"],
    ["v4", "কামরুল হাসান", "সুনামগঞ্জ", "ছাতক"],
    ["v5", "আয়েশা সিদ্দিকা", "সুনামগঞ্জ", "দোয়ারাবাজার"],
    ["v6", "মাহমুদা খাতুন", "ফেনী", "ছাগলনাইয়া"],
    ["v7", "রাশেদুল ইসলাম", "সিরাজগঞ্জ", "চৌহালী"],
    ["v8", "সুমাইয়া আক্তার", "সুনামগঞ্জ", "সুনামগঞ্জ সদর"],
  ].map(([id, name, district, upazila]) => ({
    id,
    name,
    district,
    upazila,
    phone: "০১৭০০-০০০০০০",
    areas: [upazila],
    skills: [SKILLS[0], SKILLS[1]],
    availability: "available",
    vehicleAccess: false,
    swimmingCapability: true,
  }))
  const organizations: Organization[] = [
    {
      id: "o1",
      adminId: "a-org1",
      name: "সবুজ বাংলা ফাউন্ডেশন",
      areas: ["সুনামগঞ্জ", "সিলেট", "কুড়িগ্রাম", "ফেনী", "সিরাজগঞ্জ"],
      verification: "verified",
    },
    {
      id: "o2",
      adminId: "a-org2",
      name: "তিস্তা মানবিক সহায়তা কেন্দ্র",
      areas: ["কুড়িগ্রাম", "রংপুর"],
      verification: "pending",
    },
  ].map(
    (o) =>
      ({
        description: "উদ্ধার, খাদ্য সহায়তা ও পুনর্বাসনে স্থানীয় স্বেচ্ছাসেবকদের সঙ্গে কাজ করে।",
        organizationType: ORGANIZATION_TYPES[1],
        contactEmail: "demo@example.org",
        contactPhone: "০১৭০০-০০০০০০",
        locations: ["সুনামগঞ্জ সদর, সুনামগঞ্জ"],
        reason: "",
        createdAt,
        ...o,
      }) as Organization,
  )
  const teams: Team[] = [
    {
      id: "t1",
      orgId: "o1",
      name: "তিস্তা উদ্ধার দল",
      areas: ["কুড়িগ্রাম"],
      memberIds: ["v1", "v2"],
      leaderId: "v1",
      availability: "ready",
      capabilities: ["খাদ্য", "বিশুদ্ধ পানি", "ওষুধ", "উদ্ধার", "আশ্রয়"],
    },
    {
      id: "t2",
      orgId: "o1",
      name: "সুরমা নৌ-উদ্ধার",
      areas: ["সুনামগঞ্জ", "সিলেট"],
      memberIds: ["v4", "v5"],
      leaderId: "v4",
      availability: "ready",
      capabilities: ["উদ্ধার", "খাদ্য", "বিশুদ্ধ পানি"],
    },
    {
      id: "t3",
      orgId: "o1",
      name: "ফেনী সবুজ দল",
      areas: ["ফেনী"],
      memberIds: ["v6"],
      leaderId: "v6",
      availability: "ready",
      capabilities: ["আশ্রয়", "খাদ্য"],
    },
    {
      id: "t4",
      orgId: "o1",
      name: "যমুনা তীর স্বেচ্ছাসেবক",
      areas: ["সিরাজগঞ্জ"],
      memberIds: ["v7"],
      leaderId: "v7",
      availability: "ready",
      capabilities: ["আশ্রয়", "খাদ্য"],
    },
  ]
  return {
    version: VERSION,
    sessionId: null,
    volunteers,
    organizations,
    teams,
    accounts: [
      ...volunteers.map((v) => ({
        id: `a-${v.id}`,
        name: v.name,
        role: "volunteer" as const,
        volunteerId: v.id,
      })),
      { id: "a-org1", name: "তানভীর আহমেদ", role: "org", orgId: "o1" },
      { id: "a-org2", name: "নুসরাত জাহান", role: "org", orgId: "o2" },
      { id: "a-admin", name: "প্ল্যাটফর্ম প্রশাসক", role: "admin" },
    ],
    memberships: volunteers.map((v) => ({
      id: `mb-${v.id}`,
      volunteerId: v.id,
      orgId: "o1",
      status: v.id === "v3" ? "pending" : "approved",
      reason: "",
      updatedAt: createdAt,
    })),
    requests: REQUESTS.map((r, i) => ({
      id: r.id,
      victimName: "নমুনা ব্যক্তি",
      phone: "০১৭০০-০০০০০০",
      reporter: "ডেমো আবেদনকারী",
      reporterPhone: "",
      relation: "",
      district: r.district,
      upazila: r.upazila,
      people: r.people,
      aid: r.aid,
      note: r.note,
      isProxy: r.type === "proxy",
      risks: i === 0 ? ["আটকে আছেন", "শিশু ঝুঁকিতে", "বয়স্ক ব্যক্তি"] : [],
      priority: r.priority,
      verification: r.verify,
      reviewNote: "",
      trackingCode: `DEMO-${412 - i}`,
      createdAt,
      updatedAt: createdAt,
    })),
    missions: REQUESTS.filter((r) => r.team).map((r) => ({
      id: `M-${r.id.slice(-4)}`,
      requestId: r.id,
      teamId: teams.find((t) => t.name === r.team)!.id,
      status: r.mission as MissionStatus,
      createdAt,
      updatedAt: createdAt,
      history: [
        {
          at: createdAt,
          text: "ডেমো: যাচাইয়ের পর দল নির্ধারিত",
          status: r.mission as MissionStatus,
        },
      ],
    })),
    suppliers: SUPPLIERS.map((s) => ({
      ...s,
      res: s.res.map((r, i) => ({ ...r, id: `${s.id}-r${i}` })),
    })),
  }
}

export type Action = {
  type: "login"
  id: string | null
} | {
  type: "request"
  record: HelpRequest
} | {
  type: "registerVolunteer"
  volunteer: Volunteer
  account: Account
  orgId?: string
  membershipId: string
} | {
  type: "profile"
  record: Volunteer
} | {
  type: "registerOrg"
  record: Organization
  account: Account
} | {
  type: "orgProfile"
  record: Organization
} | {
  type: "verifyOrg"
  id: string
  status: Verification
  reason: string
} | {
  type: "join"
  record: Membership
} | {
  type: "membership"
  id: string
  status: "approved" | "rejected"
  reason: string
} | {
  type: "team"
  record: Team
} | {
  type: "review"
  id: string
  status: HelpRequest["verification"]
  reason: string
} | {
  type: "clarify"
  id: string
  code: string
  note: string
} | {
  type: "dispatch"
  requestId: string
  teamId: string
  id: string
} | {
  type: "mission"
  id: string
  status: MissionStatus
  note: string
} | {
  type: "supplier"
  record: Supplier
} | {
  type: "resource"
  supplierId: string
  record: Resource
}

// The same invariants protect UI actions and direct reducer calls in this demo.
export function transition(
  state: DemoState,
  action: Action,
  now = new Date().toISOString(),
): DemoState {
  const s = structuredClone(state),
    a = account(s)
  const assert: (ok: unknown, message: string) => asserts ok = (
    ok,
    message,
  ) => {
    if (!ok) throw new Error(message)
  }
  const admin = () =>
    assert(a?.role === "admin", "শুধু সুপার অ্যাডমিন এই কাজ করতে পারেন।")
  const owner = (orgId: string, operational = true) => {
    const o = s.organizations.find((o) => o.id === orgId)
    assert(a?.role === "org" && a.orgId === orgId, "এই সংগঠনে প্রবেশাধিকার নেই।")
    assert(
      !operational || o?.verification === "verified",
      "সংগঠনের যাচাই সম্পন্ন হওয়া প্রয়োজন।",
    )
  }
  switch (action.type) {
    case "login":
      assert(
        !action.id || s.accounts.some((x) => x.id === action.id),
        "অ্যাকাউন্ট পাওয়া যায়নি।",
      )
      s.sessionId = action.id
      break
    case "request":
      assert(
        !s.requests.some((r) => r.id === action.record.id),
        "আবেদনটি ইতিমধ্যে জমা হয়েছে।",
      )
      assert(
        action.record.people > 0 && action.record.aid.length > 0,
        "আবেদনের তথ্য অসম্পূর্ণ।",
      )
      assert(
        !s.requests.some((r) => r.trackingCode === action.record.trackingCode),
        "ট্র্যাকিং কোডটি ব্যবহৃত হয়েছে। আবার চেষ্টা করুন।",
      )
      s.requests.push({ ...action.record, verification: "pending" })
      break
    case "registerVolunteer":
      assert(isProfileImage(action.volunteer.profileImage), "ছবিটি প্রস্তুত করা যায়নি। আবার চেষ্টা করুন।")
      assert(
        !s.volunteers.some((v) => v.id === action.volunteer.id),
        "অ্যাকাউন্টটি ইতিমধ্যে তৈরি হয়েছে।",
      )
      s.volunteers.push(action.volunteer)
      s.accounts.push(action.account)
      s.sessionId = action.account.id
      if (action.orgId) {
        assert(
          s.organizations.some(
            (o) => o.id === action.orgId && o.verification === "verified",
          ),
          "যাচাইকৃত সংগঠন বেছে নিন।",
        )
        s.memberships.push({
          id: action.membershipId,
          orgId: action.orgId,
          volunteerId: action.volunteer.id,
          status: "pending",
          reason: "",
          updatedAt: now,
        })
      }
      break
    case "profile":
      assert(
        a?.role === "volunteer" && a.volunteerId === action.record.id,
        "নিজের প্রোফাইলই সম্পাদনা করা যাবে।",
      )
      assert(isProfileImage(action.record.profileImage), "ছবিটি প্রস্তুত করা যায়নি। আবার চেষ্টা করুন।")
      s.volunteers = s.volunteers.map((v) =>
        v.id === action.record.id ? action.record : v,
      )
      s.accounts = s.accounts.map((x) =>
        x.id === a.id ? { ...x, name: action.record.name } : x,
      )
      break
    case "registerOrg":
      assert(isProfileImage(action.record.profileImage), "ছবিটি প্রস্তুত করা যায়নি। আবার চেষ্টা করুন।")
      assert(
        action.record.adminId === action.account.id &&
          action.account.orgId === action.record.id,
        "প্রশাসক সম্পর্ক সঠিক নয়।",
      )
      assert(
        !s.organizations.some(
          (o) => o.name.trim() === action.record.name.trim(),
        ),
        "এই নামে সংগঠন ইতিমধ্যে রয়েছে।",
      )
      s.organizations.push({ ...action.record, verification: "pending" })
      s.accounts.push(action.account)
      s.sessionId = action.account.id
      break
    case "orgProfile":
      owner(action.record.id, false)
      assert(isProfileImage(action.record.profileImage), "ছবিটি প্রস্তুত করা যায়নি। আবার চেষ্টা করুন।")
      assert(
        s.teams.filter(t => t.orgId === action.record.id).every(t =>
          t.areas.every(area => action.record.areas.includes(area)),
        ),
        "এই জেলায় ছোট দলের কার্যএলাকা রয়েছে। আগে দলটির কার্যএলাকা পরিবর্তন করুন।",
      )
      s.organizations = s.organizations.map((o) =>
        o.id === action.record.id
          ? {
              ...action.record,
              adminId: o.adminId,
              createdAt: o.createdAt,
              verification: o.verification,
              reason: o.reason,
            }
          : o,
      )
      break
    case "verifyOrg": {
      admin()
      const o = s.organizations.find((o) => o.id === action.id)
      assert(o, "সংগঠন পাওয়া যায়নি।")
      assert(
        action.status !== "rejected" || action.reason.trim(),
        "প্রত্যাখ্যানের কারণ লিখুন।",
      )
      assert(
        !s.missions.some(
          (m) =>
            active(m) && s.teams.find((t) => t.id === m.teamId)?.orgId === o.id,
        ),
        "সক্রিয় কার্যক্রম থাকলে যাচাই-অবস্থা পরিবর্তন করা যাবে না।",
      )
      o.verification = action.status
      o.reason = action.reason
      break
    }
    case "join": {
      assert(
        a?.role === "volunteer" && a.volunteerId === action.record.volunteerId,
        "নিজের সদস্যপদের অনুরোধ পাঠান।",
      )
      assert(
        s.organizations.some(
          (o) => o.id === action.record.orgId && o.verification === "verified",
        ),
        "সংগঠন এখনো যাচাইকৃত নয়।",
      )
      assert(
        !s.memberships.some(
          (m) =>
            m.volunteerId === a.volunteerId &&
            ["approved", "pending"].includes(m.status),
        ),
        "সদস্যপদ বা অপেক্ষমাণ অনুরোধ ইতিমধ্যে রয়েছে।",
      )
      s.memberships.push({
        ...action.record,
        status: "pending",
        reason: "",
        updatedAt: now,
      })
      break
    }
    case "membership": {
      const m = s.memberships.find((m) => m.id === action.id)
      assert(m, "অনুরোধ পাওয়া যায়নি।")
      owner(m.orgId)
      assert(action.status !== "rejected" || action.reason.trim(), "কারণ লিখুন।")
      assert(
        !s.teams.some((t) => t.memberIds.includes(m.volunteerId)),
        "আগে সদস্যকে দল থেকে সরান; সক্রিয় কার্যক্রমে দল পরিবর্তন করা যাবে না।",
      )
      assert(
        m.status === "pending" || m.status === "approved",
        "এই অনুরোধ আর সক্রিয় নয়।",
      )
      if (action.status === "approved")
        assert(
          !s.memberships.some(
            (x) =>
              x.id !== m.id &&
              x.volunteerId === m.volunteerId &&
              x.status === "approved",
          ),
          "অন্য সংগঠনে সদস্যপদ রয়েছে।",
        )
      m.status = action.status
      m.reason = action.reason
      m.updatedAt = now
      break
    }
    case "team": {
      const t = action.record
      owner(t.orgId)
      const old = s.teams.find((x) => x.id === t.id)
      assert(!old || old.orgId === t.orgId, "দলের মালিকানা বদলানো যাবে না।")
      assert(
        !s.missions.some((m) => m.teamId === t.id && active(m)),
        "সক্রিয় কার্যক্রমের সময় দল সম্পাদনা বন্ধ।",
      )
      assert(
        t.name.trim() &&
          t.areas.length &&
          t.memberIds.length &&
          t.capabilities.length,
        "দলের সব প্রয়োজনীয় তথ্য দিন।",
      )
      assert(
        t.memberIds.includes(t.leaderId),
        "নেতা দলের সদস্যদের মধ্য থেকে বেছে নিন।",
      )
      assert(
        t.areas.every((area) =>
          s.organizations.find((o) => o.id === t.orgId)?.areas.includes(area),
        ),
        "সংগঠনের কার্যএলাকার মধ্য থেকে বেছে নিন।",
      )
      assert(
        t.memberIds.every((id) =>
          s.memberships.some(
            (m) =>
              m.volunteerId === id &&
              m.orgId === t.orgId &&
              m.status === "approved",
          ),
        ),
        "শুধু অনুমোদিত সদস্য যোগ করা যাবে।",
      )
      assert(
        !s.teams.some(
          (x) =>
            x.id !== t.id && x.memberIds.some((id) => t.memberIds.includes(id)),
        ),
        "একজন সদস্য একই সময়ে একটি ছোট দলেই থাকতে পারবেন।",
      )
      s.teams = old
        ? s.teams.map((x) => (x.id === t.id ? t : x))
        : [...s.teams, t]
      break
    }
    case "review": {
      admin()
      const r = s.requests.find((r) => r.id === action.id)
      assert(r, "আবেদন পাওয়া যায়নি।")
      assert(
        !s.missions.some(
          (m) => m.requestId === r.id && (active(m) || m.status === "done"),
        ),
        "নির্ধারিত/সম্পন্ন কার্যক্রমের আবেদন পুনরায় যাচাই করা যাবে না।",
      )
      assert(
        !["rejected", "clarification"].includes(action.status) ||
          action.reason.trim(),
        "কারণ বা প্রয়োজনীয় তথ্য লিখুন।",
      )
      r.verification = action.status
      r.reviewNote = action.reason
      r.updatedAt = now
      break
    }
    case "clarify": {
      const r = s.requests.find(request => request.id === action.id)
      assert(r && r.trackingCode === action.code, "ট্র্যাকিং কোড মেলেনি।")
      assert(r.verification === "clarification", "এই আবেদনে এখন অতিরিক্ত তথ্য প্রয়োজন নেই।")
      assert(action.note.trim(), "পরিস্থিতির অতিরিক্ত তথ্য লিখুন।")
      r.note = `${r.note}\nঅতিরিক্ত তথ্য: ${action.note.trim()}`
      r.verification = "pending"
      r.updatedAt = now
      break
    }
    case "dispatch": {
      admin()
      const r = s.requests.find((r) => r.id === action.requestId),
        t = s.teams.find((t) => t.id === action.teamId)
      assert(r && t, "আবেদন বা দল পাওয়া যায়নি।")
      assert(r.verification === "verified", "দল নির্ধারণের আগে আবেদন যাচাই করুন।")
      assert(
        !s.missions.some(
          (m) => m.requestId === r.id && (active(m) || m.status === "done"),
        ),
        "আবেদনের সক্রিয় বা সম্পন্ন কার্যক্রম রয়েছে।",
      )
      assert(!eligibility(s, t, r).length, "দলটি এখন এই আবেদনের জন্য উপযুক্ত নয়।")
      s.missions.push({
        id: action.id,
        requestId: r.id,
        teamId: t.id,
        status: "assigned",
        createdAt: now,
        updatedAt: now,
        history: [
          { at: now, text: "সুপার অ্যাডমিন দল নির্ধারণ করেছেন", status: "assigned" },
        ],
      })
      r.updatedAt = now
      break
    }
    case "mission": {
      const m = s.missions.find((m) => m.id === action.id)
      assert(m, "কার্যক্রম পাওয়া যায়নি।")
      const t = s.teams.find((t) => t.id === m.teamId)!
      assert(canViewMission(s, m), "কার্যক্রমে প্রবেশাধিকার নেই।")
      assert(active(m), "সমাপ্ত কার্যক্রম পরিবর্তন করা যাবে না।")
      if (["cancelled", "failed"].includes(action.status)) {
        admin()
        assert(action.note.trim(), "কারণ লিখুন।")
      } else {
        assert(
          a?.role === "volunteer" && t.leaderId === a.volunteerId,
          "শুধু নির্ধারিত দলের নেতা এই কাজ করতে পারেন।",
        )
        const allowed: Record<string, string[]> = {
          assigned: ["acknowledged", "problem"],
          acknowledged: ["ongoing", "problem"],
          ongoing: ["ongoing", "done", "problem"],
          problem: [missionStage(m)],
        }
        assert(
          allowed[m.status]?.includes(action.status),
          "এই অবস্থা পরিবর্তন অনুমোদিত নয়।",
        )
        assert(
          !(
            ["done", "problem"].includes(action.status) ||
            m.status === action.status ||
            m.status === "problem"
          ) || action.note.trim(),
          "নোট লিখুন।",
        )
      }
      m.status = action.status
      m.updatedAt = now
      m.history.push({
        at: now,
        text: action.note.trim() || labels[action.status],
        status: action.status,
      })
      s.requests.find((r) => r.id === m.requestId)!.updatedAt = now
      break
    }
    case "supplier":
      admin()
      assert(
        action.record.name.trim() && action.record.contact.trim(),
        "সরবরাহকারীর তথ্য দিন।",
      )
      s.suppliers.push(action.record)
      break
    case "resource": {
      admin()
      const supplier = s.suppliers.find((x) => x.id === action.supplierId)
      assert(supplier, "সরবরাহকারী পাওয়া যায়নি।")
      assert(
        action.record.name.trim() &&
          Number.isFinite(action.record.qty) &&
          action.record.qty >= 0,
        "নাম ও সঠিক পরিমাণ দিন।",
      )
      supplier.res.push(action.record)
      break
    }
  }
  return s
}
