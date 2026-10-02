import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const modules = createRequire(import.meta.url);
const { default: esbuild } = await import(pathToFileURL(modules.resolve("esbuild", { paths: [modules.resolve("tsx/package.json")] })).href);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseURL = process.env.PREVIEW_URL || "http://localhost:3100/preview";

async function touch(page, type, { selector = ".brand-copy", x = 40, y = 10, count = 1, identifier = 1, cancelable = true } = {}) {
  return page.evaluate(({ type, selector, x, y, count, identifier, cancelable }) => {
    const target = document.querySelector(selector);
    if (!target) throw new Error(`Missing gesture target: ${selector}`);
    if (type === "pointercancel") return target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch" }));
    const points = Array.from({ length: count }, (_, index) => new Touch({
      identifier: identifier + index, target, clientX: x + index, clientY: y,
    }));
    return target.dispatchEvent(new TouchEvent(type, {
      bubbles: true, cancelable,
      touches: type === "touchend" || type === "touchcancel" ? [] : points,
      changedTouches: points,
    }));
  }, { type, selector, x, y, count, identifier, cancelable });
}

async function pull(page, options = {}) {
  await touch(page, "touchstart", options);
  await touch(page, "touchmove", { ...options, y: options.endY ?? 170 });
  await touch(page, "touchend", { ...options, y: options.endY ?? 170 });
}

async function tick(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function run() {
  const browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    headless: true,
  });
  try {
    const backend = [];
    const errors = [];
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    context.on("request", (request) => {
      if (/\/api\/|supabase|[?&]_rsc=/.test(request.url())) backend.push(request.url());
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.addInitScript(() => {
      localStorage.setItem("carpool-locale", "en");
      localStorage.setItem("carpool-theme", "light");
    });
    await page.goto(baseURL, { waitUntil: "networkidle" });
    await page.locator("[data-pull-refresh]").waitFor();
    assert.match(await page.locator("footer").innerText(), /v0\.6\.3/);
    const styles = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.map((link) => link.href));
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY), "none");

    const firstEvent = page.locator(".weekly-event").first();
    await firstEvent.locator(".weekly-event-summary").click();
    await firstEvent.getByRole("button", { name: "I'll drive", exact: true }).click();
    await page.getByText("Demo updated. Changes last until you reload.", { exact: true }).waitFor();
    assert.match(await firstEvent.locator(".ride-leg-panel").nth(1).innerText(), /Sam Morgan/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await touch(page, "touchstart");
    assert.equal(await touch(page, "touchmove", { y: 80 }), false, "A downward top pull cancels native overscroll");
    assert.equal(await page.locator(".pull-refresh-indicator").innerText(), "Pull to refresh");
    await touch(page, "touchmove", { y: 170 });
    assert.equal(await page.locator(".pull-refresh-indicator").innerText(), "Release to refresh");
    await touch(page, "touchend");
    await page.getByText("Sample schedule reset. No backend requests.", { exact: true }).waitFor();
    assert.equal(await firstEvent.locator(".ride-leg-panel").nth(1).getByRole("button", { name: "I'll drive", exact: true }).count(), 1);
    await firstEvent.getByRole("button", { name: "I'll drive", exact: true }).click();
    assert.match(await firstEvent.locator(".ride-leg-panel").nth(1).innerText(), /Sam Morgan/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await pull(page);
    await page.getByText("Sample schedule reset. No backend requests.", { exact: true }).waitFor();
    assert.equal(await firstEvent.locator(".ride-leg-panel").nth(1).getByRole("button", { name: "I'll drive", exact: true }).count(), 1, "Refresh can run again after the sample transition commits");

    for (const tab of ["Rides", "My family", "Team", "Settings"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      if (tab === "Rides") {
        await page.getByRole("button", { name: "We're driving", exact: true }).click();
        await page.getByRole("button", { name: "Next", exact: true }).click();
      }
      if (tab === "Team") await page.getByRole("button", { name: "People", exact: true }).click();
      if (tab === "Settings") await page.getByRole("button", { name: /Preferences/ }).click();
      await page.evaluate(() => window.scrollTo(0, 0));
      const url = page.url();
      const selectedGroup = await page.getByLabel("Active group").inputValue();
      await pull(page);
      await page.getByText("Sample schedule reset. No backend requests.", { exact: true }).waitFor();
      assert.equal(page.url(), url, `${tab}: URL state preserved`);
      assert.equal(await page.getByLabel("Active group").inputValue(), selectedGroup);
      assert.equal(await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("button", { name: tab, exact: true }).getAttribute("aria-current"), "page");
      if (tab === "Rides") assert.equal(await page.getByRole("button", { name: "We're driving", exact: true }).getAttribute("aria-pressed"), "true");
      if (tab === "Team") assert.equal(await page.getByRole("button", { name: "People", exact: true }).getAttribute("aria-current"), "page");
      if (tab === "Settings") assert.ok(await page.getByRole("heading", { name: "Preferences", exact: true }).count());
    }
    await page.getByLabel("Active group").selectOption("demo-neighborhood");
    await page.getByRole("button", { name: "My family", exact: true }).click();
    const secondGroupURL = page.url();
    await page.evaluate(() => window.scrollTo(0, 0));
    await pull(page);
    await page.getByText("Sample schedule reset. No backend requests.", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("Active group").inputValue(), "demo-neighborhood");
    assert.equal(page.url(), secondGroupURL);
    await page.locator(".family-event-row").first().click();
    await page.getByRole("dialog").waitFor();
    await pull(page, { selector: "dialog h2" });
    assert.equal(await page.locator(".pull-refresh-indicator").count(), 0);
    await page.getByRole("dialog").getByRole("button", { name: /Close Ride status/ }).click();

    await context.setOffline(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await pull(page);
    await page.getByText("You're offline. Reconnect to refresh.", { exact: true }).waitFor();
    assert.equal(await page.getByText("Sample schedule reset. No backend requests.", { exact: true }).count(), 0);
    await context.setOffline(false);
    await page.getByRole("button", { name: "Refresh schedule", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByText("Sample schedule reset. No backend requests.", { exact: true }).waitFor();
    assert.deepEqual(backend, [], "Preview refresh must never call backend or RSC routes");
    assert.deepEqual(errors, [], "Actual app preview must have no console or page errors");

    const bundle = await esbuild.build({
      entryPoints: [path.join(__dirname, "fixtures", "pull-refresh-harness.tsx")],
      bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"development"' },
    });
    const fixture = await context.newPage();
    const fixtureURL = new URL("/refresh-test-fixture", baseURL).href;
    await fixture.route(fixtureURL, (route) => route.fulfill({ contentType: "text/html", body: '<!doctype html><html><body><div id="harness"></div></body></html>' }));
    await fixture.goto(fixtureURL);
    for (const url of styles) await fixture.addStyleTag({ url });
    await fixture.addScriptTag({ content: bundle.outputFiles[0].text });
    await fixture.locator("#gesture-zone").waitFor();
    const zone = { selector: "#gesture-zone" };
    const calls = () => fixture.evaluate(() => window.refreshHarness.calls);
    const reset = () => touch(fixture, "touchcancel", zone);
    async function noRefresh(name, action) {
      const before = await calls();
      await action();
      await tick(fixture);
      assert.equal(await calls(), before, name);
      assert.equal(await fixture.locator(".pull-refresh-indicator").count(), 0, name);
    }
    await noRefresh("below threshold", () => pull(fixture, { ...zone, endY: 140 }));
    await noRefresh("touch cancellation", async () => {
      await touch(fixture, "touchstart", zone);
      await touch(fixture, "touchmove", { ...zone, y: 170 });
      await reset();
      await touch(fixture, "touchend", zone);
    });
    await noRefresh("pointer cancellation", async () => {
      await touch(fixture, "touchstart", zone);
      await touch(fixture, "touchmove", { ...zone, y: 170 });
      await touch(fixture, "pointercancel", zone);
      await touch(fixture, "touchend", zone);
    });
    await noRefresh("horizontal swipe", async () => {
      await touch(fixture, "touchstart", zone);
      assert.equal(await touch(fixture, "touchmove", { ...zone, x: 170, y: 80 }), true);
      await touch(fixture, "touchend", zone);
    });
    await noRefresh("multi touch", () => pull(fixture, { ...zone, count: 2 }));
    await noRefresh("second finger cancels", async () => {
      await touch(fixture, "touchstart", zone);
      await touch(fixture, "touchmove", { ...zone, count: 2, y: 170 });
      await touch(fixture, "touchend", zone);
    });
    await noRefresh("finger identity changed", async () => {
      await touch(fixture, "touchstart", zone);
      await touch(fixture, "touchmove", { ...zone, identifier: 2, y: 170 });
      await touch(fixture, "touchend", zone);
    });
    await noRefresh("missing touch", async () => {
      await touch(fixture, "touchstart", zone);
      await touch(fixture, "touchmove", { ...zone, count: 0, y: 170 });
      await touch(fixture, "touchend", zone);
    });
    await noRefresh("native uncancelable scroll", async () => {
      await touch(fixture, "touchstart", zone);
      await touch(fixture, "touchmove", { ...zone, cancelable: false, y: 170 });
      await touch(fixture, "touchend", zone);
    });
    await fixture.evaluate(() => window.scrollTo(0, 50));
    assert.ok(await fixture.evaluate(() => scrollY) > 0);
    await noRefresh("non-top scrolling", () => pull(fixture, zone));
    await fixture.evaluate(() => window.scrollTo(0, 0));
    await noRefresh("scrolling away during pull", async () => {
      await touch(fixture, "touchstart", zone);
      await fixture.evaluate(() => window.scrollTo(0, 50));
      await touch(fixture, "touchmove", { ...zone, y: 170 });
      await touch(fixture, "touchend", zone);
      await fixture.evaluate(() => window.scrollTo(0, 0));
    });
    for (const selector of ["input", "textarea", "select", "[contenteditable]", "button", "#scroll-panel div"]) {
      await noRefresh(`interactive/scroll-panel ${selector}`, () => pull(fixture, { selector }));
    }
    for (const [selector, attribute] of [["form", "data-dirty"], ["form", "aria-busy"], ["#submission", "data-submitting"]]) {
      await fixture.locator(selector).evaluate((element, attribute) => element.setAttribute(attribute, "true"), attribute);
      await noRefresh(attribute, () => pull(fixture, zone));
      await fixture.locator(selector).evaluate((element, attribute) => element.removeAttribute(attribute), attribute);
    }
    await fixture.locator("dialog").evaluate((dialog) => dialog.showModal());
    await noRefresh("open dialog", () => pull(fixture, zone));
    await fixture.locator("dialog").evaluate((dialog) => dialog.close());
    await fixture.evaluate(() => window.refreshHarness.block(true));
    await tick(fixture);
    await noRefresh("blocked prop", () => pull(fixture, zone));
    await fixture.evaluate(() => window.refreshHarness.block(false));
    await tick(fixture);

    await fixture.emulateMedia({ reducedMotion: "reduce" });
    await touch(fixture, "touchstart", zone);
    await touch(fixture, "touchmove", { ...zone, y: Math.ceil(10 + 72 / 0.55) });
    assert.equal(await fixture.locator(".pull-refresh-indicator").innerText(), "Release to refresh");
    await touch(fixture, "touchend", zone);
    await fixture.getByText("Refreshing…", { exact: true }).waitFor();
    assert.equal(await calls(), 1);
    assert.equal(await fixture.locator(".refresh-spinning").first().evaluate((element) => getComputedStyle(element).animationName), "none");
    assert.equal(await fixture.getByRole("button", { name: "Refresh schedule", exact: true }).isDisabled(), true);
    await pull(fixture, zone);
    assert.equal(await calls(), 1, "Pending refresh is single-flight");
    await fixture.evaluate(() => window.refreshHarness.resolve());
    await fixture.getByText("Schedule refreshed.", { exact: true }).waitFor();
    assert.equal(await fixture.locator(".pull-refresh-indicator").count(), 0);

    await fixture.getByRole("button", { name: "Refresh schedule", exact: true }).click();
    await fixture.getByText("Refreshing…", { exact: true }).waitFor();
    await fixture.evaluate(() => window.refreshHarness.reject());
    await fixture.getByRole("alert").filter({ hasText: "Could not refresh the schedule. Try again." }).waitFor();
    await fixture.getByRole("button", { name: "Refresh schedule", exact: true }).click();
    await fixture.getByText("Refreshing…", { exact: true }).waitFor();
    await context.setOffline(true);
    await fixture.evaluate(() => window.refreshHarness.resolve());
    await fixture.getByText("You're offline. Reconnect to refresh.", { exact: true }).waitFor();
    assert.equal(await fixture.getByText("Schedule refreshed.", { exact: true }).count(), 0, "Going offline during refresh cannot announce success");
    await context.setOffline(false);
    await context.setOffline(true);
    const beforeOffline = await calls();
    await pull(fixture, zone);
    await fixture.getByText("You're offline. Reconnect to refresh.", { exact: true }).waitFor();
    assert.equal(await calls(), beforeOffline, "Offline refresh never calls reload");
    await context.setOffline(false);
    await fixture.evaluate(() => window.refreshHarness.unmount());
    assert.equal(await fixture.evaluate(() => document.documentElement.classList.contains("custom-pull-refresh")), false, "Unmount restores native overscroll policy");
    assert.deepEqual(backend, []);

    for (const [width, locale, theme] of [[360, "he", "dark"], [390, "en", "light"], [1280, "en", "dark"]]) {
      const visual = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: true });
      await visual.addInitScript(({ locale, theme }) => {
        localStorage.setItem("carpool-locale", locale);
        localStorage.setItem("carpool-theme", theme);
      }, { locale, theme });
      const display = await visual.newPage();
      await display.goto(baseURL, { waitUntil: "networkidle" });
      await touch(display, "touchstart");
      await touch(display, "touchmove", { y: 170 });
      assert.equal(await display.locator(".pull-refresh-indicator").innerText(), locale === "he" ? "שחררו לרענון" : "Release to refresh");
      assert.equal(await display.evaluate(() => document.documentElement.dir), locale === "he" ? "rtl" : "ltr");
      assert.ok(await display.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const refreshButton = await display.locator(".refresh-schedule-button").boundingBox();
      assert.ok(refreshButton.width >= 44 && refreshButton.height >= 44);
      if (process.env.REFRESH_SCREENSHOT_DIR) await display.screenshot({ path: path.join(process.env.REFRESH_SCREENSHOT_DIR, `pull-refresh-${width}-${locale}-${theme}.png`) });
      await touch(display, "touchcancel");
      await visual.close();
    }
    console.log("PASS: exact damped threshold, cancellation/scroll/interaction guards, single-flight actual pending, errors/offline, keyboard, four tabs/group/URL state, sample reset with zero backend requests, RTL/dark/responsive/reduced motion and cleanup. Synthetic browser gestures; not physical-device testing.");
    await context.close();
  } finally {
    await browser.close();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
