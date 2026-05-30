import { placeholderFarmId } from "./machines";

export type CalendarEventSource = "maintenance" | "manual";

export type CalendarEvent = {
  id: string;
  farmId: string;
  machineId: string | null;
  title: string;
  eventDate: string;
  eventTime: string | null;
  note: string | null;
  source: CalendarEventSource;
  reminderKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCalendarEventInput = Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">;
export type UpdateCalendarEventInput = Partial<CreateCalendarEventInput>;

export const placeholderCalendarEvents: CalendarEvent[] = [
  {
    id: "calevent-1111-4111-8111-111111111111",
    farmId: placeholderFarmId,
    machineId: "11111111-1111-4111-8111-111111111111",
    title: "Motorölwechsel fällig",
    eventDate: "2026-06-15",
    eventTime: null,
    note: "Geplanter Wartungstermin",
    source: "maintenance",
    reminderKey: "maintenance_due:maintenance_task:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:00:00.000Z"
  },
  {
    id: "calevent-2222-4222-8222-222222222222",
    farmId: placeholderFarmId,
    machineId: null,
    title: "Landtechnik-Messe Wels",
    eventDate: "2026-11-12",
    eventTime: "09:00",
    note: "Halle 10, Stand 42",
    source: "manual",
    reminderKey: null,
    createdAt: "2026-05-10T10:00:00.000Z",
    updatedAt: "2026-05-10T10:00:00.000Z"
  }
];

export function getCalendarEventsForWeek(events: CalendarEvent[], weekStart: Date): CalendarEvent[] {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const start = toDateString(weekStart);
  const end = toDateString(weekEnd);

  return events.filter((event) => event.eventDate >= start && event.eventDate <= end);
}

export function getCalendarEventsForMonth(events: CalendarEvent[], year: number, month: number): CalendarEvent[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const prefix = `${year}-${pad(month + 1)}`;

  return events.filter((event) => event.eventDate.startsWith(prefix));
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
