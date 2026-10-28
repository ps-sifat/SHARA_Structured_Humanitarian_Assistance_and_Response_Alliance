// Optional browser suite: point PLAYWRIGHT_MODULE at an installed Playwright package.
// Uses only the host-supervised preview; never starts a development server.
const assert = require("node:assert/strict")
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright")
const base = process.env.SHARA_PREVIEW_URL || "http://localhost:3000"
;(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  })
  const page = await context.newPage()
  const runtimeErrors = []
  page.on("pageerror", (error) => runtimeErrors.push(error.message))
  const go = async (path) => {
    await page.goto(`${base}/#${path}`)
    await page.waitForTimeout(100)
  }
  const state = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("shara-demo-v1")))
  const login = async (id) => {
    await go("/login")
    await page.locator("#demo-account").selectOption(id)
    await page
      .getByRole("button", { name: "প্রবেশ করুন", exact: true })
      .click()
  }
  const confirm = async () =>
    page
      .getByRole("dialog")
      .getByRole("button", { name: "নিশ্চিত করুন", exact: true })
      .click()
  const check = async (name) => {
    const control = page.getByRole("checkbox", { name, exact: true })
    await control.locator("..").click()
  }
  try {
    await go("/")
    await page.evaluate(() => localStorage.removeItem("shara-demo-v1"))
    await page.reload()
    await go("/map")
    await page.getByRole("textbox", { name: "জেলা বা উপজেলা খুঁজুন" }).fill("সুনামগঞ্জ")
    await page
      .getByRole("button", { name: /সুনামগঞ্জ সদর/ })
      .first()
      .click()
    await page.getByRole("link", { name: "এই এলাকায় সাহায্যের আবেদন" }).click()
    assert.match(await page.locator("#district").innerText(), /সুনামগঞ্জ/)
    assert.match(await page.locator("#upazila").innerText(), /সুনামগঞ্জ সদর/)
    await page.locator("#people").fill("3")
    await check("খাদ্য")
    await page.locator("#phone").fill("01700000000")
    await page.getByRole("button", { name: "আবেদন পাঠান", exact: true }).click()
    const request = (await state()).requests.at(-1)
    assert.equal(request.verification, "pending")
    await page
      .locator("main")
      .getByRole("link", { name: "আবেদন ট্র্যাক করুন", exact: true })
      .click()
    await page.locator("#track-code").fill(request.trackingCode)
    await page.getByRole("button", { name: "অগ্রগতি দেখুন", exact: true }).click()
    assert.equal(
      await page
        .locator("main")
        .innerText()
        .then((text) => text.includes(request.phone)),
      false,
    )
    await login("a-admin")
    await go(`/admin/requests?q=${request.id}`)
    await page
      .getByRole("link", { name: "পর্যালোচনা ও দল নির্ধারণ", exact: true })
      .click()
    await page.getByRole("button", { name: "স্পষ্টকরণ চাই", exact: true }).click()
    await page.locator("#review-reason").fill("পরিস্থিতির অতিরিক্ত তথ্য দিন")
    await confirm()
    await go(`/track?ref=${request.id}`)
    await page.locator("#track-code").fill(request.trackingCode)
    await page.getByRole("button", { name: "অগ্রগতি দেখুন", exact: true }).click()
    await page.locator("#tracking-additional").fill("কাল্পনিক অতিরিক্ত পরিস্থিতি")
    await page.getByRole("button", { name: "অতিরিক্ত তথ্য জমা দিন", exact: true }).click()
    assert.match(await page.locator("main").innerText(), /অতিরিক্ত তথ্য জমা হয়েছে/)
    await page.locator("#track-reference").fill("SH-24-0412")
    assert.equal(await page.getByText("অতিরিক্ত তথ্য জমা হয়েছে; আবেদন আবার পর্যালোচনার অপেক্ষায়।", { exact: true }).count(), 0)
    await go(`/admin/requests/${request.id}?queue=q%3D${request.id}`)
    await page.getByRole("button", { name: "যাচাইকৃত করুন", exact: true }).click()
    await confirm()
    await page
      .getByRole("button", { name: "এই দল নির্ধারণ করুন", exact: true })
      .filter({ visible: true })
      .first()
      .click()
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "বরাদ্দ নিশ্চিত করুন", exact: true })
      .click()
    const mission = (await state()).missions.at(-1)
    assert.equal(mission.requestId, request.id)
    assert.equal(mission.teamId, "t2")
    await page.getByRole("link", { name: "আবেদনের তালিকায় ফিরুন" }).click()
    assert.match(page.url(), /q=/)
    await login("a-v1")
    await go(`/volunteer/missions/${mission.id}`)
    assert.match(await page.locator("main").innerText(), /প্রবেশাধিকার নেই/)
    await login("a-v5")
    await go(`/volunteer/missions/${mission.id}`)
    assert.equal(
      await page.getByRole("button", { name: "দলের পক্ষে স্বীকৃতি দিন" }).count(),
      0,
    )
    await login("a-org1")
    await go(`/org/missions/${mission.id}`)
    assert.equal(
      await page.getByRole("button", { name: "দলের পক্ষে স্বীকৃতি দিন" }).count(),
      0,
    )
    await login("a-v4")
    await go(`/volunteer/missions/${mission.id}`)
    await page.getByRole("button", { name: "সমস্যা জানান", exact: true }).click()
    await page.locator("#mission-note").fill("নমুনা পথ বন্ধ")
    await confirm()
    assert.equal(await page.getByRole("button", { name: "কার্যক্রম শুরু করুন", exact: true }).count(), 0)
    await page.getByRole("button", { name: "সমস্যা সমাধান হয়েছে — আগের ধাপে ফিরুন", exact: true }).click()
    await page.locator("#mission-note").fill("নমুনা সমস্যা সমাধান হয়েছে")
    await confirm()
    assert.equal((await state()).missions.at(-1).status, "assigned")
    await page.getByRole("button", { name: "দলের পক্ষে স্বীকৃতি দিন" }).click()
    await confirm()
    await page
      .getByRole("button", { name: "কার্যক্রম শুরু করুন", exact: true })
      .click()
    await confirm()
    await page
      .getByRole("button", { name: "সম্পন্ন চিহ্নিত করুন", exact: true })
      .click()
    await page.locator("#mission-note").fill("ডেমো খাদ্য বিতরণ সম্পন্ন")
    await confirm()
    await page.reload()
    assert.equal((await state()).missions.at(-1).status, "done")
    await go(`/track?ref=${request.id}`)
    await page.locator("#track-code").fill(request.trackingCode)
    await page.getByRole("button", { name: "অগ্রগতি দেখুন", exact: true }).click()
    assert.match(await page.locator("main").innerText(), /সহায়তা সম্পন্ন/)
    console.log(
      "PASS public request, map prefill, tracking, dispatch, leader/member guards, mission completion and persistence",
    )

    await go("/organization/register")
    const registrationImage = {
      name: "profile.png",
      mimeType: "image/png",
      buffer: Buffer.from(await page.evaluate(() => {
        const canvas = document.createElement("canvas")
        canvas.width = canvas.height = 640
        const ctx = canvas.getContext("2d")
        ctx.fillStyle = "#2e6b4f"
        ctx.fillRect(0, 0, 640, 640)
        return canvas.toDataURL("image/png").split(",")[1]
      }), "base64"),
    }
    await page.getByLabel("সংগঠনের ছবি বেছে নিন", { exact: true }).setInputFiles(registrationImage)
    await page.getByRole("button", { name: "ছবি পরিবর্তন করুন", exact: true }).waitFor()
    await page.locator("#organization-admin").fill("ডেমো সংগঠন প্রশাসক")
    await page.locator("#organization-name").fill("পরীক্ষা মানবিক সংগঠন")
    await page.locator("#organization-type").selectOption("community")
    await page.locator("#organization-description").fill("শুধু কাল্পনিক পরীক্ষার জন্য")
    await page.locator("#organization-email").fill("demo@example.org")
    await page.locator("#organization-phone").fill("01700000000")
    await check("সুনামগঞ্জ")
    await page.locator("#location-district").click()
    await page.getByRole("button", { name: "সুনামগঞ্জ", exact: true }).click()
    await check("সুনামগঞ্জ সদর")
    await page.getByRole("button", { name: "নিবন্ধনের আবেদন জমা দিন" }).click()
    const org = (await state()).organizations.at(-1)
    assert.match(org.profileImage, /^data:image\/(?:webp|png);base64,/)
    await page.getByRole("link", { name: "নিবন্ধনের অবস্থা দেখুন" }).click()
    await go("/org/")
    assert.equal(await page.locator("h1").innerText(), org.name)
    await go("/org/teams/new")
    assert.equal(await page.locator("#team-name").count(), 0)
    await login("a-admin")
    await go("/admin/organizations")
    await page
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: org.name, exact: true }),
      })
      .getByRole("button", { name: "বিস্তারিত ও যাচাই" })
      .click()
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "যাচাই নিশ্চিত করুন" })
      .click()
    assert.equal((await state()).organizations.at(-1).verification, "verified")
    console.log(
      "PASS organization registration, owner account, pending permissions and verification",
    )

    await go("/volunteer/register")
    await page.getByLabel("প্রোফাইল ছবি বেছে নিন", { exact: true }).setInputFiles(registrationImage)
    await page.getByRole("button", { name: "ছবি পরিবর্তন করুন", exact: true }).waitFor()
    await page.locator("#v-name").fill("পরীক্ষা স্বেচ্ছাসেবক")
    await page.locator("#v-phone").fill("01700000000")
    await page.locator("#v-org").selectOption(org.id)
    await page.locator("#v-district").selectOption({ label: "সুনামগঞ্জ" })
    await page.locator("#v-upazila").selectOption({ label: "সুনামগঞ্জ সদর" })
    await check("সুনামগঞ্জ সদর")
    await check("প্রাথমিক চিকিৎসা")
    await page.getByRole("button", { name: "নিবন্ধন সম্পন্ন করুন" }).click()
    const volunteer = (await state()).volunteers.at(-1)
    assert.match(volunteer.profileImage, /^data:image\/(?:webp|png);base64,/)
    const volunteerAccount = (await state()).accounts.find(
      (a) => a.volunteerId === volunteer.id,
    )
    assert.match(
      await page.locator("main").innerText(),
      /সদস্যপদ অনুমোদনের অপেক্ষায়/,
    )
    await go("/volunteer/teams")
    assert.match(page.url(), /volunteer\/organizations/)
    assert.equal(
      await page
        .getByRole("button", { name: "সদস্যপদের অনুরোধ পাঠান", exact: true })
        .isEnabled(),
      false,
    )
    await login(org.adminId)
    await go("/org/memberships")
    await page.getByRole("button", { name: "অনুমোদন", exact: true }).click()
    await confirm()
    await go("/org/teams/new")
    await page.locator("#team-name").fill("পরীক্ষা ছোট দল")
    await check("সুনামগঞ্জ")
    await check(`${volunteer.name} — ${volunteer.id}`)
    await page.locator("#team-leader").selectOption(volunteer.id)
    await check("খাদ্য")
    await page.getByRole("button", { name: "দল সংরক্ষণ", exact: true }).click()
    await login(volunteerAccount.id)
    await go("/volunteer/team")
    assert.match(await page.locator("main").innerText(), /পরীক্ষা ছোট দল/)
    await go("/volunteer/profile/edit")
    await page.locator("#v-name").fill("হালনাগাদ ডেমো স্বেচ্ছাসেবক")
    await page
      .getByRole("button", { name: "পরিবর্তন সংরক্ষণ", exact: true })
      .click()
    await go("/volunteer")
    assert.match(await page.locator("h1").innerText(), /হালনাগাদ ডেমো/)
    await go("/volunteer/requests")
    assert.equal(
      await page.getByRole("button", { name: /আবেদনটি গ্রহণ/ }).count(),
      0,
    )
    const summaryTrigger = page.getByRole("button", { name: "সারসংক্ষেপ দেখুন", exact: true }).last()
    await summaryTrigger.click()
    const summaryDialog = page.getByRole("dialog", { name: "নিরাপদ আবেদন সারসংক্ষেপ" })
    await summaryDialog.waitFor({ state: "visible" })
    assert.equal(await summaryDialog.count(), 1)
    assert.equal(await page.getByRole("dialog").innerText().then(text => text.includes(request.phone)), false)
    await page.keyboard.press("Escape")
    await summaryDialog.waitFor({ state: "hidden" })
    assert.equal(await summaryTrigger.evaluate(el => el === document.activeElement), true)
    console.log(
      "PASS volunteer registration, pending membership, approval, team assignment, legacy redirect and shared profile",
    )

    await login("a-admin")
    await go("/admin/suppliers")
    await page
      .getByRole("button", { name: "সরবরাহকারী যোগ করুন", exact: true })
      .click()
    await page.locator("#s-name").fill("পরীক্ষা সরবরাহকারী")
    await page.locator("#s-place").fill("সুনামগঞ্জ")
    await page.locator("#s-contact").fill("কাল্পনিক")
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "সংরক্ষণ", exact: true })
      .click()
    await page
      .getByRole("button", { name: "সম্পদ যোগ করুন", exact: true })
      .click()
    await page.locator("#s-name").fill("চাল নমুনা")
    await page.locator("#r-quantity").fill("10")
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "সংরক্ষণ", exact: true })
      .click()
    await page.reload()
    assert.equal((await state()).suppliers.at(-1).res[0].qty, 10)
    console.log("PASS supplier and resource forms and refresh persistence")

    await page.setViewportSize({ width: 390, height: 844 })
    await go("/")
    const trigger = page.getByRole("button", { name: "প্রধান মেনু খুলুন" })
    await trigger.click()
    const dialog = page.getByRole("dialog"),
      bounds = await dialog.boundingBox()
    assert.equal(await dialog.getByRole("link", { name: "সাহায্যের আবেদন", exact: true }).count(), 1)
    assert.ok(
      bounds.height > 200 && bounds.y >= 0 && bounds.y + bounds.height <= 844,
    )
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab")
      assert.equal(
        await page.evaluate(() =>
          document.querySelector("dialog").contains(document.activeElement),
        ),
        true,
      )
    }
    await page.screenshot({
      path: "/tmp/shara-mobile-menu.png",
      fullPage: false,
    })
    await page.keyboard.press("Escape")
    assert.equal(await dialog.count(), 0)
    assert.equal(
      await trigger.evaluate((el) => el === document.activeElement),
      true,
    )
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    )
    await go("/admin/requests")
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    )
    await page.screenshot({
      path: "/tmp/shara-mobile-requests.png",
      fullPage: true,
    })
    assert.deepEqual(runtimeErrors, [])
    console.log(
      "PASS mobile layout, full-height menu, focus trap/return, Escape, no runtime errors",
    )
    await require("./language-browser.cjs")({ browser, base })
    await require("./profile-images-browser.cjs")({ browser, base })
  } finally {
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
