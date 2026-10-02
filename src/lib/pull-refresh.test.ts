import assert from "node:assert/strict";
import test from "node:test";
import { beginPull, movePull, releasePull, PULL_REFRESH_DAMPING, PULL_REFRESH_LIMIT, PULL_REFRESH_THRESHOLD, type PullPoint } from "./pull-refresh";

const start: PullPoint = { x: 40, y: 10, identifier: 1, touches: 1, scrollTop: 0, blocked: false };

test("Kangs-style damping triggers at exactly 72px, not just under it", () => {
  const gesture = beginPull(start)!;
  const below = movePull(gesture, { ...start, y: start.y + (PULL_REFRESH_THRESHOLD - 0.001) / PULL_REFRESH_DAMPING });
  const exact = movePull(gesture, { ...start, y: start.y + PULL_REFRESH_THRESHOLD / PULL_REFRESH_DAMPING });
  assert.equal(releasePull(below), false);
  assert.equal(exact?.distance, 72);
  assert.equal(releasePull(exact), true);
  assert.equal(movePull(gesture, { ...start, y: 170 })?.distance, 88);
  assert.equal(movePull(gesture, { ...start, y: 1000 })?.distance, PULL_REFRESH_LIMIT);
});

test("pull cannot start during a submission/refresh, away from document top, or with multiple touches", () => {
  for (const point of [{ ...start, blocked: true }, { ...start, scrollTop: 1 }, { ...start, touches: 0 }, { ...start, touches: 2 }]) {
    assert.equal(beginPull(point), null);
  }
  assert.ok(beginPull({ ...start, scrollTop: -2 }));
});

test("upward, horizontal, multitouch, changed-finger, blocked, and non-top moves cancel", () => {
  const gesture = beginPull(start)!;
  for (const point of [
    { ...start, y: 9 }, { ...start, x: 80, y: 20 }, { ...start, touches: 2, y: 170 },
    { ...start, touches: 0 }, { ...start, identifier: 2, y: 170 },
    { ...start, blocked: true, y: 170 }, { ...start, scrollTop: 1, y: 170 },
  ]) assert.equal(movePull(gesture, point), null);
  assert.equal(releasePull(null), false);
});

test("retreating below threshold disarms release without changing the original start point", () => {
  const gesture = beginPull(start)!;
  const armed = movePull(gesture, { ...start, y: 170 })!;
  const retreated = movePull(armed, { ...start, y: 60 });
  assert.equal(releasePull(armed), true);
  assert.ok(Math.abs(retreated!.distance - 27.5) < 0.000001);
  assert.equal(releasePull(retreated), false);
  assert.equal(gesture.distance, 0);
});
