"use client";

import { useState, type FormEvent } from "react";
import type { Machine } from "@/lib/app/machines";
import {
  getMaintenanceIntervalLabel,
  getMaintenanceStatusLabel,
  getMaintenanceTypeLabel,
  type CreateMaintenanceTaskInput,
  type MaintenanceIntervalType,
  type MaintenanceStatus,
  type MaintenanceTask,
  type MaintenanceType
} from "@/lib/app/maintenance";

type MaintenanceFormMode = "create" | "edit";

type MaintenanceFormModalProps = {
  mode: MaintenanceFormMode;
  machines: Machine[];
  task?: MaintenanceTask;
  onCancel: () => void;
  onSave: (input: CreateMaintenanceTaskInput) => Promise<void> | void;
};

type FormState = {
  machineId: string;
  title: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  dueDate: string;
  dueOperatingHours: string;
  dueKilometers: string;
  intervalType: MaintenanceIntervalType;
  intervalDays: string;
  intervalOperatingHours: string;
  intervalKilometers: string;
  estimatedCost: string;
  actualCost: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const maintenanceTypes: MaintenanceType[] = [
  "oil_change",
  "service",
  "lubrication",
  "repair",
  "wear_part",
  "inspection",
  "cleaning",
  "other"
];
const maintenanceStatuses: MaintenanceStatus[] = ["open", "planned", "in_progress", "completed", "cancelled"];
const intervalTypes: MaintenanceIntervalType[] = ["none", "days", "operating_hours", "kilometers"];

export function MaintenanceFormModal({ mode, machines, task, onCancel, onSave }: MaintenanceFormModalProps) {
  const [form, setForm] = useState<FormState>(() => createInitialFormState(task, machines));
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);

    try {
      await onSave(createMaintenanceTaskInput(form, machines, task));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel form-panel">
      <div className="panel-heading">
        <h2>{mode === "edit" ? "Wartung bearbeiten" : "Wartung anlegen"}</h2>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <fieldset className="form-section">
          <legend>Grunddaten</legend>
          <label>
            Maschine
            <select value={form.machineId} onChange={(event) => updateField("machineId", event.target.value)}>
              <option value="">Maschine waehlen</option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}
                </option>
              ))}
            </select>
            {errors.machineId ? <span className="form-error">{errors.machineId}</span> : null}
          </label>
          <TextField label="Aufgabe" value={form.title} error={errors.title} onChange={(value) => updateField("title", value)} />
          <label>
            Art
            <select value={form.type} onChange={(event) => updateField("type", event.target.value as MaintenanceType)}>
              {maintenanceTypes.map((type) => (
                <option key={type} value={type}>
                  {getMaintenanceTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => updateField("status", event.target.value as MaintenanceStatus)}>
              {maintenanceStatuses.map((status) => (
                <option key={status} value={status}>
                  {getMaintenanceStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <fieldset className="form-section">
          <legend>Faelligkeit</legend>
          <label>
            Datum
            <input type="date" value={form.dueDate} onChange={(event) => updateField("dueDate", event.target.value)} />
          </label>
          <NumberField
            label="Bei Stunden"
            value={form.dueOperatingHours}
            onChange={(value) => updateField("dueOperatingHours", value)}
          />
          <NumberField label="Bei Kilometern" value={form.dueKilometers} onChange={(value) => updateField("dueKilometers", value)} />
        </fieldset>

        <fieldset className="form-section">
          <legend>Wiederholung</legend>
          <label>
            Wiederholung
            <select
              value={form.intervalType}
              onChange={(event) => updateField("intervalType", event.target.value as MaintenanceIntervalType)}
            >
              {intervalTypes.map((intervalType) => (
                <option key={intervalType} value={intervalType}>
                  {getMaintenanceIntervalLabel(intervalType)}
                </option>
              ))}
            </select>
          </label>
          <NumberField label="Alle Tage" value={form.intervalDays} onChange={(value) => updateField("intervalDays", value)} />
          <NumberField
            label="Alle Stunden"
            value={form.intervalOperatingHours}
            onChange={(value) => updateField("intervalOperatingHours", value)}
          />
          <NumberField
            label="Alle Kilometer"
            value={form.intervalKilometers}
            onChange={(value) => updateField("intervalKilometers", value)}
          />
        </fieldset>

        <fieldset className="form-section">
          <legend>Kosten & Notizen</legend>
          <NumberField label="Geschaetzte Kosten" value={form.estimatedCost} onChange={(value) => updateField("estimatedCost", value)} />
          <NumberField label="Tatsaechliche Kosten" value={form.actualCost} onChange={(value) => updateField("actualCost", value)} />
          <label>
            Notiz
            <textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} rows={3} />
          </label>
        </fieldset>

        {Object.keys(errors).length > 0 ? <p className="form-error">Bitte Pflichtfelder pruefen.</p> : null}

        <div className="form-actions">
          <button className="button" type="button" onClick={onCancel}>
            Abbrechen
          </button>
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

function NumberField({ label, value, onChange }: FieldProps) {
  return (
    <label>
      {label}
      <input min="0" type="number" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function createInitialFormState(task: MaintenanceTask | undefined, machines: Machine[]): FormState {
  return {
    machineId: task?.machineId ?? machines[0]?.id ?? "",
    title: task?.title ?? "",
    type: task?.type ?? "service",
    status: task?.status ?? "open",
    dueDate: task?.dueDate ?? "",
    dueOperatingHours: stringifyOptional(task?.dueOperatingHours),
    dueKilometers: stringifyOptional(task?.dueKilometers),
    intervalType: task?.intervalType ?? "none",
    intervalDays: stringifyOptional(task?.intervalDays),
    intervalOperatingHours: stringifyOptional(task?.intervalOperatingHours),
    intervalKilometers: stringifyOptional(task?.intervalKilometers),
    estimatedCost: String(task?.estimatedCost ?? 0),
    actualCost: stringifyOptional(task?.actualCost),
    notes: task?.notes ?? ""
  };
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.machineId) {
    errors.machineId = "Maschine ist erforderlich.";
  }

  if (!form.title.trim()) {
    errors.title = "Aufgabe ist erforderlich.";
  }

  if (!form.type) {
    errors.type = "Art ist erforderlich.";
  }

  if (!form.intervalType) {
    errors.intervalType = "Wiederholung ist erforderlich.";
  }

  return errors;
}

function createMaintenanceTaskInput(
  form: FormState,
  machines: Machine[],
  existingTask?: MaintenanceTask
): CreateMaintenanceTaskInput {
  const selectedMachine = machines.find((machine) => machine.id === form.machineId);

  return {
    farmId: existingTask?.farmId ?? selectedMachine?.farmId ?? "00000000-0000-4000-8000-000000000001",
    machineId: form.machineId,
    title: form.title.trim(),
    type: form.type,
    customTitle: null,
    status: form.status,
    dueDate: form.dueDate || null,
    dueOperatingHours: toOptionalNumber(form.dueOperatingHours),
    dueKilometers: toOptionalNumber(form.dueKilometers),
    intervalType: form.intervalType,
    intervalDays: toOptionalNumber(form.intervalDays),
    intervalMonths: null,
    intervalOperatingHours: toOptionalNumber(form.intervalOperatingHours),
    intervalKilometers: toOptionalNumber(form.intervalKilometers),
    estimatedCost: toNumber(form.estimatedCost),
    actualCost: toOptionalNumber(form.actualCost),
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
