"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  getMachineCategoryLabel,
  placeholderFarmId,
  type CreateMachineInput,
  type Machine,
  type MachineCategory
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
  manufacturer: string;
  model: string;
  yearOfManufacture: string;
  purchasePrice: string;
  currentValue: string;
  residualValue: string;
  expectedUsefulLifeYears: string;
  annualOperatingHours: string;
  currentOperatingHours: string;
  hectaresPerHour: string;
  insurancePerYear: string;
  maintenanceCostsPerYear: string;
  repairCostsPerYear: string;
  fuelCostsPerHour: string;
  operatorCostsPerHour: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const categories: MachineCategory[] = ["tractor", "loader", "harvester", "grassland", "tillage", "transport", "other"];

export function MachineFormModal({ mode, formMode = "create", machine, onCancel, onSave }: MachineFormModalProps) {
  const [form, setForm] = useState<FormState>(() => createInitialFormState(machine));
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const title = formMode === "edit" ? "Maschine bearbeiten" : "Maschine anlegen";
  const helper = onSave ? "Pflichtfelder ausfuellen und speichern." : "Formular ist vorbereitet.";
  const className = mode === "page" ? "panel form-panel wide" : "panel form-panel";
  const canCancel = Boolean(onCancel);

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
        <span className="muted">{helper}</span>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <fieldset className="form-section">
          <legend>Stammdaten</legend>
          <TextField label="Name" value={form.name} error={errors.name} onChange={(value) => updateField("name", value)} />
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
          <TextField
            label="Hersteller"
            value={form.manufacturer}
            error={errors.manufacturer}
            onChange={(value) => updateField("manufacturer", value)}
          />
          <TextField label="Modell" value={form.model} error={errors.model} onChange={(value) => updateField("model", value)} />
          <NumberField
            label="Baujahr"
            value={form.yearOfManufacture}
            onChange={(value) => updateField("yearOfManufacture", value)}
          />
        </fieldset>

        <fieldset className="form-section">
          <legend>Nutzung</legend>
          <NumberField
            label="Stunden pro Jahr"
            value={form.annualOperatingHours}
            error={errors.annualOperatingHours}
            onChange={(value) => updateField("annualOperatingHours", value)}
          />
          <NumberField
            label="Betriebsstunden aktuell"
            value={form.currentOperatingHours}
            onChange={(value) => updateField("currentOperatingHours", value)}
          />
          <NumberField
            label="Hektar pro Stunde"
            value={form.hectaresPerHour}
            onChange={(value) => updateField("hectaresPerHour", value)}
          />
        </fieldset>

        <fieldset className="form-section">
          <legend>Kosten</legend>
          <NumberField
            label="Anschaffungspreis"
            value={form.purchasePrice}
            error={errors.purchasePrice}
            onChange={(value) => updateField("purchasePrice", value)}
          />
          <NumberField label="Aktueller Wert" value={form.currentValue} onChange={(value) => updateField("currentValue", value)} />
          <NumberField label="Restwert" value={form.residualValue} onChange={(value) => updateField("residualValue", value)} />
          <NumberField
            label="Nutzungsdauer Jahre"
            value={form.expectedUsefulLifeYears}
            error={errors.expectedUsefulLifeYears}
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
            label="Diesel je Stunde"
            value={form.fuelCostsPerHour}
            onChange={(value) => updateField("fuelCostsPerHour", value)}
          />
          <NumberField
            label="Fahrer je Stunde"
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
          <button className="button primary" type="submit" disabled={isSaving}>
            {isSaving ? "Speichern..." : "Speichern"}
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
  return {
    name: machine?.name ?? "",
    category: machine?.category ?? "tractor",
    manufacturer: machine?.manufacturer ?? "",
    model: machine?.model ?? "",
    yearOfManufacture: String(machine?.yearOfManufacture ?? new Date().getFullYear()),
    purchasePrice: String(machine?.purchasePrice ?? ""),
    currentValue: String(machine?.currentValue ?? ""),
    residualValue: String(machine?.residualValue ?? ""),
    expectedUsefulLifeYears: String(machine?.expectedUsefulLifeYears ?? ""),
    annualOperatingHours: String(machine?.annualOperatingHours ?? ""),
    currentOperatingHours: String(machine?.currentOperatingHours ?? 0),
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

  if (!form.manufacturer.trim()) {
    errors.manufacturer = "Hersteller ist erforderlich.";
  }

  if (!form.model.trim()) {
    errors.model = "Modell ist erforderlich.";
  }

  if (toNumber(form.purchasePrice) <= 0) {
    errors.purchasePrice = "Anschaffungspreis muss groesser als 0 sein.";
  }

  if (toNumber(form.expectedUsefulLifeYears) <= 0) {
    errors.expectedUsefulLifeYears = "Nutzungsdauer muss groesser als 0 sein.";
  }

  if (toNumber(form.annualOperatingHours) <= 0) {
    errors.annualOperatingHours = "Stunden pro Jahr muessen groesser als 0 sein.";
  }

  return errors;
}

function createMachineInput(form: FormState, existingMachine?: Machine): CreateMachineInput {
  const purchasePrice = toNumber(form.purchasePrice);
  const currentValue = toOptionalNumber(form.currentValue) ?? purchasePrice;

  return {
    farmId: existingMachine?.farmId ?? placeholderFarmId,
    name: form.name.trim(),
    category: form.category,
    manufacturer: form.manufacturer.trim(),
    model: form.model.trim(),
    yearOfManufacture: toNumber(form.yearOfManufacture) || new Date().getFullYear(),
    purchaseDate: existingMachine?.purchaseDate ?? null,
    purchasePrice,
    newPrice: existingMachine?.newPrice ?? purchasePrice,
    currentValue,
    residualValue: toNumber(form.residualValue),
    expectedUsefulLifeYears: toNumber(form.expectedUsefulLifeYears),
    annualOperatingHours: toNumber(form.annualOperatingHours),
    currentOperatingHours: toNumber(form.currentOperatingHours),
    currentKilometers: existingMachine?.currentKilometers ?? null,
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
    annualKilometers: existingMachine?.annualKilometers ?? null,
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
