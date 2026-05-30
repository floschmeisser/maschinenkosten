"use client";

import { useState } from "react";
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

export function MachineFormModal({ mode, formMode = "create", machine, onCancel, onSave }: MachineFormModalProps) {
  const [form, setForm] = useState<FormState>(() => createInitialFormState(machine));
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const title = formMode === "edit" ? "Maschine bearbeiten" : "Maschine anlegen";
  const className = mode === "page" ? "panel form-panel wide" : "panel form-panel";
  const canCancel = Boolean(onCancel);
  const isKm = form.unit === "km";

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !onSave) {
      return;
    }

    setIsSaving(true);

    try {
      await onSave(createMachineInput(form, machine));
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
          <NumberField label="Aktueller Wert" value={form.currentValue} onChange={(value) => updateField("currentValue", value)} />
          <NumberField label="Restwert" value={form.residualValue} onChange={(value) => updateField("residualValue", value)} />
          <NumberField
            label="Nutzungsdauer Jahre"
            value={form.expectedUsefulLifeYears}
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

        {Object.keys(errors).length > 0 ? <p className="form-error">Bitte Pflichtfelder pruefen.</p> : null}

        <div className="form-actions">
          {canCancel ? (
            <button className="button" type="button" onClick={onCancel}>
              Abbrechen
            </button>
          ) : null}
          <button className="button primary" type="submit" disabled={isSaving || !onSave}>
            {!onSave ? "Nicht verfuegbar" : isSaving ? "Speichern..." : "Speichern"}
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

function NumberField({ label, value, error, onChange }: FieldProps) {
  return (
    <label>
      {label}
      <input min="0" type="number" value={value} onChange={(event) => onChange(event.target.value)} />
      {error ? <span className="form-error">{error}</span> : null}
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
