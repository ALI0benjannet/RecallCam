/** Time utilities never interpret a camera's wall clock using the developer's OS timezone. */
export function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  const power = Math.min(
    Math.floor(Math.log(Math.max(1, bytes)) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** power).toLocaleString(undefined, { maximumFractionDigits: power ? 1 : 0 })} ${units[power]}`;
}
export function formatDuration(seconds: number | null) {
  if (seconds === null) return "Duration pending";
  const total = Math.max(1, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}
export function formatRecorded(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}
function wallClock(format: Intl.DateTimeFormat, time: number) {
  const parts = Object.fromEntries(
    format.formatToParts(new Date(time)).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
export function cameraTimeOffsets(local: string, timeZone: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(local)) return [];
  const wall = local.length === 16 ? `${local}:00` : local;
  const target = Date.parse(`${wall}Z`);
  if (!Number.isFinite(target)) return [];
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const candidates = new Set<number>();
    for (let hours = -24; hours <= 24; hours += 3) {
      const sample = target + hours * 3600000;
      candidates.add((Date.parse(`${wallClock(formatter, sample)}Z`) - sample) / 60000);
    }
    return [...candidates]
      .filter(
        (offset) =>
          Number.isInteger(offset) &&
          Math.abs(offset) <= 14 * 60 &&
          wallClock(formatter, target - offset * 60000) === wall,
      )
      .sort((a, b) => a - b)
      .map(
        (offset) =>
          `${offset < 0 ? "-" : "+"}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}:${String(Math.abs(offset) % 60).padStart(2, "0")}`,
      );
  } catch {
    return [];
  }
}
