import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarBounds,
  clampCalendarDate,
  canMoveMonth,
} from "../lib/calendarBounds";
const today = new Date(2026, 8, 25);
test("calendar range is exactly one year either side of today", () =>
  assert.deepEqual(calendarBounds(today), {
    min: "2025-09-25",
    max: "2027-09-25",
  }));
test("old persisted selections and new selections are clamped", () => {
  assert.equal(clampCalendarDate("2020-01-01", today), "2025-09-25");
  assert.equal(clampCalendarDate("2030-01-01", today), "2027-09-25");
  assert.equal(clampCalendarDate("2026-10-04", today), "2026-10-04");
});
test("both arrows and swipe callbacks stop at the boundary months", () => {
  assert.equal(canMoveMonth("2025-09", -1, today), false);
  assert.equal(canMoveMonth("2027-09", 1, today), false);
  assert.equal(canMoveMonth("2025-09", 1, today), true);
  assert.equal(canMoveMonth("2027-09", -1, today), true);
});
test("leap-day bounds stay in February", () =>
  assert.deepEqual(calendarBounds(new Date(2024, 1, 29)), {
    min: "2023-02-28",
    max: "2025-02-28",
  }));
