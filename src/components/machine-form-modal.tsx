"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { FormEvent } from "react";
import {
  getMachineCategoryLabel,
  placeholderFarmId,
  type CreateMachineInput,
  type Machine,
  type MachineCategory,
  type MachineUnit
} from "@/lib/app/machines";

type MachineFormMode = "create" | "edit";

type MachineFormModalProps = {
  mode: "compact" | "page";
  formMode?: MachineFormMode;
  machine?: Machine;
  onCancel?: () => void;
  onSave?: (input: CreateMachineInput) => Promise<void> | void;
};

type FormState = {
  name: string;
  category: MachineCategory;
  unit: MachineUnit;
  currentReading: string;
  annualUsage: string;
  manufacturer: string;
  model: string;
  yearOfManufacture: string;
  purchasePrice: string;
  currentValue: string;
  residualValue: string;
  expectedUsefulLifeYears: string;
  hectaresPerHour: string;
  insurancePerYear: string;
  maintenanceCostsPerYear: string;
  repairCostsPerYear: string;
  fuelCostsPerHour: string;
  operatorCostsPerHour: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const categories: MachineCategory[] = [
  "tractor", "loader", "harvester", "grassland", "tillage",
  "transport", "sprayer", "slurry", "trailer", "press",
  "chainsaw", "vehicle", "other"
];

const USEFUL_LIFE_BY_CATEGORY: Record<MachineCategory, number> = {
  tractor: 12, loader: 12, harvester: 12, grassland: 10, tillage: 12,
  transport: 10, sprayer: 10, slurry: 12, trailer: 15, press: 12,
  chainsaw: 8, vehicle: 10, other: 10,
};

export function MachineFormModal({ mode, formMode = "create", machine, onCancel, onSave }: MachineFormModalProps) {
  const [form, setForm] = useState<FormState>(() => createInitialFormState(machine));
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hints, setHints] = useState<Partial<Record<keyof FormState, string>>>({});
  const userModifiedRef = useRef<Set<keyof FormState>>(
    formMode === "edit"
      ? new Set<keyof FormState>(["annualUsage", "residualValue", "expectedUsefulLifeYears", "currentValue"])
      : new Set<keyof FormState>()
  );
  const title = formMode === "edit" ? "Maschine bearbeiten" : "Maschine anlegen";
  const className = mode === "page" ? "panel form-panel wide" : "panel form-panel";
  const canCancel = Boolean(onCancel);
  const isKm = form.unit === "km";

  const setSuggestion = useCallback((key: keyof FormState, value: string, hint: string) => {
    if (userModifiedRef.current.has(key)) return;
    setForm((current) => ({ ...current, [key]: value }));
    setHints((current) => ({ ...current, [key]: hint }));
  }, []);

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    userModifiedRef.current.add(key);
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setHints((current) => ({ ...current, [key]: undefined }));
  }

  // Calc 1: Stunden/Jahr aus Stand ÷ Alter
  useEffect(() => {
    if (isKm) return;
    const reading = toNumber(form.currentReading);
    const age = new Date().getFullYear() - toNumber(form.yearOfManufacture);
    if (reading <= 0 || age <= 0) return;
    const suggestion = Math.round(reading / age / 50) * 50;
    if (suggestion <= 0) return;
    setSuggestion("annualUsage", String(suggestion), `${reading} h / ${age} Jahre`);
  }, [form.currentReading, form.yearOfManufacture, isKm, setSuggestion]);

  // Calc 2: Restwert = 10 % des Anschaffungspreises
  useEffect(() => {
    const price = toNumber(form.purchasePrice);
    if (price <= 0) return;
    setSuggestion("residualValue", String(Math.round(price * 0.1)), `10 % von ${price.toLocaleString("de-AT")} €`);
  }, [form.purchasePrice, setSuggestion]);

  // Calc 3: Nutzungsdauer nach Kategorie
  useEffect(() => {
    const usefulLife = USEFUL_LIFE_BY_CATEGORY[form.category];
    setSuggestion("expectedUsefulLifeYears", String(usefulLife), `Richtwert ${getMachineCategoryLabel(form.category)}`);
  }, [form.category, setSuggestion]);

  // Calc 4: Zeitwert via linearer Abschreibung
  useEffect(() => {
    const price = toNumber(form.purchasePrice);
    const usefulLife = toNumber(form.expectedUsefulLifeYears);
    const age = new Date().getFullYear() - toNumber(form.yearOfManufacture);
    if (price <= 0 || usefulLife <= 0 || age <= 0) return;
    const residual = price * 0.1;
    const depreciated = price - (price * 0.9 / usefulLife) * age;
    const suggestion = Math.round(Math.max(residual, depreciated));
    setSuggestion("currentValue", String(suggestion), `Zeitwert nach ${age} Jahren`);
  }, [form.purchasePrice, form.expectedUsefulLifeYears, form.yearOfManufacture, setSuggestion]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !onSave) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(createMachineInput(form, machine));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className={className}>
      <div className="panel-heading">
        <h2>{title}</h2>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <fieldset className="form-section">
          <legend>Stammdaten</legend>
          <TextField label="Name *" value={form.name} error={errors.name} onChange={(value) => updateField("name", value)} />
          <label>
            Kategorie
            <select value={form.category} onChange={(event) => updateField("category", event.target.value as MachineCategory)}>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {getMachineCategoryLabel(category)}
                </option>
              ))}
            </select>
          </label>
          <TextField label="Hersteller" value={form.manufacturer} onChange={(value) => updateField("manufacturer", value)} />
          <TextField label="Modell" value={form.model} onChange={(value) => updateField("model", value)} />
          <NumberField
            label="Baujahr"
            value={form.yearOfManufacture}
            onChange={(value) => updateField("yearOfManufacture", value)}
          />
        </fieldset>

        <fieldset className="form-section">
          <legend>Einheit und Stand</legend>
          <label>
            Einheit
            <select value={form.unit} onChange={(event) => updateField("unit", event.target.value as MachineUnit)}>
              <option value="hours">Betriebsstunden (h)</option>
              <option value="km">Kilometer (km)</option>
            </select>
          </label>
          <NumberField
            label={isKm ? "Kilometerstand aktuell *" : "Betriebsstunden aktuell *"}
            value={form.currentReading}
            error={errors.currentReading}
            onChange={(value) => updateField("currentReading", value)}
          />
          <NumberField
            label={isKm ? "km pro Jahr" : "Stunden pro Jahr"}
            value={form.annualUsage}
            hint={hints.annualUsage}
            onChange={(value) => updateField("annualUsage", value)}
          />
          {!isKm ? (
            <NumberField
              label="Hektar pro Stunde"
              value={form.hectaresPerHour}
              onChange={(value) => updateField("hectaresPerHour", value)}
            />
          ) : null}
        </fieldset>

        <fieldset className="form-section">
          <legend>Kosten (optional)</legend>
          <NumberField
            label="Anschaffungspreis"
            value={form.purchasePrice}
            onChange={(value) => updateField("purchasePrice", value)}
          />
          <NumberField
            label="Aktueller Wert"
            value={form.currentValue}
            hint={hints.currentValue}
            onChange={(value) => updateField("currentValue", value)}
          />
          <NumberField
            label="Restwert"
            value={form.residualValue}
            hint={hints.residualValue}
            onChange={(value) => updateField("residualValue", value)}
          />
          <NumberField
            label="Nutzungsdauer Jahre"
            value={form.expectedUsefulLifeYears}
            hint={hints.expectedUsefulLifeYears}
            onChange={(value) => updateField("expectedUsefulLifeYears", value)}
          />
          <NumberField
            label="Versicherung pro Jahr"
            value={form.insurancePerYear}
            onChange={(value) => updateField("insurancePerYear", value)}
          />
          <NumberField
            label="Wartung pro Jahr"
            value={form.maintenanceCostsPerYear}
            onChange={(value) => updateField("maintenanceCostsPerYear", value)}
          />
          <NumberField
            label="Reparaturen pro Jahr"
            value={form.repairCostsPerYear}
            onChange={(value) => updateField("repairCostsPerYear", value)}
          />
          <NumberField
            label={isKm ? "Diesel je km" : "Diesel je Stunde"}
            value={form.fuelCostsPerHour}
            onChange={(value) => updateField("fuelCostsPerHour", value)}
          />
          <NumberField
            label={isKm ? "Fahrer je km" : "Fahrer je Stunde"}
            value={form.operatorCostsPerHour}
            onChange={(value) => updateField("operatorCostsPerHour", value)}
          />
        </fieldset>

        <fieldset className="form-section">
          <legend>Notizen</legend>
          <label>
            Notiz
            <textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} rows={3} />
          </label>
        </fieldset>

        {Object.keys(errors).length > 0 ? <p className="form-error">Bitte Pflichtfelder prüfen.</p> : null}
        {saveError ? <p className="form-error">{saveError}</p> : null}

        <div className="form-actions">
          {canCancel ? (
            <button className="button" type="button" onClick={onCancel}>
              Abbrechen
            </button>
          ) : null}
          <button className="button primary" type="submit" disabled={isSaving || !onSave}>
            {!onSave ? "Nicht verfügbar" : isSaving ? "Speichern..." : "Speichern"}
          </button>
        </div>
      </form>
    </section>
  );
}

type FieldProps = {
  label: string;
  value: string;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
};

function TextField({ label, value, error, onChange }: FieldProps) {
  return (
    <label>
      {label}
      <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />
      {error ? <span className="form-error">{error}</span> : null}
    </label>
  );
}

function NumberField({ label, value, error, hint, onChange }: FieldProps) {
  return (
    <label>
      {label}
      <input min="0" type="number" value={value} onChange={(event) => onChange(event.target.value)} />
      {error ? <span className="form-error">{error}</span> : null}
      {hint && !error ? <span className="form-hint">{hint}</span> : null}
    </label>
  );
}

function createInitialFormState(machine?: Machine): FormState {
  const unit: MachineUnit = machine?.unit ?? "hours";
  const currentReading =
    unit === "km" ? String(machine?.currentKilometers ?? 0) : String(machine?.currentOperatingHours ?? 0);
  const annualUsage =
    unit === "km" ? stringifyOptional(machine?.annualKilometers) : String(machine?.annualOperatingHours ?? "");

  return {
    name: machine?.name ?? "",
    category: machine?.category ?? "tractor",
    unit,
    currentReading,
    annualUsage,
    manufacturer: machine?.manufacturer ?? "",
    model: machine?.model ?? "",
    yearOfManufacture: String(machine?.yearOfManufacture ?? new Date().getFullYear()),
    purchasePrice: stringifyOptional(machine?.purchasePrice || null),
    currentValue: stringifyOptional(machine?.currentValue || null),
    residualValue: String(machine?.residualValue ?? 0),
    expectedUsefulLifeYears: stringifyOptional(machine?.expectedUsefulLifeYears || null),
    hectaresPerHour: stringifyOptional(machine?.hectaresPerHour),
    insurancePerYear: String(machine?.insurancePerYear ?? 0),
    maintenanceCostsPerYear: String(machine?.maintenanceCostsPerYear ?? 0),
    repairCostsPerYear: String(machine?.repairCostsPerYear ?? 0),
    fuelCostsPerHour: String(machine?.fuelCostsPerHour ?? 0),
    operatorCostsPerHour: String(machine?.operatorCostsPerHour ?? 0),
    notes: machine?.notes ?? ""
  };
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) {
    errors.name = "Name ist erforderlich.";
  }

  const reading = toNumber(form.currentReading);
  if (form.currentReading.trim() !== "" && reading < 0) {
    errors.currentReading = "Stand darf nicht negativ sein.";
  }

  return errors;
}

function createMachineInput(form: FormState, existingMachine?: Machine): CreateMachineInput {
  const isKm = form.unit === "km";
  const purchasePrice = toNumber(form.purchasePrice);
  const currentValue = toOptionalNumber(form.currentValue) ?? purchasePrice;
  const currentReading = toNumber(form.currentReading);

  return {
    farmId: existingMachine?.farmId ?? placeholderFarmId,
    name: form.name.trim(),
    category: form.category,
    unit: form.unit,
    manufacturer: form.manufacturer.trim() || "-",
    model: form.model.trim() || "-",
    yearOfManufacture: toNumber(form.yearOfManufacture) || new Date().getFullYear(),
    purchaseDate: existingMachine?.purchaseDate ?? null,
    purchasePrice,
    newPrice: existingMachine?.newPrice ?? purchasePrice,
    currentValue,
    residualValue: toNumber(form.residualValue),
    expectedUsefulLifeYears: toNumber(form.expectedUsefulLifeYears) || 10,
    annualOperatingHours: isKm ? 0 : toNumber(form.annualUsage),
    currentOperatingHours: isKm ? 0 : currentReading,
    currentKilometers: isKm ? currentReading : (existingMachine?.currentKilometers ?? null),
    workingWidthMeters: existingMachine?.workingWidthMeters ?? null,
    hectaresPerHour: toOptionalNumber(form.hectaresPerHour),
    insurancePerYear: toNumber(form.insurancePerYear),
    taxPerYear: existingMachine?.taxPerYear ?? 0,
    storagePerYear: existingMachine?.storagePerYear ?? 0,
    otherFixedCostsPerYear: existingMachine?.otherFixedCostsPerYear ?? 0,
    maintenanceCostsPerYear: toNumber(form.maintenanceCostsPerYear),
    repairCostsPerYear: toNumber(form.repairCostsPerYear),
    fuelCostsPerHour: toNumber(form.fuelCostsPerHour),
    operatorCostsPerHour: toNumber(form.operatorCostsPerHour),
    otherVariableCostsPerHour: existingMachine?.otherVariableCostsPerHour ?? 0,
    annualKilometers: isKm ? (toNumber(form.annualUsage) || null) : (existingMachine?.annualKilometers ?? null),
    status: existingMachine?.status ?? "active",
    notes: form.notes.trim() || null
  };
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  return toNumber(value);
}

function stringifyOptional(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}
