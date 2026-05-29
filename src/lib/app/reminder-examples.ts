import { placeholderFarmId } from "./machines";
import { createReminderKey, type CreateReminderInput } from "./reminders";

export const overdueMaintenanceReminderExample: CreateReminderInput = {
  farmId: placeholderFarmId,
  type: "maintenance_due",
  sourceType: "maintenance_task",
  sourceId: "maintenance-overdue-example",
  machineId: "machine-example",
  title: "Wartung faellig",
  message: "Oelwechsel / Traktor 6155R",
  dueDate: "2026-05-01",
  priority: "high",
  reminderKey: createReminderKey({
    type: "maintenance_due",
    sourceType: "maintenance_task",
    sourceId: "maintenance-overdue-example"
  })
};

export const soonMaintenanceReminderExample: CreateReminderInput = {
  farmId: placeholderFarmId,
  type: "maintenance_soon",
  sourceType: "maintenance_task",
  sourceId: "maintenance-soon-example",
  machineId: "machine-example",
  title: "Wartung in 7 Tagen",
  message: "Schmieren / Ladewagen",
  dueDate: "2026-06-05",
  priority: "medium",
  reminderKey: createReminderKey({
    type: "maintenance_soon",
    sourceType: "maintenance_task",
    sourceId: "maintenance-soon-example"
  })
};

export const lowSparePartReminderExample: CreateReminderInput = {
  farmId: placeholderFarmId,
  type: "spare_part_low_stock",
  sourceType: "spare_part",
  sourceId: "spare-part-low-example",
  machineId: "machine-example",
  title: "Ersatzteil niedrig",
  message: "Oelfilter: 1 Stk. auf Lager",
  dueDate: null,
  priority: "high",
  reminderKey: createReminderKey({
    type: "spare_part_low_stock",
    sourceType: "spare_part",
    sourceId: "spare-part-low-example"
  })
};

export const duplicateReminderKeyBehaviorExample = {
  firstKey: createReminderKey({
    type: "maintenance_due",
    sourceType: "maintenance_task",
    sourceId: "same-maintenance-task"
  }),
  secondKey: createReminderKey({
    type: "maintenance_due",
    sourceType: "maintenance_task",
    sourceId: "same-maintenance-task"
  }),
  expected: "Gleicher type/sourceType/sourceId ergibt gleichen reminderKey und wird per upsert aktualisiert."
};
