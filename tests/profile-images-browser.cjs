const assert = require("node:assert/strict")

module.exports = async function profileImageFlows({ browser, base }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
  await context.addInitScript(() => localStorage.setItem("shara-language", "en"))
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", error => errors.push(error.message))
  const go = async path => {
    await page.goto(`${base}/#${path}`)
    await page.locator("main").waitFor()
  }
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("shara-demo-v1")))
  const login = async id => {
    await go("/login")
    await page.locator("#demo-account").selectOption(id)
    await page.getByRole("button", { name: "Continue", exact: true }).click()
  }
  const chooseImage = async (label, color) => {
    const data = await page.evaluate(color => {
      const canvas = document.createElement("canvas")
      canvas.width = 640
      canvas.height = 480
      const ctx = canvas.getContext("2d")
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 640, 480)
      return canvas.toDataURL("image/png").split(",")[1]
    }, color)
    await page.getByLabel(label, { exact: true }).setInputFiles({
      name: "profile.png", mimeType: "image/png", buffer: Buffer.from(data, "base64"),
    })
    await page.getByRole("button", { name: "Change image", exact: true }).waitFor()
    await page.waitForFunction(() => {
      const image = document.querySelector("form img")
      return image?.complete && image.naturalWidth > 0
    })
  }
  try {
    await login("a-v1")
    await go("/volunteer/profile/edit")
    await page.getByLabel("Choose a profile image", { exact: true }).setInputFiles({
      name: "not-an-image.txt", mimeType: "text/plain", buffer: Buffer.from("not an image"),
    })
    await page.getByText("Choose a JPG, PNG or WebP image.", { exact: true }).waitFor()
    await chooseImage("Choose a profile image", "#12372a")
    assert.equal((await state()).volunteers.find(v => v.id === "v1").profileImage, undefined)
    await page.getByRole("button", { name: "Save changes", exact: true }).click()
    const first = (await state()).volunteers.find(v => v.id === "v1").profileImage
    assert.match(first, /^data:image\/(?:webp|png);base64,/)
    assert.ok(first.length <= 180000)
    await page.reload()
    await page.getByRole("button", { name: "Change image", exact: true }).waitFor()
    assert.equal(await page.locator("form img").getAttribute("src"), first)
    await chooseImage("Choose a profile image", "#2e6b4f")
    await page.getByRole("button", { name: "Save changes", exact: true }).click()
    const second = (await state()).volunteers.find(v => v.id === "v1").profileImage
    assert.notEqual(second, first)
    await page.getByRole("button", { name: "Remove image", exact: true }).click()
    await page.getByRole("link", { name: "Cancel", exact: true }).click()
    await page.waitForURL(/#\/volunteer$/)
    assert.equal((await state()).volunteers.find(v => v.id === "v1").profileImage, second)
    assert.equal(await page.locator("main img").getAttribute("src"), second)
    await go("/volunteer/profile/edit")
    await page.getByRole("button", { name: "Remove image", exact: true }).click()
    await page.getByRole("button", { name: "Save changes", exact: true }).click()
    await page.reload()
    await page.getByRole("button", { name: "Add image", exact: true }).waitFor()
    assert.equal((await state()).volunteers.find(v => v.id === "v1").profileImage, "")

    await login("a-org1")
    await go("/org/profile")
    await page.getByRole("button", { name: "Edit profile", exact: true }).click()
    await chooseImage("Choose an organization image", "#12372a")
    await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click()
    const orgImage = (await state()).organizations.find(o => o.id === "o1").profileImage
    assert.match(orgImage, /^data:image\/(?:webp|png);base64,/)
    await page.reload()
    await page.locator("main img").waitFor()
    assert.equal(await page.locator("main img").getAttribute("src"), orgImage)
    await page.getByRole("button", { name: "Edit profile", exact: true }).click()
    await page.getByRole("button", { name: "Remove image", exact: true }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click()
    assert.equal(await page.locator("main img").getAttribute("src"), orgImage)
    await page.getByRole("button", { name: "Edit profile", exact: true }).click()
    await chooseImage("Choose an organization image", "#2e6b4f")
    await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click()
    assert.notEqual((await state()).organizations.find(o => o.id === "o1").profileImage, orgImage)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole("button", { name: "Edit profile", exact: true }).click()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    await page.getByRole("button", { name: "Remove image", exact: true }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click()
    await page.reload()
    assert.equal((await state()).organizations.find(o => o.id === "o1").profileImage, "")
    assert.deepEqual(errors, [])
    console.log("PASS volunteer/organization image selection, previews, replacement, saved removal, cancellation, validation, refresh persistence and mobile layout")
  } finally {
    await context.close()
  }
}
