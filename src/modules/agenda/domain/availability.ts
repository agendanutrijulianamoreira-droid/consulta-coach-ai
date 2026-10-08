export type BusyInterval = { start: string; end: string };
export type AvailabilityWindow = { start: string; end: string };

/** Generates local ISO-like slots, excluding conflicts and enforcing a buffer. */
export function generateSlots(
  date: string,
  windows: AvailabilityWindow[],
  durationMinutes: number,
  intervalMinutes: number,
  busy: BusyInterval[] = [],
  bufferMinutes = 0,
) {
  if (!date || durationMinutes <= 0 || intervalMinutes <= 0) return [];
  const slots: string[] = [];
  for (const window of windows) {
    const windowStart = minutes(window.start);
    const windowEnd = minutes(window.end);
    for (let start = windowStart; start + durationMinutes <= windowEnd; start += intervalMinutes) {
      const end = start + durationMinutes;
      const overlaps = busy.some(
        (item) =>
          start < minutes(item.end) + bufferMinutes && end + bufferMinutes > minutes(item.start),
      );
      if (!overlaps) slots.push(`${date}T${clock(start)}`);
    }
  }
  return [...new Set(slots)].sort();
}

function minutes(value: string) {
  const [hours = 0, mins = 0] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + mins;
}
function clock(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
