import { dateKey } from "./date";
export function calendarBounds(today = new Date()) {
  const year = today.getFullYear(),
    month = today.getMonth(),
    day = today.getDate();
  const shifted = (offset: number) =>
    dateKey(
      new Date(
        year + offset,
        month,
        Math.min(day, new Date(year + offset, month + 1, 0).getDate()),
      ),
    );
  return { min: shifted(-1), max: shifted(1) };
}
export function clampCalendarDate(date: string, today = new Date()) {
  const { min, max } = calendarBounds(today);
  return date < min ? min : date > max ? max : date;
}
export function canMoveMonth(
  month: string,
  direction: -1 | 1,
  today = new Date(),
) {
  const { min, max } = calendarBounds(today);
  return direction === -1
    ? month.slice(0, 7) > min.slice(0, 7)
    : month.slice(0, 7) < max.slice(0, 7);
}
