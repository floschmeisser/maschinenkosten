import type { MachineCategoryGroupId } from "./machine-categories";
import type { MaintenanceType } from "./maintenance";

export type MaintenanceTemplate = {
  type: MaintenanceType;
  title: string;
  intervalMonths?: number;
  intervalHours?: number;
  intervalKm?: number;
};

export const MAINTENANCE_TEMPLATES: Record<MachineCategoryGroupId, MaintenanceTemplate[]> = {
  tractor: [
    { type: "oil_engine",       title: "Motorölwechsel",               intervalMonths: 12, intervalHours: 250 },
    { type: "oil_hydraulic",    title: "Hydraulik-/Getriebeölwechsel", intervalMonths: 24, intervalHours: 500 },
    { type: "filter_air",       title: "Luftfilterwechsel",            intervalMonths: 12, intervalHours: 250 },
    { type: "filter_fuel",      title: "Kraftstofffilterwechsel",      intervalMonths: 12, intervalHours: 500 },
    { type: "filter_hydraulic", title: "Hydraulikfilterwechsel",       intervalMonths: 24, intervalHours: 500 },
    { type: "service",          title: "Service / Jahresinspektion",   intervalMonths: 12 },
    { type: "inspection_57a",   title: "§57a Begutachtung (Pickerl)", intervalMonths: 24 },
    { type: "lubrication",      title: "Abschmieren",                  intervalMonths: 3,  intervalHours: 50 },
  ],
  selfpropelled: [
    { type: "oil_engine",    title: "Motorölwechsel",               intervalMonths: 12, intervalHours: 200 },
    { type: "oil_hydraulic", title: "Hydraulik-/Getriebeölwechsel", intervalMonths: 24, intervalHours: 500 },
    { type: "filter_air",    title: "Luftfilterwechsel",            intervalMonths: 12, intervalHours: 100 },
    { type: "filter_fuel",   title: "Kraftstofffilterwechsel",      intervalMonths: 12, intervalHours: 250 },
    { type: "service",       title: "Service / Jahresinspektion",   intervalMonths: 12 },
    { type: "lubrication",   title: "Abschmieren",                  intervalMonths: 1,  intervalHours: 20 },
  ],
  implement: [
    { type: "lubrication",   title: "Abschmieren",                  intervalMonths: 3 },
    { type: "general_check", title: "Allgemeine Überprüfung",       intervalMonths: 12 },
  ],
  vehicle: [
    { type: "oil_engine",   title: "Motorölwechsel",              intervalMonths: 12, intervalKm: 15000 },
    { type: "service",      title: "Service / Jahresinspektion",  intervalMonths: 12, intervalKm: 30000 },
    { type: "inspection_57a", title: "§57a Begutachtung (Pickerl)", intervalMonths: 12 },
    { type: "brakes_tires", title: "Bremsen-/Reifenprüfung",     intervalMonths: 12, intervalKm: 20000 },
  ],
};
