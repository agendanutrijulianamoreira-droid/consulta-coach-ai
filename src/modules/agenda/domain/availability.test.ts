import { describe, expect, test } from "bun:test";
import { generateSlots } from "./availability";

describe("availability slots", () => {
  test("generates slots respecting duration and interval", () => {
    expect(generateSlots("2026-10-08", [{ start: "09:00", end: "11:00" }], 45, 30)).toEqual([
      "2026-10-08T09:00",
      "2026-10-08T09:30",
      "2026-10-08T10:00",
    ]);
  });

  test("removes conflicts and buffer windows", () => {
    expect(
      generateSlots(
        "2026-10-08",
        [{ start: "09:00", end: "11:00" }],
        30,
        30,
        [{ start: "10:00", end: "10:30" }],
        15,
      ),
    ).toEqual(["2026-10-08T09:00"]);
  });
});
