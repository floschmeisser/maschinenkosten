import { DB_CONSTRAINTS } from "./db-schema";

export type DbMaintenanceType = typeof DB_CONSTRAINTS.maintenanceTask.typeValues[number];

const DB_MAINTENANCE_TYPE_SET = new Set<string>(DB_CONSTRAINTS.maintenanceTask.typeValues);

const APP_TO_DB_TYPE_MAP: Record<string, DbMaintenanceType> = {
  oil_engine: "oil_change",
  oil_hydraulic: "oil_change",
  oil_change: "oil_change",
  filter_air: "wear_part",
  filter_fuel: "wear_part",
  filter_hydraulic: "wear_part",
  filter_cabin: "wear_part",
  wear_part: "wear_part",
  inspection_57a: "inspection",
  general_check: "inspection",
  inspection: "inspection",
  brakes_tires: "inspection",
  service: "service",
  ac_service: "service",
  lubrication: "lubrication",
  repair: "repair",
  cleaning: "cleaning",
  custom: "other",
  other: "other",
};

export function mapMaintenanceTypeToDb(appType: string): DbMaintenanceType {
  return APP_TO_DB_TYPE_MAP[appType] ?? "other";
}

export function isExtendedMaintenanceType(appType: string): boolean {
  return !DB_MAINTENANCE_TYPE_SET.has(appType);
}

// For INSERT: derives DB interval_type from stored values (value-based)
export function mapIntervalTypeToDb(
  intervalMonths: number | null | undefined,
  intervalHours: number | null | undefined,
  intervalKm: number | null | undefined,
  intervalDays: number | null | undefined = null,
): "none" | "days" | "operating_hours" | "kilometers" {
  if ((intervalHours ?? 0) > 0) return "operating_hours";
  if ((intervalKm ?? 0) > 0) return "kilometers";
  if ((intervalMonths ?? 0) > 0 || (intervalDays ?? 0) > 0) return "days";
  return "none";
}

// For UPDATE: derives DB interval_type from the app intervalType string
export function mapIntervalTypeStringToDb(
  intervalType: string,
): "none" | "days" | "operating_hours" | "kilometers" {
  if (intervalType === "months") return "days";
  if (intervalType === "combined") return "operating_hours";
  const allowed = new Set(["none", "days", "operating_hours", "kilometers"]);
  return allowed.has(intervalType)
    ? (intervalType as "none" | "days" | "operating_hours" | "kilometers")
    : "none";
}

// For READ: reconstructs the app-level intervalType from stored DB values
export function deriveAppIntervalType(row: {
  interval_months?: number | null;
  interval_days?: number | null;
  interval_operating_hours?: number | null;
  interval_kilometers?: number | null;
}): "none" | "months" | "days" | "operating_hours" | "kilometers" | "combined" {
  const hasMonths = (row.interval_months ?? 0) > 0;
  const hasHours = (row.interval_operating_hours ?? 0) > 0;
  const hasKm = (row.interval_kilometers ?? 0) > 0;
  const hasDaysOnly = (row.interval_days ?? 0) > 0 && !hasMonths;
  const quantitativeCount = [hasMonths, hasHours, hasKm].filter(Boolean).length;

  if (quantitativeCount > 1) return "combined";
  if (hasMonths) return "months";
  if (hasHours) return "operating_hours";
  if (hasKm) return "kilometers";
  if (hasDaysOnly) return "days";
  return "none";
}
