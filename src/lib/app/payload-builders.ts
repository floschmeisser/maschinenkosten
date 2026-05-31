import type { CreateMachineInput, CreateMachineSparePartInput } from "./machines";
import type { CreateMaintenanceTaskInput } from "./maintenance";
import type { Reminder } from "./reminders";
import type { CalendarEvent } from "./calendar-events";
import { mapMaintenanceTypeToDb, isExtendedMaintenanceType, mapIntervalTypeToDb } from "./db-mappers";
import { DB_CONSTRAINTS } from "./db-schema";

function assertDbValue(field: string, value: unknown, allowed: readonly string[]): void {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new Error(
      `[payload-builders] Invalid ${field}: "${value}". Allowed: [${(allowed as readonly string[]).join(", ")}]`
    );
  }
}

export function buildMachineInsertPayload(input: CreateMachineInput, farmId: string) {
  const payload = {
    farm_id: farmId,
    name: input.name.trim(),
    category: input.category ?? "other",
    unit: input.unit ?? "hours",
    manufacturer: input.manufacturer ?? "",
    model: input.model ?? "",
    year_of_manufacture: input.yearOfManufacture ?? new Date().getFullYear(),
    purchase_date: input.purchaseDate ?? null,
    purchase_price: input.purchasePrice ?? 0,
    new_price: input.newPrice ?? input.purchasePrice ?? 0,
    current_value: input.currentValue ?? 0,
    residual_value: input.residualValue ?? 0,
    expected_useful_life_years: input.expectedUsefulLifeYears ?? 10,
    annual_operating_hours: input.annualOperatingHours ?? 0,
    current_operating_hours: input.currentOperatingHours ?? 0,
    current_kilometers: input.currentKilometers ?? null,
    working_width_meters: input.workingWidthMeters ?? null,
    hectares_per_hour: input.hectaresPerHour ?? null,
    insurance_per_year: input.insurancePerYear ?? null,
    tax_per_year: input.taxPerYear ?? null,
    storage_per_year: input.storagePerYear ?? null,
    other_fixed_costs_per_year: input.otherFixedCostsPerYear ?? null,
    maintenance_costs_per_year: input.maintenanceCostsPerYear ?? null,
    repair_costs_per_year: input.repairCostsPerYear ?? null,
    fuel_costs_per_hour: input.fuelCostsPerHour ?? null,
    operator_costs_per_hour: input.operatorCostsPerHour ?? null,
    other_variable_costs_per_hour: input.otherVariableCostsPerHour ?? null,
    annual_kilometers: input.annualKilometers ?? null,
    status: input.status ?? "active",
    notes: input.notes ?? null,
  };
  assertDbValue("machine.status", payload.status, DB_CONSTRAINTS.machine.statusValues);
  assertDbValue("machine.unit", payload.unit, DB_CONSTRAINTS.machine.unitValues);
  assertDbValue("machine.category", payload.category, DB_CONSTRAINTS.machine.categoryValues);
  return payload;
}

export function buildMaintenanceTaskInsertPayload(input: CreateMaintenanceTaskInput, farmId: string) {
  const rawType = input.type ?? "service";
  const hasMonths = (input.intervalMonths ?? 0) > 0;
  const hasHours = (input.intervalOperatingHours ?? 0) > 0;
  // months-only: convert to days for DB; combined (months+hours): keep interval_days as-is
  const dbIntervalDays = (hasMonths && !hasHours)
    ? ((input.intervalMonths ?? 0) * 30 || null)
    : (input.intervalDays ?? null);
  const dbIntervalMonths = hasMonths ? (input.intervalMonths ?? null) : null;

  const payload = {
    farm_id: farmId,
    machine_id: input.machineId,
    title: input.title,
    type: mapMaintenanceTypeToDb(rawType),
    custom_title: isExtendedMaintenanceType(rawType) ? rawType : (input.customTitle ?? null),
    status: "open" as const,
    due_date: input.dueDate ?? null,
    due_operating_hours: input.dueOperatingHours ?? null,
    due_kilometers: input.dueKilometers ?? null,
    interval_type: mapIntervalTypeToDb(
      input.intervalMonths,
      input.intervalOperatingHours,
      input.intervalKilometers,
      input.intervalDays,
    ),
    interval_days: dbIntervalDays,
    interval_months: dbIntervalMonths,
    interval_operating_hours: input.intervalOperatingHours ?? null,
    interval_kilometers: input.intervalKilometers ?? null,
    last_done_reading: null as null,
    estimated_cost: input.estimatedCost ?? 0,
    actual_cost: null as null,
    notes: input.notes ?? null,
    completed_at: null as null,
  };
  assertDbValue("maintenanceTask.type", payload.type, DB_CONSTRAINTS.maintenanceTask.typeValues);
  assertDbValue("maintenanceTask.interval_type", payload.interval_type, DB_CONSTRAINTS.maintenanceTask.intervalTypeValues);
  assertDbValue("maintenanceTask.status", payload.status, DB_CONSTRAINTS.maintenanceTask.statusValues);
  return payload;
}

export function buildSparePartInsertPayload(input: CreateMachineSparePartInput, farmId: string) {
  return {
    farm_id: farmId,
    machine_id: input.machineId,
    name: input.name.trim(),
    part_number: input.partNumber ?? null,
    original_part_number: input.originalPartNumber ?? null,
    manufacturer: input.manufacturer ?? null,
    supplier: input.supplier ?? null,
    stock_quantity: input.stockQuantity ?? 0,
    minimum_stock_quantity: input.minimumStockQuantity ?? 0,
    unit: input.unit ?? "Stk.",
    storage_location: input.storageLocation ?? null,
    purchase_price: input.purchasePrice ?? null,
    notes: input.notes ?? null,
  };
}

export function buildCalendarEventInsertPayload(event: CalendarEvent) {
  const payload = {
    id: event.id,
    farm_id: event.farmId,
    machine_id: event.machineId ?? null,
    title: event.title,
    event_date: event.eventDate,
    event_time: event.eventTime ?? null,
    note: event.note ?? null,
    source: event.source,
    reminder_key: event.reminderKey ?? null,
    created_at: event.createdAt,
    updated_at: event.updatedAt,
  };
  assertDbValue("calendarEvent.source", payload.source, DB_CONSTRAINTS.calendarEvent.sourceValues);
  return payload;
}

export function buildReminderInsertPayload(reminder: Reminder) {
  const payload = {
    id: reminder.id,
    farm_id: reminder.farmId,
    reminder_key: reminder.reminderKey,
    type: reminder.type,
    source_type: reminder.sourceType,
    source_id: reminder.sourceId,
    machine_id: reminder.machineId ?? null,
    title: reminder.title,
    description: reminder.message ?? null,
    due_date: reminder.dueDate ?? null,
    priority: reminder.priority,
    status: "open" as const,
    created_at: reminder.createdAt,
    updated_at: reminder.updatedAt,
  };
  assertDbValue("reminder.status", payload.status, DB_CONSTRAINTS.reminder.statusValues);
  return payload;
}
