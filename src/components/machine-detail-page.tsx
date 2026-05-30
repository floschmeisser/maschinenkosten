"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber } from "@/lib/app/format";
import type { Machine, MachineSummary } from "@/lib/app/machines";
import {
  formatMachineReading,
  getMachineById as getPlaceholderMachineById,
  getMachineCurrentReading,
  getMachineUnitLabel,
  toMachineSummary,
  validateMachineUsageUpdate
} from "@/lib/app/machines";
import { getMachineById, updateMachine } from "@/lib/app/machines-database";
import { getMachineSpareParts } from "@/lib/app/machine-spare-parts-database";
import type { MachineSparePart } from "@/lib/app/machines";
import {
  completeMaintenanceTask,
  createMaintenanceTask,
  getMaintenanceTasksByMachine
} from "@/lib/app/maintenance-database";
import {
  getMaintenanceDisplayStatus,
  getMaintenanceRecurrenceLabel,
  getMaintenanceTypeLabel,
  getMostRelevantDueLabel,
  sortMaintenanceTasksByUrgency,
  type CompleteMaintenanceTaskInput,
  type CreateMaintenanceTaskInput,
  type MaintenanceDisplayStatus,
  type MaintenanceTask,
  type MaintenanceType
} from "@/lib/app/maintenance";
import { MachineSpareParts } from "./machine-spare-parts";
import { calculateMachineCosts, createCostInputFromOverride } from "@/lib/app/cost-calculation";
import { getMachineCostOverride, upsertMachineCostOverride, type MachineCostOverride } from "@/lib/app/machine-cost-overrides-database";
import { oeklCategoryOptions } from "@/lib/app/oekl-reference";
import { formatCurrency } from "@/lib/app/format";
import type { MachineCostInput } from "@/lib/app/financials";

type Tab = "wartung" | "kosten";

const STANDARD_TYPES: MaintenanceType[] = [
  "oil_engine",
  "oil_hydraulic",
  "filter_air",
  "filter_fuel",
  "filter_hydraulic",
  "filter_cabin",
  "lubrication",
  "service",
  "inspection_57a",
  "brakes_tires",
  "ac_service",
  "general_check"
];

type MachineDetailPageClientProps = {
  locale: Locale;
  machineId: string;
};

export function MachineDetailPageClient({ locale, machineId }: MachineDetailPageClientProps) {
  const [machine, setMachine] = useState<MachineSummary | null>(
    () => getPlaceholderMachineById(machineId) ?? null
  );
  const [hasLoaded, setHasLoaded] = useState(
    () => getPlaceholderMachineById(machineId) !== undefined
  );

  useEffect(() => {
    let active = true;

    getMachineById(machineId)
      .then((data) => {
        if (!active) return;
        setMachine(data ? toMachineSummary(data) : (getPlaceholderMachineById(machineId) ?? null));
        setHasLoaded(true);
      })
      .catch(() => {
        if (active) setHasLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [machineId]);

  if (!hasLoaded) {
    return (
      <main className="page">
        <p className="preference-hint">Laden...</p>
      </main>
    );
  }

  if (!machine) {
    return (
      <main className="page">
        <h1>Maschine nicht gefunden</h1>
        <p className="muted">ID: {machineId}</p>
      </main>
    );
  }

  return <MachineDetailPage locale={locale} machine={machine} onMachineUpdated={setMachine} />;
}

type MachineDetailPageProps = {
  locale: Locale;
  machine: MachineSummary;
  onMachineUpdated: (machine: MachineSummary) => void;
};

function MachineDetailPage({ locale, machine, onMachineUpdated }: MachineDetailPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("wartung");
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  const refreshTasks = useCallback(async () => {
    setIsLoadingTasks(true);

    try {
      const data = await getMaintenanceTasksByMachine(machine.id);
      setTasks(sortMaintenanceTasksByUrgency(data, [machine]));
    } catch {
      setTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [machine]);

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  async function handleUsageUpdate(reading: number) {
    const updateInput =
      machine.unit === "km"
        ? { currentKilometers: reading }
        : { currentOperatingHours: reading };

    const errors = validateMachineUsageUpdate(updateInput, machine);

    if (errors.length > 0) {
      return errors;
    }

    const updated = await updateMachine(machine.id, updateInput);

    if (updated) {
      onMachineUpdated(toMachineSummary(updated));
      void refreshTasks();
    }

    return [];
  }

  async function handleCompleteTask(taskId: string, data: CompleteMaintenanceTaskInput) {
    await completeMaintenanceTask(taskId, data);
    await refreshTasks();
  }

  async function handleCreateTask(input: CreateMaintenanceTaskInput) {
    await createMaintenanceTask(input);
    await refreshTasks();
  }

  return (
    <main className="page machine-detail-v2">
      <section className="machine-detail-header">
        <div>
          <span className="machine-detail-category">{machine.displayCategory}</span>
          <h1 className="machine-detail-name">{machine.name}</h1>
          <p className="machine-detail-meta">{machine.manufacturer} {machine.model} &middot; {machine.yearOfManufacture}</p>
        </div>
      </section>

      <nav className="detail-tabs" aria-label="Module">
        <button
          className={activeTab === "wartung" ? "tab-button active" : "tab-button"}
          type="button"
          onClick={() => setActiveTab("wartung")}
        >
          Wartung
        </button>
        <button
          className={activeTab === "kosten" ? "tab-button active" : "tab-button"}
          type="button"
          onClick={() => setActiveTab("kosten")}
        >
          Kosten
        </button>
      </nav>

      {activeTab === "wartung" ? (
        <MachineWartungModule
          locale={locale}
          machine={machine}
          tasks={tasks}
          isLoading={isLoadingTasks}
          onUsageUpdate={handleUsageUpdate}
          onCompleteTask={handleCompleteTask}
          onCreateTask={handleCreateTask}
        />
      ) : (
        <MachineKostenModule machine={machine} />
      )}
    </main>
  );
}

type WartungModuleProps = {
  locale: Locale;
  machine: MachineSummary;
  tasks: MaintenanceTask[];
  isLoading: boolean;
  onUsageUpdate: (reading: number) => Promise<string[]>;
  onCompleteTask: (taskId: string, data: CompleteMaintenanceTaskInput) => Promise<void>;
  onCreateTask: (input: CreateMaintenanceTaskInput) => Promise<void>;
};

function MachineWartungModule({
  locale,
  machine,
  tasks,
  isLoading,
  onUsageUpdate,
  onCompleteTask,
  onCreateTask
}: WartungModuleProps) {
  const [isUpdatingStand, setIsUpdatingStand] = useState(false);
  const [showSparePartsKey, setShowSparePartsKey] = useState(0);
  const [showSpareParts, setShowSpareParts] = useState(false);
  const currentReading = getMachineCurrentReading(machine);
  const unit = getMachineUnitLabel(machine.unit);

  const standardCards = STANDARD_TYPES.map((type) => {
    const typeTasks = tasks.filter((t) => t.type === type && t.status !== "cancelled");
    const activeTasks = typeTasks.filter((t) => t.status !== "completed");
    const completedTasks = typeTasks.filter((t) => t.status === "completed");
    const activeTask = activeTasks[0] ?? null;
    const lastCompleted = [...completedTasks].sort((a, b) =>
      (b.completedAt ?? "").localeCompare(a.completedAt ?? "")
    )[0] ?? null;

    return { type, activeTask, lastCompleted };
  });

  const customTasks = tasks.filter(
    (t) => t.type === "custom" || (t.type === "other" && t.status !== "cancelled")
  );

  return (
    <>
      <section className="stand-section">
        <div className="stand-display">
          <span className="stand-label">Aktueller Stand</span>
          <strong className="stand-value">{formatMachineReading(machine)}</strong>
        </div>
        <button
          className="button primary large-action stand-update-btn"
          type="button"
          onClick={() => setIsUpdatingStand((v) => !v)}
        >
          {isUpdatingStand ? "Schliessen" : "Stand aktualisieren"}
        </button>
        {isUpdatingStand ? (
          <StandUpdateForm
            machine={machine}
            currentReading={currentReading}
            unit={unit}
            onSave={async (value) => {
              const errors = await onUsageUpdate(value);

              if (errors.length === 0) {
                setIsUpdatingStand(false);
              }

              return errors;
            }}
            onCancel={() => setIsUpdatingStand(false)}
          />
        ) : null}
      </section>

      <section className="maintenance-types-section">
        {isLoading ? <p className="preference-hint">Laden...</p> : null}
        {standardCards.map(({ type, activeTask, lastCompleted }) => (
          <MaintenanceTypeCard
            key={type}
            type={type}
            machine={machine}
            activeTask={activeTask}
            lastCompleted={lastCompleted}
            onComplete={onCompleteTask}
            onCreate={(months, hours, km) =>
              onCreateTask({
                farmId: machine.farmId,
                machineId: machine.id,
                title: getMaintenanceTypeLabel(type),
                type,
                customTitle: null,
                status: "open",
                dueDate: null,
                dueOperatingHours: hours ?? null,
                dueKilometers: km ?? null,
                intervalType: months !== null ? "months" : hours !== null || km !== null ? "operating_hours" : "none",
                intervalDays: null,
                intervalMonths: months ?? null,
                intervalOperatingHours: hours ?? null,
                intervalKilometers: km ?? null,
                estimatedCost: 0,
                actualCost: null,
                notes: null
              })
            }
          />
        ))}

        {customTasks.length > 0 || true ? (
          <AddCustomMaintenanceCard
            machine={machine}
            onAdd={(title, months, hours, km) =>
              onCreateTask({
                farmId: machine.farmId,
                machineId: machine.id,
                title,
                type: "custom",
                customTitle: title,
                status: "open",
                dueDate: null,
                dueOperatingHours: hours ?? null,
                dueKilometers: km ?? null,
                intervalType: months !== null ? "months" : hours !== null || km !== null ? "operating_hours" : "none",
                intervalDays: null,
                intervalMonths: months ?? null,
                intervalOperatingHours: hours ?? null,
                intervalKilometers: km ?? null,
                estimatedCost: 0,
                actualCost: null,
                notes: null
              })
            }
          />
        ) : null}
      </section>

      <section className="spare-parts-section">
        <button
          className="spare-parts-toggle"
          type="button"
          onClick={() => {
            setShowSpareParts((v) => !v);
            if (!showSpareParts) {
              setShowSparePartsKey((k) => k + 1);
            }
          }}
        >
          <span>Ersatzteile</span>
          <span className="toggle-arrow">{showSpareParts ? "▲" : "▼"}</span>
        </button>
        {showSpareParts ? (
          <MachineSpareParts key={showSparePartsKey} createSignal={showSparePartsKey} machine={machine} />
        ) : null}
      </section>
    </>
  );
}

type StandUpdateFormProps = {
  machine: Machine;
  currentReading: number;
  unit: string;
  onSave: (value: number) => Promise<string[]>;
  onCancel: () => void;
};

function StandUpdateForm({ machine, currentReading, unit, onSave, onCancel }: StandUpdateFormProps) {
  const [value, setValue] = useState(String(currentReading));
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const num = Number(value);

    if (!Number.isFinite(num) || num < 0) {
      setErrors(["Ungültiger Wert."]);
      return;
    }

    setIsSaving(true);
    const errs = await onSave(num);
    setIsSaving(false);

    if (errs.length > 0) {
      setErrors(errs);
    }
  }

  return (
    <form className="stand-update-form" onSubmit={handleSubmit}>
      <label>
        Neuer Stand ({unit})
        <input
          inputMode="decimal"
          min={currentReading}
          step="0.1"
          type="number"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setErrors([]);
          }}
        />
      </label>
      {errors.map((err) => (
        <p className="field-error" key={err}>{err}</p>
      ))}
      <div className="form-actions">
        <button className="button" type="button" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="button primary" type="submit" disabled={isSaving}>
          {isSaving ? "Speichern..." : `Speichern`}
        </button>
      </div>
    </form>
  );
}

type MaintenanceTypeCardProps = {
  type: MaintenanceType;
  machine: MachineSummary;
  activeTask: MaintenanceTask | null;
  lastCompleted: MaintenanceTask | null;
  onComplete: (taskId: string, data: CompleteMaintenanceTaskInput) => Promise<void>;
  onCreate: (months: number | null, hours: number | null, km: number | null) => Promise<void>;
};

function MaintenanceTypeCard({
  type,
  machine,
  activeTask,
  lastCompleted,
  onComplete,
  onCreate
}: MaintenanceTypeCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const label = getMaintenanceTypeLabel(type);
  const unit = getMachineUnitLabel(machine.unit);
  const urgency: MaintenanceDisplayStatus = activeTask
    ? getMaintenanceDisplayStatus(activeTask, machine)
    : "planned";

  if (!activeTask && !lastCompleted && !isAdding) {
    return (
      <article className="maintenance-type-card inactive">
        <div className="type-card-head">
          <span className="type-card-label">{label}</span>
          <button className="button" type="button" onClick={() => setIsAdding(true)}>
            Aktivieren
          </button>
        </div>
      </article>
    );
  }

  if (isAdding) {
    return (
      <article className="maintenance-type-card">
        <div className="type-card-head">
          <span className="type-card-label">{label}</span>
        </div>
        <QuickAddForm
          machine={machine}
          onSave={async (months, hours, km) => {
            setIsSaving(true);
            await onCreate(months, hours, km);
            setIsSaving(false);
            setIsAdding(false);
          }}
          onCancel={() => setIsAdding(false)}
          isSaving={isSaving}
        />
      </article>
    );
  }

  if (isCompleting && activeTask) {
    return (
      <article className="maintenance-type-card">
        <div className="type-card-head">
          <span className="type-card-label">{label}</span>
        </div>
        <QuickCompleteForm
          machine={machine}
          task={activeTask}
          onSave={async (data) => {
            setIsSaving(true);
            await onComplete(activeTask.id, data);
            setIsSaving(false);
            setIsCompleting(false);
          }}
          onCancel={() => setIsCompleting(false)}
          isSaving={isSaving}
        />
      </article>
    );
  }

  return (
    <article className={`maintenance-type-card ${urgency}`}>
      <div className="type-card-head">
        <span className="type-card-label">{label}</span>
        {activeTask ? (
          <span className={`urgency-chip ${urgency}`}>
            {urgency === "due" ? "Faellig" : urgency === "soon" ? "Bald" : ""}
          </span>
        ) : null}
      </div>

      <dl className="type-card-info">
        <div>
          <dt>Zuletzt</dt>
          <dd>
            {lastCompleted
              ? `${lastCompleted.completedAt ? formatDate(lastCompleted.completedAt) : "-"}${lastCompleted.lastDoneReading !== null ? ` / ${formatNumber(lastCompleted.lastDoneReading)} ${unit}` : ""}`
              : "Noch nicht erledigt"}
          </dd>
        </div>
        <div>
          <dt>Naechste Faelligkeit</dt>
          <dd>
            {activeTask
              ? getMostRelevantDueLabel(activeTask, machine)
              : "-"}
          </dd>
        </div>
        {activeTask && (activeTask.intervalMonths !== null || activeTask.intervalOperatingHours !== null || activeTask.intervalKilometers !== null) ? (
          <div>
            <dt>Intervall</dt>
            <dd>{getMaintenanceRecurrenceLabel(activeTask)}</dd>
          </div>
        ) : null}
      </dl>

      <div className="type-card-actions">
        {activeTask && urgency !== "completed" ? (
          <button className="button primary large-action" type="button" onClick={() => setIsCompleting(true)}>
            Erledigt
          </button>
        ) : null}
        {!activeTask ? (
          <button className="button" type="button" onClick={() => setIsAdding(true)}>
            Aktivieren
          </button>
        ) : null}
      </div>
    </article>
  );
}

type QuickAddFormProps = {
  machine: Machine;
  isSaving: boolean;
  onSave: (months: number | null, hours: number | null, km: number | null) => Promise<void>;
  onCancel: () => void;
};

function QuickAddForm({ machine, isSaving, onSave, onCancel }: QuickAddFormProps) {
  const [months, setMonths] = useState("");
  const [reading, setReading] = useState("");
  const unit = getMachineUnitLabel(machine.unit);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const m = months.trim() ? Number(months) : null;
    const r = reading.trim() ? Number(reading) : null;

    await onSave(
      m && Number.isFinite(m) ? m : null,
      machine.unit === "hours" && r !== null ? r : null,
      machine.unit === "km" && r !== null ? r : null
    );
  }

  return (
    <form className="quick-add-form" onSubmit={handleSubmit}>
      <label>
        Alle … Monate (optional)
        <input inputMode="numeric" min="1" type="number" value={months} onChange={(e) => setMonths(e.target.value)} />
      </label>
      <label>
        Alle … {unit} (optional)
        <input inputMode="decimal" min="1" type="number" value={reading} onChange={(e) => setReading(e.target.value)} />
      </label>
      <div className="form-actions">
        <button className="button" type="button" onClick={onCancel}>Abbrechen</button>
        <button className="button primary" type="submit" disabled={isSaving}>{isSaving ? "..." : "Speichern"}</button>
      </div>
    </form>
  );
}

type QuickCompleteFormProps = {
  machine: Machine;
  task: MaintenanceTask;
  isSaving: boolean;
  onSave: (data: CompleteMaintenanceTaskInput) => Promise<void>;
  onCancel: () => void;
};

function QuickCompleteForm({ machine, task, isSaving, onSave, onCancel }: QuickCompleteFormProps) {
  const currentReading = getMachineCurrentReading(machine);
  const unit = getMachineUnitLabel(machine.unit);
  const [completedAt, setCompletedAt] = useState(new Date().toISOString().slice(0, 10));
  const [reading, setReading] = useState(String(currentReading));
  const [cost, setCost] = useState(String(task.estimatedCost ?? ""));
  const [notes, setNotes] = useState(task.notes ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const r = reading.trim() ? Number(reading) : null;
    await onSave({
      completedAt,
      currentReading: r && Number.isFinite(r) ? r : null,
      actualCost: cost.trim() ? Number(cost) : null,
      notes: notes.trim() || null
    });
  }

  return (
    <form className="quick-complete-form" onSubmit={handleSubmit}>
      <label>
        Erledigt am
        <input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} />
      </label>
      <label>
        Stand bei Erledigung ({unit})
        <input inputMode="decimal" min="0" step="0.1" type="number" value={reading} onChange={(e) => setReading(e.target.value)} />
      </label>
      <label>
        Kosten (€)
        <input inputMode="decimal" min="0" step="0.01" type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
      </label>
      <label>
        Notiz
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="form-actions">
        <button className="button" type="button" onClick={onCancel}>Abbrechen</button>
        <button className="button primary" type="submit" disabled={isSaving}>{isSaving ? "..." : "Erledigt speichern"}</button>
      </div>
    </form>
  );
}

type AddCustomMaintenanceCardProps = {
  machine: Machine;
  onAdd: (title: string, months: number | null, hours: number | null, km: number | null) => Promise<void>;
};

function AddCustomMaintenanceCard({ machine, onAdd }: AddCustomMaintenanceCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [months, setMonths] = useState("");
  const [reading, setReading] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const unit = getMachineUnitLabel(machine.unit);

  if (!isOpen) {
    return (
      <button className="button add-custom-maintenance-btn" type="button" onClick={() => setIsOpen(true)}>
        + Eigene Wartung anlegen
      </button>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) return;

    setIsSaving(true);
    const m = months.trim() ? Number(months) : null;
    const r = reading.trim() ? Number(reading) : null;

    await onAdd(
      title.trim(),
      m && Number.isFinite(m) ? m : null,
      machine.unit === "hours" && r !== null ? r : null,
      machine.unit === "km" && r !== null ? r : null
    );

    setIsSaving(false);
    setIsOpen(false);
    setTitle("");
    setMonths("");
    setReading("");
  }

  return (
    <article className="maintenance-type-card add-custom">
      <div className="type-card-head">
        <span className="type-card-label">Eigene Wartung</span>
      </div>
      <form className="quick-add-form" onSubmit={handleSubmit}>
        <label>
          Bezeichnung
          <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Alle … Monate (optional)
          <input inputMode="numeric" min="1" type="number" value={months} onChange={(e) => setMonths(e.target.value)} />
        </label>
        <label>
          Alle … {unit} (optional)
          <input inputMode="decimal" min="1" type="number" value={reading} onChange={(e) => setReading(e.target.value)} />
        </label>
        <div className="form-actions">
          <button className="button" type="button" onClick={() => setIsOpen(false)}>Abbrechen</button>
          <button className="button primary" type="submit" disabled={isSaving || !title.trim()}>
            {isSaving ? "..." : "Anlegen"}
          </button>
        </div>
      </form>
    </article>
  );
}

type KostenFormState = {
  oeklCategory: string;
  purchasePrice: string;
  residualValue: string;
  expectedUsefulLifeYears: string;
  annualOperatingHours: string;
  annualKilometers: string;
  insurancePerYear: string;
  taxPerYear: string;
  storagePerYear: string;
  otherFixedCostsPerYear: string;
  maintenanceCostsPerYear: string;
  repairCostsPerYear: string;
  fuelCostsPerUnit: string;
  operatorCostsPerUnit: string;
  otherVariableCostsPerUnit: string;
  hectaresPerHour: string;
};

type MachineKostenModuleProps = {
  machine: Machine;
};

function MachineKostenModule({ machine }: MachineKostenModuleProps) {
  const isKm = machine.unit === "km";
  const perUnitLabel = isKm ? "/km" : "/h";
  const annualUsageLabel = isKm ? "km/Jahr" : "h/Jahr";

  const [override, setOverride] = useState<MachineCostOverride | null>(null);
  const [form, setForm] = useState<KostenFormState>(() => buildKostenFormState(machine, null));
  const [isSaving, setIsSaving] = useState(false);
  const [showFixedDetail, setShowFixedDetail] = useState(false);
  const [showVariableDetail, setShowVariableDetail] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    getMachineCostOverride(machine.id).then((existing) => {
      setOverride(existing);
      setForm(buildKostenFormState(machine, existing));
    });
  }, [machine]);

  const costInput = buildCostInputFromForm(machine, form);
  const result = calculateMachineCosts(costInput);
  const primaryKpi = isKm ? result.costPerKilometer : result.costPerOperatingHour;
  const primaryLabel = isKm ? "€/km" : "€/h";

  function updateField(key: keyof KostenFormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setSavedAt(null);
  }

  function applyOeklCategory(categoryKey: string) {
    const oekl = oeklCategoryOptions.find((o) => o.key === categoryKey);
    if (!oekl) return;
    const updated = { ...form, oeklCategory: categoryKey };
    const merged = createCostInputFromOverride(machine, override, categoryKey);
    setForm({
      ...updated,
      purchasePrice: merged.purchasePrice > 0 ? String(merged.purchasePrice) : form.purchasePrice,
      residualValue: String(Math.round(merged.residualValue)),
      expectedUsefulLifeYears: merged.expectedUsefulLifeYears > 0 ? String(merged.expectedUsefulLifeYears) : form.expectedUsefulLifeYears,
      annualOperatingHours: merged.annualOperatingHours > 0 ? String(merged.annualOperatingHours) : form.annualOperatingHours,
      annualKilometers: merged.annualKilometers !== null ? String(merged.annualKilometers) : form.annualKilometers,
      insurancePerYear: String(merged.insurancePerYear),
      taxPerYear: String(merged.taxPerYear),
      storagePerYear: String(merged.storagePerYear),
      otherFixedCostsPerYear: String(merged.otherFixedCostsPerYear),
      maintenanceCostsPerYear: String(merged.maintenanceCostsPerYear),
      repairCostsPerYear: String(merged.repairCostsPerYear),
      fuelCostsPerUnit: String(merged.fuelCostsPerHour),
      operatorCostsPerUnit: String(merged.operatorCostsPerHour),
      otherVariableCostsPerUnit: String(merged.otherVariableCostsPerHour),
      hectaresPerHour: merged.hectaresPerHour !== null ? String(merged.hectaresPerHour) : form.hectaresPerHour
    });
    setSavedAt(null);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const input = buildCostInputFromForm(machine, form);
      const saved = await upsertMachineCostOverride({
        farmId: machine.farmId,
        machineId: machine.id,
        oeklCategory: form.oeklCategory || null,
        purchasePrice: input.purchasePrice,
        residualValue: input.residualValue,
        expectedUsefulLifeYears: input.expectedUsefulLifeYears,
        annualOperatingHours: input.annualOperatingHours,
        annualKilometers: input.annualKilometers,
        insurancePerYear: input.insurancePerYear,
        taxPerYear: input.taxPerYear,
        storagePerYear: input.storagePerYear,
        otherFixedCostsPerYear: input.otherFixedCostsPerYear,
        maintenanceCostsPerYear: input.maintenanceCostsPerYear,
        repairCostsPerYear: input.repairCostsPerYear,
        fuelCostsPerHour: input.fuelCostsPerHour,
        operatorCostsPerHour: input.operatorCostsPerHour,
        otherVariableCostsPerHour: input.otherVariableCostsPerHour,
        hectaresPerHour: input.hectaresPerHour
      });
      setOverride(saved);
      setSavedAt(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="kosten-module">
      <div className="kosten-kpi-hero">
        <span className="kosten-kpi-label">{primaryLabel}</span>
        <strong className="kosten-kpi-value">
          {primaryKpi === null ? "—" : formatCurrency(primaryKpi)}
        </strong>
        <span className="kosten-kpi-sub">{formatCurrency(result.totalAnnualCosts)} / Jahr</span>
      </div>

      <form className="kosten-form" onSubmit={handleSave}>
        <div className="kosten-section-head">
          <label className="kosten-oekl-label">
            ÖKL-Kategorie
            <select
              value={form.oeklCategory}
              onChange={(e) => applyOeklCategory(e.target.value)}
            >
              <option value="">— eigene Eingabe —</option>
              {oeklCategoryOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="kosten-fieldset">
          <legend>Anschaffung &amp; Abschreibung</legend>
          <KostenField label="Kaufpreis" value={form.purchasePrice} unit="€" onChange={(v) => updateField("purchasePrice", v)} />
          <KostenField label="Restwert" value={form.residualValue} unit="€" onChange={(v) => updateField("residualValue", v)} />
          <KostenField label="Nutzungsdauer" value={form.expectedUsefulLifeYears} unit="Jahre" onChange={(v) => updateField("expectedUsefulLifeYears", v)} />
          <KostenField label={annualUsageLabel} value={isKm ? form.annualKilometers : form.annualOperatingHours} unit={isKm ? "km" : "h"} onChange={(v) => updateField(isKm ? "annualKilometers" : "annualOperatingHours", v)} />
          {!isKm && (
            <KostenField label="Hektar/h" value={form.hectaresPerHour} unit="ha/h" onChange={(v) => updateField("hectaresPerHour", v)} />
          )}
        </fieldset>

        <div className="kosten-result-row">
          <button className="kosten-detail-toggle" type="button" onClick={() => setShowFixedDetail((v) => !v)}>
            <span>Fixkosten/Jahr</span>
            <strong>{formatCurrency(result.fixedCosts.annualFixedCosts)}</strong>
            <span>{showFixedDetail ? "▲" : "▼"}</span>
          </button>
          {showFixedDetail && (
            <div className="kosten-detail-grid">
              <KostenField label="Versicherung/Jahr" value={form.insurancePerYear} unit="€" onChange={(v) => updateField("insurancePerYear", v)} />
              <KostenField label="Steuer/Jahr" value={form.taxPerYear} unit="€" onChange={(v) => updateField("taxPerYear", v)} />
              <KostenField label="Unterstand/Jahr" value={form.storagePerYear} unit="€" onChange={(v) => updateField("storagePerYear", v)} />
              <KostenField label="Sonstige Fix/Jahr" value={form.otherFixedCostsPerYear} unit="€" onChange={(v) => updateField("otherFixedCostsPerYear", v)} />
            </div>
          )}
        </div>

        <div className="kosten-result-row">
          <button className="kosten-detail-toggle" type="button" onClick={() => setShowVariableDetail((v) => !v)}>
            <span>Variable Kosten{perUnitLabel}</span>
            <strong>{formatCurrency(result.variableCosts.variableCostsPerHour)}</strong>
            <span>{showVariableDetail ? "▲" : "▼"}</span>
          </button>
          {showVariableDetail && (
            <div className="kosten-detail-grid">
              <KostenField label={`Wartung/Jahr`} value={form.maintenanceCostsPerYear} unit="€" onChange={(v) => updateField("maintenanceCostsPerYear", v)} />
              <KostenField label={`Reparatur/Jahr`} value={form.repairCostsPerYear} unit="€" onChange={(v) => updateField("repairCostsPerYear", v)} />
              <KostenField label={`Diesel${perUnitLabel}`} value={form.fuelCostsPerUnit} unit="€" onChange={(v) => updateField("fuelCostsPerUnit", v)} />
              <KostenField label={`Fahrer${perUnitLabel}`} value={form.operatorCostsPerUnit} unit="€" onChange={(v) => updateField("operatorCostsPerUnit", v)} />
              <KostenField label={`Sonstiges${perUnitLabel}`} value={form.otherVariableCostsPerUnit} unit="€" onChange={(v) => updateField("otherVariableCostsPerUnit", v)} />
            </div>
          )}
        </div>

        <div className="kosten-form-actions">
          {savedAt !== null && <span className="muted">Gespeichert {savedAt}</span>}
          <button className="button primary" type="submit" disabled={isSaving}>
            {isSaving ? "Speichern..." : "Werte speichern"}
          </button>
        </div>
      </form>
    </section>
  );
}

type KostenFieldProps = {
  label: string;
  value: string;
  unit: string;
  onChange: (value: string) => void;
};

function KostenField({ label, value, unit, onChange }: KostenFieldProps) {
  return (
    <label className="kosten-field">
      <span className="kosten-field-label">{label}</span>
      <div className="kosten-field-input-row">
        <input
          type="number"
          min="0"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="kosten-field-unit">{unit}</span>
      </div>
    </label>
  );
}

function buildKostenFormState(machine: Machine, existing: MachineCostOverride | null): KostenFormState {
  const input = createCostInputFromOverride(machine, existing);
  return {
    oeklCategory: existing?.oeklCategory ?? "",
    purchasePrice: String(input.purchasePrice),
    residualValue: String(Math.round(input.residualValue)),
    expectedUsefulLifeYears: String(input.expectedUsefulLifeYears),
    annualOperatingHours: String(input.annualOperatingHours),
    annualKilometers: input.annualKilometers !== null ? String(input.annualKilometers) : "",
    insurancePerYear: String(input.insurancePerYear),
    taxPerYear: String(input.taxPerYear),
    storagePerYear: String(input.storagePerYear),
    otherFixedCostsPerYear: String(input.otherFixedCostsPerYear),
    maintenanceCostsPerYear: String(input.maintenanceCostsPerYear),
    repairCostsPerYear: String(input.repairCostsPerYear),
    fuelCostsPerUnit: String(input.fuelCostsPerHour),
    operatorCostsPerUnit: String(input.operatorCostsPerHour),
    otherVariableCostsPerUnit: String(input.otherVariableCostsPerHour),
    hectaresPerHour: input.hectaresPerHour !== null ? String(input.hectaresPerHour) : ""
  };
}

function buildCostInputFromForm(machine: Machine, form: KostenFormState): MachineCostInput {
  const n = (v: string) => (v.trim() === "" ? 0 : Number(v) || 0);
  const nOpt = (v: string): number | null => (v.trim() === "" ? null : Number(v) || null);
  return {
    unit: machine.unit,
    purchasePrice: n(form.purchasePrice),
    currentValue: machine.currentValue,
    residualValue: n(form.residualValue),
    expectedUsefulLifeYears: n(form.expectedUsefulLifeYears),
    annualOperatingHours: n(form.annualOperatingHours),
    currentOperatingHours: machine.currentOperatingHours,
    currentKilometers: machine.currentKilometers,
    hectaresPerHour: nOpt(form.hectaresPerHour),
    insurancePerYear: n(form.insurancePerYear),
    taxPerYear: n(form.taxPerYear),
    storagePerYear: n(form.storagePerYear),
    otherFixedCostsPerYear: n(form.otherFixedCostsPerYear),
    maintenanceCostsPerYear: n(form.maintenanceCostsPerYear),
    repairCostsPerYear: n(form.repairCostsPerYear),
    fuelCostsPerHour: n(form.fuelCostsPerUnit),
    operatorCostsPerHour: n(form.operatorCostsPerUnit),
    otherVariableCostsPerHour: n(form.otherVariableCostsPerUnit),
    annualKilometers: nOpt(form.annualKilometers)
  };
}
