const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText
  module._compile(code, filename)
}
const {
  seed,
  transition,
  progress,
  eligibility,
  canViewMission,
  missionStage,
  active,
} = require("../src/app/model.ts")
const login = (s, id) => transition(s, { type: "login", id })
const freshRequest = (s) => ({
  ...s.requests[0],
  id: "test-request",
  trackingCode: "PRIVATE-DEMO",
  district: "সুনামগঞ্জ",
  upazila: "সুনামগঞ্জ সদর",
})
const profileImage = "data:image/png;base64,aGVsbG8="
test("volunteer profile images preserve existing records, ownership and removal", () => {
  let s = login(seed(), "a-v1")
  const id = s.accounts.find(a => a.id === "a-v1").volunteerId
  const volunteer = s.volunteers.find(v => v.id === id)
  assert.equal(volunteer.profileImage, undefined)
  s = transition(s, { type: "profile", record: { ...volunteer, profileImage } })
  assert.equal(JSON.parse(JSON.stringify(s)).volunteers.find(v => v.id === id).profileImage, profileImage)
  const other = s.volunteers.find(v => v.id !== id)
  assert.throws(() => transition(s, { type: "profile", record: { ...other, profileImage } }))
  s = transition(s, { type: "profile", record: { ...s.volunteers.find(v => v.id === id), profileImage: "" } })
  assert.equal(s.volunteers.find(v => v.id === id).profileImage, "")
})
test("organization profile images preserve system fields and owner permissions", () => {
  let s = login(seed(), "a-org1")
  const org = s.organizations.find(o => o.id === s.accounts.find(a => a.id === "a-org1").orgId)
  s = transition(s, { type: "orgProfile", record: { ...org, profileImage, verification: "rejected", adminId: "changed" } })
  const saved = JSON.parse(JSON.stringify(s)).organizations.find(o => o.id === org.id)
  assert.equal(saved.profileImage, profileImage)
  assert.equal(saved.verification, org.verification)
  assert.equal(saved.adminId, org.adminId)
  assert.throws(() => transition(login(s, "a-org2"), { type: "orgProfile", record: { ...saved, profileImage: "" } }))
  s = transition(s, { type: "orgProfile", record: { ...saved, profileImage: "" } })
  assert.equal(s.organizations.find(o => o.id === org.id).profileImage, "")
})
test("profile image validation rejects unsupported sources and oversized files", async () => {
  const { isProfileImage, prepareProfileImage, MAX_PROFILE_IMAGE_LENGTH } = require("../src/app/profile-image.ts")
  assert.equal(isProfileImage(undefined), true)
  assert.equal(isProfileImage(""), true)
  assert.equal(isProfileImage(profileImage), true)
  for (const image of [null, "https://example.org/photo.png", "data:image/svg+xml;base64,aGVsbG8=", "data:image/png;base64,??", "data:image/png;base64," + "a".repeat(MAX_PROFILE_IMAGE_LENGTH)]) {
    assert.equal(isProfileImage(image), false)
    const s = login(seed(), "a-v1")
    assert.throws(() => transition(s, { type: "profile", record: { ...s.volunteers[0], profileImage: image } }))
  }
  await assert.rejects(prepareProfileImage({ type: "image/svg+xml", size: 100 }), /JPG, PNG/)
  await assert.rejects(prepareProfileImage({ type: "image/png", size: 6 * 1024 * 1024 }), /৫ মেগাবাইট/)
})
test("language translations cover interface labels, lists, counts and bilingual area search", () => {
  const { translate, matchesSearch } = require("../src/app/locale.ts")
  assert.equal(translate("সাহায্যের আবেদন", "bn"), "সাহায্যের আবেদন")
  assert.equal(translate("সাহায্যের আবেদন", "en"), "Request help")
  assert.equal(translate("সুনামগঞ্জ সদর, সুনামগঞ্জ", "en"), "Sunamganj Sadar, Sunamganj")
  assert.equal(translate("খাদ্য, বিশুদ্ধ পানি", "en"), "Food, Clean water")
  assert.equal(translate("১২টি আবেদন", "en"), "12 requests")
  assert.equal(translate("সমস্যা জানানো হয়েছে", "en"), "Problem reported")
  assert.equal(matchesSearch("সুনামগঞ্জ সদর, সুনামগঞ্জ", "SUNAMGANJ"), true)
  assert.equal(matchesSearch("সুনামগঞ্জ সদর, সুনামগঞ্জ", "সুনামগঞ্জ"), true)
  assert.equal(matchesSearch("সুনামগঞ্জ সদর", "Dhaka"), false)
  const value = { name: "কাল্পনিক নাম" }
  assert.equal(translate(value, "en"), value)
  assert.equal(translate(undefined, "en"), undefined)
  assert.equal(translate("  নতুন\nলেখা  ", "en"), "  নতুন\nলেখা  ")
})
test("switching language publishes changes without changing demo records", () => {
  const { getLanguage, setLanguage, subscribeLanguage, translate } = require("../src/app/locale.ts")
  const state = seed()
  const before = JSON.stringify(state)
  let notifications = 0
  const unsubscribe = subscribeLanguage(() => notifications++)
  setLanguage("en")
  assert.equal(getLanguage(), "en")
  assert.equal(translate(progress(state, state.requests[0]), getLanguage()), "Awaiting verification")
  setLanguage("bn")
  assert.equal(getLanguage(), "bn")
  assert.equal(notifications, 2)
  assert.equal(JSON.stringify(state), before)
  unsubscribe()
})
test("clarification requires the simulated code and returns request to review", () => {
  let s = login(seed(), "a-admin")
  s = transition(s, { type: "review", id: s.requests[0].id, status: "clarification", reason: "পরিস্থিতি নিশ্চিত করুন" })
  s = login(s, null)
  assert.throws(() => transition(s, { type: "clarify", id: s.requests[0].id, code: "wrong", note: "কাল্পনিক তথ্য" }))
  s = transition(s, { type: "clarify", id: s.requests[0].id, code: s.requests[0].trackingCode, note: "অতিরিক্ত নমুনা তথ্য" })
  assert.equal(s.requests[0].verification, "pending")
  assert.match(s.requests[0].note, /অতিরিক্ত নমুনা তথ্য/)
})
test("public request → admin queue → verification → team dispatch → leader → completion", () => {
  let s = seed()
  const request = freshRequest(s)
  s = transition(s, { type: "request", record: request })
  assert.equal(s.requests.at(-1).verification, "pending")
  assert.throws(() =>
    transition(s, {
      type: "dispatch",
      requestId: request.id,
      teamId: "t2",
      id: "test-mission",
    }),
  )
  s = login(s, "a-admin")
  assert.throws(() =>
    transition(s, {
      type: "dispatch",
      requestId: request.id,
      teamId: "t2",
      id: "test-mission",
    }),
  )
  s = transition(s, {
    type: "review",
    id: request.id,
    status: "verified",
    reason: "নমুনা যাচাই",
  })
  assert.match(progress(s, s.requests.at(-1)), /দল নির্ধারণ/)
  assert.deepEqual(eligibility(s, s.teams[1], s.requests.at(-1)), [])
  s = transition(s, {
    type: "dispatch",
    requestId: request.id,
    teamId: "t2",
    id: "test-mission",
  })
  assert.throws(() =>
    transition(s, {
      type: "dispatch",
      requestId: request.id,
      teamId: "t2",
      id: "duplicate",
    }),
  )
  assert.throws(() =>
    transition(s, {
      type: "mission",
      id: "test-mission",
      status: "acknowledged",
      note: "",
    }),
  )
  s = login(s, "a-v5")
  assert.equal(canViewMission(s, s.missions.at(-1)), true)
  assert.throws(() =>
    transition(s, {
      type: "mission",
      id: "test-mission",
      status: "acknowledged",
      note: "",
    }),
  )
  s = login(s, "a-v4")
  s = transition(s, {
    type: "mission",
    id: "test-mission",
    status: "acknowledged",
    note: "",
  })
  s = transition(s, {
    type: "mission",
    id: "test-mission",
    status: "ongoing",
    note: "যাত্রা শুরু",
  })
  assert.throws(() =>
    transition(s, {
      type: "mission",
      id: "test-mission",
      status: "done",
      note: "",
    }),
  )
  s = transition(s, {
    type: "mission",
    id: "test-mission",
    status: "problem",
    note: "সড়ক বন্ধ",
  })
  s = transition(s, {
    type: "mission",
    id: "test-mission",
    status: "ongoing",
    note: "সমাধান হয়েছে",
  })
  s = transition(s, {
    type: "mission",
    id: "test-mission",
    status: "done",
    note: "বিতরণ সম্পন্ন",
  })
  assert.equal(active(s.missions.at(-1)), false)
  assert.match(progress(s, s.requests.at(-1)), /সম্পন্ন/)
  assert.equal(s.missions.at(-1).history.length, 6)
  s = login(s, "a-admin")
  assert.throws(() =>
    transition(s, {
      type: "dispatch",
      requestId: request.id,
      teamId: "t2",
      id: "duplicate-complete",
    }),
  )
})
test("organization registration ownership, pending access, approval and shared profile", () => {
  let s = seed()
  const org = {
    ...s.organizations[0],
    id: "test-org",
    adminId: "test-account",
    name: "Test organization",
  }
  s = transition(s, {
    type: "registerOrg",
    record: org,
    account: {
      id: "test-account",
      role: "org",
      orgId: "test-org",
      name: "Demo admin",
    },
  })
  assert.equal(s.organizations.at(-1).verification, "pending")
  assert.throws(() =>
    transition(s, {
      type: "team",
      record: { ...s.teams[1], id: "new-team", orgId: org.id },
    }),
  )
  s = login(s, "a-admin")
  s = transition(s, {
    type: "verifyOrg",
    id: org.id,
    status: "verified",
    reason: "",
  })
  s = login(s, "test-account")
  s = transition(s, {
    type: "orgProfile",
    record: {
      ...s.organizations.at(-1),
      name: "Updated",
      verification: "rejected",
    },
  })
  assert.equal(s.organizations.at(-1).verification, "verified")
  assert.equal(s.organizations.at(-1).name, "Updated")
  assert.throws(() =>
    transition(s, { type: "orgProfile", record: s.organizations[0] }),
  )
})
test("registration → one membership request → approval → small team → leader", () => {
  let s = seed()
  const v = { ...s.volunteers[0], id: "new-v", name: "Demo newcomer" }
  s = transition(s, {
    type: "registerVolunteer",
    volunteer: v,
    account: {
      id: "new-a",
      role: "volunteer",
      name: v.name,
      volunteerId: v.id,
    },
    orgId: "o1",
    membershipId: "new-mb",
  })
  assert.equal(s.memberships.at(-1).status, "pending")
  assert.throws(() =>
    transition(s, {
      type: "join",
      record: { ...s.memberships.at(-1), id: "duplicate" },
    }),
  )
  assert.throws(() =>
    transition(s, {
      type: "membership",
      id: "new-mb",
      status: "approved",
      reason: "",
    }),
  )
  s = login(s, "a-org1")
  s = transition(s, {
    type: "membership",
    id: "new-mb",
    status: "approved",
    reason: "",
  })
  const t = { ...s.teams[1], id: "new-t", memberIds: [v.id], leaderId: v.id }
  s = transition(s, { type: "team", record: t })
  assert.equal(s.teams.at(-1).memberIds[0], v.id)
  assert.throws(() =>
    transition(s, { type: "team", record: { ...t, id: "conflict-t" } }),
  )
  s = login(s, "new-a")
  s = transition(s, {
    type: "profile",
    record: { ...v, name: "Updated volunteer" },
  })
  assert.equal(
    s.accounts.find((a) => a.id === "new-a").name,
    "Updated volunteer",
  )
  assert.throws(() =>
    transition(s, { type: "profile", record: s.volunteers[0] }),
  )
})
test("mission ownership, locked active roster, reassignment history and no unrelated access", () => {
  let s = login(seed(), "a-org2")
  assert.equal(canViewMission(s, s.missions[0]), false)
  s = login(s, "a-v4")
  assert.equal(canViewMission(s, s.missions[0]), false)
  s = login(s, "a-org1")
  assert.throws(() =>
    transition(s, { type: "team", record: { ...s.teams[0], name: "Locked" } }),
  )
  s = login(s, "a-admin")
  s = transition(s, {
    type: "mission",
    id: "M-0411",
    status: "cancelled",
    note: "পুনর্বণ্টনের জন্য",
  })
  assert.equal(missionStage(s.missions.find(m => m.id === "M-0411")), "ongoing")
  s = transition(s, {
    type: "dispatch",
    requestId: "SH-24-0411",
    teamId: "t1",
    id: "replacement",
  })
  assert.equal(s.missions.filter((m) => m.requestId === "SH-24-0411").length, 2)
  assert.equal(s.missions.find((m) => m.id === "M-0411").status, "cancelled")
})
test("rejected membership reason, reapplication, supplier/resource persistence shape", () => {
  let s = login(seed(), "a-org1")
  assert.throws(() =>
    transition(s, {
      type: "membership",
      id: "mb-v3",
      status: "rejected",
      reason: "",
    }),
  )
  s = transition(s, {
    type: "membership",
    id: "mb-v3",
    status: "rejected",
    reason: "এলাকা পুনরায় নিশ্চিত করুন",
  })
  s = login(s, "a-v3")
  s = transition(s, {
    type: "join",
    record: {
      id: "retry",
      volunteerId: "v3",
      orgId: "o1",
      status: "pending",
      reason: "",
      updatedAt: "",
    },
  })
  s = login(s, "a-admin")
  s = transition(s, {
    type: "supplier",
    record: {
      id: "test-s",
      name: "Demo supplier",
      cat: "খাদ্য",
      contact: "কাল্পনিক",
      place: "ঢাকা",
      verified: false,
      res: [],
    },
  })
  s = transition(s, {
    type: "resource",
    supplierId: "test-s",
    record: { id: "r", name: "Demo resource", cat: "খাদ্য", qty: 2, note: "" },
  })
  assert.equal(JSON.parse(JSON.stringify(s)).suppliers.at(-1).res[0].qty, 2)
  assert.equal(JSON.stringify(s).includes("password"), false)
})

test("problem recovery returns to the previous stage without bypassing acknowledgement", () => {
  for (const stage of ["assigned", "acknowledged", "ongoing"]) {
    let s = login(seed(), "a-admin")
    s = transition(s, { type: "review", id: "SH-24-0412", status: "verified", reason: "" })
    s = transition(s, { type: "dispatch", requestId: "SH-24-0412", teamId: "t2", id: "recovery-test" })
    s = login(s, "a-v4")
    if (stage !== "assigned") {
      s = transition(s, { type: "mission", id: "recovery-test", status: "acknowledged", note: "" })
    }
    if (stage === "ongoing") {
      s = transition(s, { type: "mission", id: "recovery-test", status: "ongoing", note: "" })
    }
    s = transition(s, { type: "mission", id: "recovery-test", status: "problem", note: "সড়ক বন্ধ" })
    assert.equal(missionStage(s.missions.at(-1)), stage)
    for (const skipped of ["assigned", "acknowledged", "ongoing", "done"].filter(value => value !== stage)) {
      assert.throws(() => transition(s, { type: "mission", id: "recovery-test", status: skipped, note: "সমাধান" }))
    }
    assert.throws(() => transition(s, { type: "mission", id: "recovery-test", status: stage, note: "" }))
    s = transition(s, { type: "mission", id: "recovery-test", status: stage, note: "পথ খুলেছে" })
    assert.equal(s.missions.at(-1).status, stage)
  }
})

test("organization area edits cannot orphan existing team operating areas", () => {
  let s = login(seed(), "a-org1")
  const org = s.organizations[0]
  assert.throws(() => transition(s, {
    type: "orgProfile",
    record: { ...org, areas: org.areas.filter(area => area !== "কুড়িগ্রাম") },
  }), /আগে দলটির/)
  assert.ok(s.organizations[0].areas.includes("কুড়িগ্রাম"))
  s = transition(s, { type: "orgProfile", record: { ...org, areas: [...org.areas, "ঢাকা"] } })
  assert.ok(s.organizations[0].areas.includes("ঢাকা"))
})
