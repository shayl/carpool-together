import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "playwright";

const baseURL = process.env.PREVIEW_URL || "http://localhost:3100/preview";
const beforeHeights = { 360: 369.96875, 390: 346.171875, 1280: 266.984375 };

async function run() {
  const browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    headless: true,
  });
  const results = [];
  const backendRequests = [];
  const errors = [];
  try {
    for (const width of [360, 390, 1280]) {
      for (const locale of ["en", "he"]) {
        for (const theme of ["light", "dark"]) {
          const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: true });
          await context.addInitScript(({ locale, theme }) => {
            localStorage.setItem("carpool-locale", locale);
            localStorage.setItem("carpool-theme", theme);
          }, { locale, theme });
          const page = await context.newPage();
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
          page.on("request", (request) => {
            if (/\/api\/|supabase|[?&]_rsc=/.test(request.url())) backendRequests.push(request.url());
          });
          await page.goto(baseURL, { waitUntil: "networkidle" });
          const event = page.locator(".weekly-event").first();
          const header = event.locator(".weekly-event-summary");
          await header.waitFor();
          const url = page.url();
          const group = await page.getByRole("combobox").inputValue();
          const id = await header.getAttribute("aria-controls");
          assert.ok(id);
          assert.equal(await page.evaluate((id) => document.getElementById(id)?.hidden, id), true);
          assert.equal(await header.getAttribute("aria-expanded"), "false");
          assert.equal(await event.getByRole("button").count(), 1, "Only the header is interactive when collapsed");
          assert.equal(await event.locator(".ride-leg-panel, .member-avatar-row, .event-card-actions, address").count(), 0);
          assert.doesNotMatch(await event.innerText(), /Jamie Lee|Sam Morgan|I'll drive|Change plans/);
          assert.equal(await event.locator(".ride-status-car-happy").count(), 0, "Partial coverage cannot show a happy car");
          const box = await event.boundingBox();
          const headerBox = await header.boundingBox();
          assert.ok(box.height <= 130, `Standard ${width}/${locale}/${theme} header must be <=130px, got ${box.height}`);
          assert.ok(headerBox.height >= 44);
          assert.ok(await event.locator(".next-up-label").count());
          assert.ok(await event.locator(".next-up-label").evaluate((element) => element.getBoundingClientRect().height <= 30));
          const car = await event.locator(".ride-status-car").boundingBox();
          const carStyle = await event.locator(".ride-status-car").evaluate((element) => ({
            width: getComputedStyle(element).width, height: getComputedStyle(element).height,
          }));
          assert.deepEqual(carStyle, { width: "32px", height: "28px" });
          assert.ok(car.width <= 34 && car.height <= 30, "Tiny car stays compact even with its mood tilt");
          assert.match(await event.locator(".event-time").innerText(), /\d{2}:\d{2} – \d{2}:\d{2}/);
          assert.equal(await page.evaluate(() => document.documentElement.dir), locale === "he" ? "rtl" : "ltr");
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          assert.match(await page.locator("footer").innerText(), /v0\.6\.3/);
          assert.ok(await page.locator(".refresh-schedule-button").count());

          const capture = process.env.COMPACT_SCREENSHOT_DIR &&
            ((width === 390 && locale === "en" && theme === "light") ||
             (width === 360 && locale === "he" && theme === "dark") ||
             (width === 1280 && locale === "en" && theme === "light"));
          const suffix = `${width}-${locale}-${theme}`;
          if (capture) {
            await event.screenshot({ path: path.join(process.env.COMPACT_SCREENSHOT_DIR, `together-header-only-collapsed-${suffix}.png`), animations: "disabled" });
            await page.screenshot({ path: path.join(process.env.COMPACT_SCREENSHOT_DIR, `together-header-only-page-${suffix}.png`), fullPage: true, animations: "disabled" });
          }
          await header.focus();
          await page.keyboard.press("Enter");
          await event.locator(".weekly-event-details").waitFor();
          assert.equal(await header.getAttribute("aria-expanded"), "true");
          assert.equal(await page.evaluate((id) => document.getElementById(id)?.hidden, id), false);
          assert.equal(await header.evaluate((element) => element === document.activeElement), true);
          assert.equal(page.url(), url);
          assert.equal(await page.getByRole("combobox").inputValue(), group);
          assert.equal(await event.locator(".ride-leg-panel").count(), 2);
          assert.match(await event.locator(".ride-leg-panel").first().innerText(), /Jamie Lee/);
          const home = event.locator(".ride-leg-panel").nth(1);
          assert.equal(await home.locator(".claim-row strong").count(), 0);
          assert.ok(await event.locator(".event-card-actions").count());
          assert.ok(await event.locator(".member-avatar-row").count());
          assert.equal(await event.locator(".pickup-details").count(), 2);
          const controls = await event.locator("button, summary").evaluateAll((elements) =>
            elements.filter((element) => element.getClientRects().length > 0).map((element) => ({
              text: element.textContent.trim(), height: element.getBoundingClientRect().height,
            })),
          );
          assert.ok(controls.every((control) => control.height >= 44), JSON.stringify(controls));
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          if (capture) {
            await page.locator("#main-content").focus();
            await event.screenshot({ path: path.join(process.env.COMPACT_SCREENSHOT_DIR, `together-header-only-expanded-${suffix}.png`), animations: "disabled" });
            await header.focus();
          }

          await page.keyboard.press("Space");
          assert.equal(await header.getAttribute("aria-expanded"), "false");
          assert.equal(await header.evaluate((element) => element === document.activeElement), true);
          await page.keyboard.press("Enter");
          const hide = event.locator(".event-hide-details");
          await hide.click();
          assert.equal(await header.getAttribute("aria-expanded"), "false");
          assert.equal(await header.evaluate((element) => element === document.activeElement), true, "Hide details returns header focus");
          assert.equal(await header.getAttribute("aria-controls"), id);
          assert.equal(await event.getByRole("button").count(), 1);
          results.push({ width, locale, theme, beforeHeight: beforeHeights[width], afterHeight: box.height, reductionPercent: Math.round((1 - box.height / beforeHeights[width]) * 100) });

          if (width === 390 && locale === "en" && theme === "light") {
            await header.click();
            await home.getByRole("button", { name: "I'll drive", exact: true }).click();
            await home.getByText("Sam Morgan", { exact: true }).waitFor();
            assert.doesNotMatch(await home.innerText(), /Alex Morgan/);
            assert.equal(await event.locator(".ride-status-car-happy").count(), 1, "Both directions claimed means covered");
            page.once("dialog", (dialog) => dialog.dismiss());
            await home.getByRole("button", { name: "Release ride", exact: true }).click();
            assert.match(await home.innerText(), /Sam Morgan/);
            page.once("dialog", (dialog) => dialog.accept());
            await home.getByRole("button", { name: "Release ride", exact: true }).click();
            await home.getByRole("button", { name: "I'll drive", exact: true }).waitFor();
            assert.equal(await event.locator(".ride-status-car-happy").count(), 0);
            await home.getByRole("button", { name: "Choose another driver", exact: true }).click();
            const picker = page.getByRole("dialog");
            await picker.getByRole("combobox").selectOption("alex");
            await picker.getByRole("button", { name: "Assign driver", exact: true }).click();
            await picker.waitFor({ state: "hidden" });
            await home.getByText("Alex Morgan", { exact: true }).waitFor();
            await event.getByRole("button", { name: "Change ride status for Riley Morgan", exact: true }).click();
            const plans = page.getByRole("dialog");
            await plans.getByRole("checkbox", { name: /^Needs ride there/ }).uncheck();
            assert.equal(await plans.getByRole("checkbox", { name: /^Needs ride home/ }).isChecked(), true);
            await plans.getByRole("button", { name: "Save plans", exact: true }).click();
            await plans.waitFor({ state: "hidden" });
            await event.getByRole("button", { name: "Change plans", exact: true }).click();
            await page.getByRole("dialog").getByRole("button", { name: /Riley Morgan/ }).click();
            await page.getByRole("dialog").getByRole("checkbox", { name: /^Needs ride there/ }).waitFor();
            assert.equal(await page.getByRole("dialog").getByRole("checkbox", { name: /^Needs ride there/ }).isChecked(), false);
            assert.equal(await page.getByRole("dialog").getByRole("checkbox", { name: /^Needs ride home/ }).isChecked(), true);
            await page.getByRole("dialog").getByRole("button", { name: /Close Ride status/ }).click();
            await event.locator(".pickup-details").first().locator("summary").click();
            assert.ok(await event.locator("address").first().isVisible());
            await hide.click();
            assert.equal(await event.getByRole("button").count(), 1, "All actions disappear again on collapse");
            assert.doesNotMatch(await event.innerText(), /Alex Morgan|Jamie Lee/);
            await page.getByRole("button", { name: "We're driving", exact: true }).click();
            const filterURL = page.url();
            await header.click();
            await hide.click();
            assert.equal(page.url(), filterURL);
            assert.equal(await page.getByRole("button", { name: "We're driving", exact: true }).getAttribute("aria-pressed"), "true");
            await page.getByRole("button", { name: "All", exact: true }).click();
            await page.locator(".earlier-events > summary").click();
            const earlier = page.locator(".earlier-events-list .weekly-event").first();
            assert.equal(await earlier.getByRole("button").count(), 1);
            assert.equal(await earlier.locator(".weekly-event-summary").getAttribute("aria-expanded"), "false");
            await page.getByRole("button", { name: "Open month view", exact: true }).click();
            await page.locator(".month-event").first().click();
            const calendarSelection = page.locator('.weekly-event-summary[aria-expanded="true"]');
            assert.equal(await calendarSelection.count(), 1, "Explicit month selection may intentionally expand one event");
          }

          await page.reload({ waitUntil: "networkidle" });
          const longEvent = page.locator(".weekly-event").first();
          await longEvent.locator(".weekly-event-name strong").evaluate((element) => { element.textContent = "A very long event title with important words ".repeat(4); });
          await longEvent.locator(".event-location").evaluate((element) => { element.lastChild.textContent = "A very long venue name with important words ".repeat(3); });
          assert.ok((await longEvent.boundingBox()).height > box.height, "Long labels may expand naturally");
          assert.ok(await longEvent.locator(".weekly-event-name strong").evaluate((element) =>
            getComputedStyle(element).whiteSpace === "normal" && element.scrollHeight <= element.clientHeight + 1,
          ));
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Long labels do not cause horizontal overflow");
          await context.close();
        }
      }
    }
    assert.deepEqual(backendRequests, [], "Preview interactions remain isolated");
    assert.deepEqual(errors, [], "No page or console errors");
    console.log(JSON.stringify({ results, backendRequests, errors }, null, 2));
    console.log("PASS: compact header-only cards, <=130px standard height, truthful aggregate car, chevron/Enter/Space/focus, expanded current-adult/alternative driver/release/plans/pickups, calendar/URL/filter/group, 44px targets, long-label reflow, and 12 responsive/locale/theme combinations.");
  } finally {
    await browser.close();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
