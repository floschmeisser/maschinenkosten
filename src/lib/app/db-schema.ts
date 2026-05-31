export const DB_CONSTRAINTS = {
  machine: {
    requiredOnInsert: ["farm_id", "name", "category", "year_of_manufacture"] as const,
    statusValues: ["active", "retired", "sold"] as const,
    unitValues: ["hours", "km"] as const,
    categoryValues: [
      "tractor", "loader", "harvester", "grassland",
      "tillage", "transport", "sprayer", "slurry",
      "trailer", "press", "chainsaw", "vehicle", "other",
    ] as const,
  },
  maintenanceTask: {
    typeValues: [
      "oil_change", "service", "lubrication", "repair",
      "wear_part", "inspection", "cleaning", "other",
    ] as const,
    intervalTypeValues: ["none", "days", "operating_hours", "kilometers"] as const,
    statusValues: ["open", "planned", "in_progress", "completed", "cancelled"] as const,
  },
  reminder: {
    statusValues: ["open", "acknowledged", "dismissed", "completed"] as const,
  },
  calendarEvent: {
    sourceValues: ["manual", "maintenance"] as const,
  },
} as const;
