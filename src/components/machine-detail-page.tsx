"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatLongDate, formatNumber } from "@/lib/app/format";
import type { Machine, MachineSummary } from "@/lib/app/machines";
import {
  formatMachineReading,
  getMachineById as getPlaceholderMachineById,
  getMachineCurrentReading,
  getMachineUnitLabel,
  toMachineSummary,
  validateMachineUsageUpdate
} from "@/lib/app/machines";
import { deleteMachine, getMachineById, updateMachine } from "@/lib/app/machines-database";
import { createMachineSparePart, deleteMachineSparePart, getMachineSpareParts, getSparePartPhotoSignedUrls, updateMachineSparePart } from "@/lib/app/machine-spare-parts-database";
import type { CreateMachineSparePartInput, MachineSparePart } from "@/lib/app/machines";
import {
  completeMaintenanceTask,
  createMaintenanceTask,
  deleteMaintenanceTask,
  getMaintenanceTasksByMachine,
  getMaintenancePhotoSignedUrls
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
  type MaintenanceIntervalType,
  type MaintenanceTask,
  type MaintenanceType
} from "@/lib/app/maintenance";
import { calculateMachineCosts, createCostInputFromOverride } from "@/lib/app/cost-calculation";
import { calculateVariableCosts, type LiveCostBreakdown } from "@/lib/app/financials";
import { safeDateParse } from "@/lib/app/date-utils";
import { getMaintenanceUrgency, urgentTaskCount } from "@/lib/app/maintenance-sort";
import { getCategoryEmoji, getCategoryGroup } from "@/lib/app/machine-categories";
import { MAINTENANCE_TEMPLATES } from "@/lib/app/maintenance-templates";
import { MachineFormModal } from "./machine-form-modal";
import { ConfirmDialog, PhotoGallery, PhotoUploadSection } from "./shared-ui-components";
import { EmptyState } from "./empty-state";
import { Fab } from "./fab";
import { MachineDocuments } from "./machine-documents";
import { getMachineCostOverride, upsertMachineCostOverride, type MachineCostOverride } from "@/lib/app/machine-cost-overrides-database";
import { oeklCategoryOptions } from "@/lib/app/oekl-reference";
import { formatCurrency } from "@/lib/app/format";
import type { MachineCostInput } from "@/lib/app/financials";
import { useToast } from "@/contexts/toast-context";

type Tab = "wartung" | "ersatzteile" | "kosten" | "dokumente";

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

function getMaintenanceTypeIcon(type: MaintenanceType): string {
  const icons: Partial<Record<MaintenanceType, string>> = {
    oil_engine: "🛢",
    oil_hydraulic: "💧",
    filter_air: "💨",
    filter_fuel: "⛽",
    filter_hydraulic: "🔩",
    filter_cabin: "🌬",
    lubrication: "🔧",
    service: "⚙",
    inspection_57a: "📋",
    brakes_tires: "⭕",
    ac_service: "❄",
    general_check: "✓",
    custom: "📌",
    other: "📌",
  };
  return icons[type] ?? "⚙";
}

type MachineDetailPageClientProps = {
  locale: Locale;
  machineId: string;
};

export function MachineDetailPageClient({ locale, machineId }: MachineDetailPageClientProps) {
  const router = useRouter();
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

  return (
    <MachineDetailPage
      locale={locale}
      machine={machine}
      onMachineUpdated={setMachine}
      onMachineDeleted={() => router.push(`/${locale}/machines`)}
    />
  );
}

type MachineDetailPageProps = {
  locale: Locale;
  machine: MachineSummary;
  onMachineUpdated: (machine: MachineSummary) => void;
  onMachineDeleted: () => void;
};

function MachineDetailPage({ locale, machine, onMachineUpdated, onMachineDeleted }: MachineDetailPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("wartung");
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isEditingMachine, setIsEditingMachine] = useState(false);
  const [confirmDeleteMachine, setConfirmDeleteMachine] = useState(false);
  const [isDeletingMachine, setIsDeletingMachine] = useState(false);
  const { addToast } = useToast();

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
    // Update machine reading if user entered a higher value
    if (data.currentReading !== null && data.currentReading !== undefined) {
      const currentReading = machine.unit === "km"
        ? (machine.currentKilometers ?? 0)
        : machine.currentOperatingHours;
      if (data.currentReading > currentReading) {
        const updateInput = machine.unit === "km"
          ? { currentKilometers: data.currentReading }
          : { currentOperatingHours: data.currentReading };
        const updated = await updateMachine(machine.id, updateInput);
        if (updated) onMachineUpdated(toMachineSummary(updated));
      }
    }
    await refreshTasks();
    addToast("✓ Wartung erledigt");
  }

  async function handleCreateTask(input: CreateMaintenanceTaskInput) {
    await createMaintenanceTask(input);
    await refreshTasks();
  }

  async function handleBulkCreateTasks(inputs: CreateMaintenanceTaskInput[]) {
    await Promise.all(inputs.map(createMaintenanceTask));
    await refreshTasks();
  }

  async function handleDeleteTask(taskId: string) {
    await deleteMaintenanceTask(taskId);
    await refreshTasks();
    addToast("✓ Wartung gelöscht");
  }

  async function handleEditMachineSave(input: import("@/lib/app/machines").CreateMachineInput) {
    const updated = await updateMachine(machine.id, input);
    if (updated) {
      onMachineUpdated(toMachineSummary(updated));
      void refreshTasks();
    }
    setIsEditingMachine(false);
  }

  async function handleDeleteMachine() {
    setIsDeletingMachine(true);
    try {
      await deleteMachine(machine.id);
      onMachineDeleted();
    } finally {
      setIsDeletingMachine(false);
    }
  }

  const urgentCount = urgentTaskCount(tasks);
  const [wartungFabTrigger, setWartungFabTrigger] = useState(0);
  const [ersatzteileFabTrigger, setErsatzteileFabTrigger] = useState(0);

  return (
    <main className="page machine-detail-v2">
      {/* ── Hero ── */}
      <section className="md-hero">
        <div className="md-hero-top">
          <div className="md-hero-info">
            <span className="md-hero-category">{machine.displayCategory}</span>
            <h1 className="md-hero-name">{getCategoryEmoji(machine.category)} {machine.name}</h1>
            <p className="md-hero-meta">{machine.manufacturer} {machine.model} · {machine.yearOfManufacture}</p>
          </div>
          <div className="md-hero-actions">
            <button className="button" type="button" onClick={() => setIsEditingMachine((v) => !v)}>
              {isEditingMachine ? "Schließen" : "Bearbeiten"}
            </button>
            <button className="button gold" type="button" onClick={() => setConfirmDeleteMachine(true)}>
              Löschen
            </button>
          </div>
        </div>

        <div className="md-reading-box">
          <div className="md-reading-info">
            <span className="md-reading-label">
              {machine.unit === "km" ? "Kilometerstand" : "Betriebsstunden"}
            </span>
            <span className="md-reading-value">
              {machine.unit === "km"
                ? `${(machine.currentKilometers ?? 0).toLocaleString("de-DE")} km`
                : `${machine.currentOperatingHours.toLocaleString("de-DE")} h`}
            </span>
          </div>
          <button
            type="button"
            className="md-reading-edit"
            aria-label="Stand bearbeiten"
            onClick={() => setIsEditingMachine(true)}
          >
            ✎
          </button>
        </div>
      </section>

      {isEditingMachine ? (
        <MachineFormModal
          mode="page"
          formMode="edit"
          machine={machine as unknown as Machine}
          onCancel={() => setIsEditingMachine(false)}
          onSave={handleEditMachineSave}
        />
      ) : null}

      {confirmDeleteMachine ? (
        <ConfirmDialog
          title={`${machine.name} wirklich löschen?`}
          message="Alle Wartungen und Ersatzteile werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
          confirmLabel={isDeletingMachine ? "Löschen..." : "Löschen"}
          onCancel={() => setConfirmDeleteMachine(false)}
          onConfirm={() => void handleDeleteMachine()}
        />
      ) : null}

      {/* ── Tabs ── */}
      <nav className="md-tabs" aria-label="Module">
        {(["wartung", "ersatzteile", "kosten", "dokumente"] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`md-tab${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "wartung" ? "Wartung" : tab === "ersatzteile" ? "Ersatzteile" : tab === "kosten" ? "Kosten" : "Dokumente"}
            {tab === "wartung" && urgentCount > 0 ? (
              <span className="md-tab-badge">{urgentCount}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {/* ── Tab Content ── */}
      {activeTab === "wartung" ? (
        <MachineWartungModule
          locale={locale}
          machine={machine}
          tasks={tasks}
          isLoading={isLoadingTasks}
          onUsageUpdate={handleUsageUpdate}
          onCompleteTask={handleCompleteTask}
          onCreateTask={handleCreateTask}
          onBulkCreateTasks={handleBulkCreateTasks}
          onDeleteTask={handleDeleteTask}
          fabTrigger={wartungFabTrigger}
        />
      ) : activeTab === "ersatzteile" ? (
        <SparePartsTabContent machine={machine} fabTrigger={ersatzteileFabTrigger} />
      ) : activeTab === "kosten" ? (
        <MachineKostenModule machine={machine} />
      ) : (
        <MachineDocuments machine={machine} />
      )}

      {activeTab === "wartung" ? (
        <Fab label="Wartung hinzufügen" onClick={() => setWartungFabTrigger((n) => n + 1)} />
      ) : activeTab === "ersatzteile" ? (
        <Fab label="Ersatzteil hinzufügen" onClick={() => setErsatzteileFabTrigger((n) => n + 1)} />
      ) : null}
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
  onBulkCreateTasks: (inputs: CreateMaintenanceTaskInput[]) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  fabTrigger?: number;
};

function MachineWartungModule({
  locale,
  machine,
  tasks,
  isLoading,
  onUsageUpdate,
  onCompleteTask,
  onCreateTask,
  onBulkCreateTasks,
  onDeleteTask,
  fabTrigger
}: WartungModuleProps) {
  const [isUpdatingStand, setIsUpdatingStand] = useState(false);
  const [confirmTemplates, setConfirmTemplates] = useState(false);
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [templateToast, setTemplateToast] = useState<string | null>(null);

  useEffect(() => {
    if (fabTrigger && fabTrigger > 0) setConfirmTemplates(true);
  }, [fabTrigger]);

  const categoryGroup = getCategoryGroup(machine.category);
  const templates = MAINTENANCE_TEMPLATES[categoryGroup.id];

  async function handleCreateTemplates() {
    setIsBulkCreating(true);
    setConfirmTemplates(false);
    try {
      const inputs: CreateMaintenanceTaskInput[] = templates.map((tpl) => ({
        farmId: machine.farmId,
        machineId: machine.id,
        title: tpl.title,
        type: tpl.type,
        customTitle: null,
        status: "open" as const,
        dueDate: null,
        dueOperatingHours: null,
        dueKilometers: null,
        intervalType: (
          tpl.intervalHours && tpl.intervalMonths ? "combined"
          : tpl.intervalKm ? "kilometers"
          : tpl.intervalHours ? "operating_hours"
          : tpl.intervalMonths ? "months"
          : "none"
        ) as import("@/lib/app/maintenance").MaintenanceIntervalType,
        intervalDays: null,
        intervalMonths: tpl.intervalMonths ?? null,
        intervalOperatingHours: tpl.intervalHours ?? null,
        intervalKilometers: tpl.intervalKm ?? null,
        estimatedCost: 0,
        actualCost: null,
        notes: null,
        photoUrls: []
      }));
      await onBulkCreateTasks(inputs);
      setTemplateToast(`${templates.length} Wartungen angelegt`);
      setTimeout(() => setTemplateToast(null), 3000);
    } finally {
      setIsBulkCreating(false);
    }
  }
  const currentReading = getMachineCurrentReading(machine);
  const unit = getMachineUnitLabel(machine.unit);

  const standardCardData = useMemo(() => STANDARD_TYPES.map((type) => {
    const typeTasks = tasks.filter((t) => t.type === type && t.status !== "cancelled");
    const activeTasks = typeTasks.filter((t) => t.status !== "completed");
    const completedTasks = typeTasks.filter((t) => t.status === "completed");
    const activeTask = activeTasks[0] ?? null;
    const lastCompleted = [...completedTasks].sort((a, b) =>
      (b.completedAt ?? "").localeCompare(a.completedAt ?? "")
    )[0] ?? null;
    const urgency: MaintenanceDisplayStatus = activeTask
      ? getMaintenanceDisplayStatus(activeTask, machine)
      : "planned";
    return { type, activeTask, lastCompleted, urgency };
  }), [tasks, machine]);

  const urgencyOrder: Record<string, number> = { due: 0, soon: 1, planned: 2, completed: 3 };

  const activeCards = useMemo(() => standardCardData
    .filter((c) => c.activeTask || c.lastCompleted)
    .sort((a, b) => {
      const ua = urgencyOrder[a.urgency] ?? 4;
      const ub = urgencyOrder[b.urgency] ?? 4;
      if (ua !== ub) return ua - ub;
      const da = safeDateParse(a.activeTask?.dueDate);
      const db = safeDateParse(b.activeTask?.dueDate);
      if (da && db) return da.getTime() - db.getTime();
      if (da) return -1;
      if (db) return 1;
      return a.type.localeCompare(b.type, "de");
    }),
  [standardCardData]);

  const inactiveCards = useMemo(
    () => standardCardData.filter((c) => !c.activeTask && !c.lastCompleted),
    [standardCardData]
  );

  return (
    <>
      <section className="stand-section">
        <div className="stand-row">
          <div className="stand-info">
            <span className="stand-label">
              {machine.unit === "km" ? "Aktueller Kilometerstand:" : "Aktuelle Betriebsstunden:"}
            </span>
            <strong className="stand-value">{formatMachineReading(machine)}</strong>
          </div>
          <button
            className="button primary stand-update-btn"
            type="button"
            onClick={() => setIsUpdatingStand((v) => !v)}
          >
            {isUpdatingStand ? "Schließen" : "Stand aktualisieren"}
          </button>
        </div>
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

      {templateToast ? (
        <div className="template-toast">{templateToast}</div>
      ) : null}

      {confirmTemplates ? (
        <ConfirmDialog
          title={`${templates.length} Standard-Wartungen für ${categoryGroup.label} anlegen?`}
          message="Du kannst jede Wartung danach einzeln anpassen oder löschen."
          confirmLabel={isBulkCreating ? "Anlegen..." : "Jetzt anlegen"}
          onCancel={() => setConfirmTemplates(false)}
          onConfirm={() => void handleCreateTemplates()}
        />
      ) : null}

      <section className="maintenance-types-section">
        {isLoading ? <p className="preference-hint">Laden...</p> : null}
        {!isLoading && tasks.length === 0 ? (
          <EmptyState
            emoji="🔧"
            title="Noch keine Wartungen geplant"
            message="Nutze Smart Templates um Standard-Wartungen hinzuzufügen, oder erstelle deine eigenen."
            actionLabel="Wartung hinzufügen"
            onAction={() => setConfirmTemplates(true)}
          />
        ) : null}

        {!isLoading && tasks.length > 0 ? (
          <div className="template-add-hint">
            <button
              className="button template-add-btn"
              type="button"
              onClick={() => setConfirmTemplates(true)}
            >
              Standard-Wartungen ergänzen
            </button>
          </div>
        ) : null}

        <div className="mc-list">
          {activeCards.map(({ type, activeTask, lastCompleted }) => (
            <MaintenanceTypeCard
              key={type}
              type={type}
              machine={machine}
              activeTask={activeTask}
              lastCompleted={lastCompleted}
              onComplete={onCompleteTask}
              onDelete={onDeleteTask}
              onCreate={(months, hours, km) =>
                onCreateTask(buildNewTaskInput(machine, type, getMaintenanceTypeLabel(type), null, months, hours, km))
              }
            />
          ))}
          {inactiveCards.map(({ type, activeTask, lastCompleted }) => (
            <MaintenanceTypeCard
              key={type}
              type={type}
              machine={machine}
              activeTask={activeTask}
              lastCompleted={lastCompleted}
              onComplete={onCompleteTask}
              onDelete={onDeleteTask}
              onCreate={(months, hours, km) =>
                onCreateTask(buildNewTaskInput(machine, type, getMaintenanceTypeLabel(type), null, months, hours, km))
              }
            />
          ))}
        </div>

        <AddCustomMaintenanceCard
          machine={machine}
          onAdd={(title, months, hours, km) =>
            onCreateTask(buildNewTaskInput(machine, "custom", title, title, months, hours, km))
          }
        />
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
  onDelete: (taskId: string) => Promise<void>;
};

function getTaskUrgencyClass(urgency: MaintenanceDisplayStatus): string {
  if (urgency === "due") return "urgency-overdue";
  if (urgency === "soon") return "urgency-soon";
  return "";
}

function getStatusHintData(
  activeTask: MaintenanceTask | null,
  machine: MachineSummary
): { text: string; urgent: boolean } {
  if (!activeTask) return { text: "—", urgent: false };
  const due = safeDateParse(activeTask.dueDate);
  if (!due) {
    const ds = getMaintenanceDisplayStatus(activeTask, machine);
    if (ds === "due") return { text: "FÄLLIG", urgent: true };
    if (ds === "soon") return { text: "Bald fällig", urgent: false };
    const label = getMostRelevantDueLabel(activeTask, machine);
    return { text: label, urgent: false };
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due.getTime()); dueDay.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((dueDay.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { text: "ÜBERFÄLLIG", urgent: true };
  if (diffDays === 0) return { text: "HEUTE", urgent: true };
  if (diffDays <= 7) return { text: `in ${diffDays} Tag${diffDays === 1 ? "" : "en"}`, urgent: false };
  return { text: due.toLocaleDateString("de-AT", { month: "short", year: "numeric" }), urgent: false };
}

function MaintenanceTypeCard({
  type,
  machine,
  activeTask,
  lastCompleted,
  onComplete,
  onCreate,
  onDelete
}: MaintenanceTypeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const label = getMaintenanceTypeLabel(type);
  const urgency: MaintenanceDisplayStatus = activeTask
    ? getMaintenanceDisplayStatus(activeTask, machine)
    : "planned";
  const statusHint = getStatusHintData(activeTask, machine);
  const taskUrgency = activeTask ? getMaintenanceUrgency(activeTask) : "none";
  const showAlert = taskUrgency === "overdue" || taskUrgency === "today";

  // Inactive: no task, no history
  if (!activeTask && !lastCompleted && !isAdding) {
    return (
      <article className="mc-card">
        <div className="mc-header" style={{ cursor: "default" }}>
          <span className="mc-title">{label}</span>
          <button className="button small" type="button" onClick={() => setIsAdding(true)}>
            Einrichten
          </button>
        </div>
      </article>
    );
  }

  // Adding form
  if (isAdding) {
    return (
      <article className="mc-card">
        <div className="mc-header" style={{ cursor: "default" }}>
          <span className="mc-title">{label}</span>
        </div>
        <div className="mc-body-inner" style={{ paddingTop: 0 }}>
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
        </div>
      </article>
    );
  }

  // Completing modal
  if (isCompleting && activeTask) {
    return (
      <>
        <article className={`mc-card ${getTaskUrgencyClass(urgency)}`}>
          <div className="mc-header" style={{ cursor: "default" }}>
            {showAlert ? <span className="mc-alert-icon" aria-hidden="true" title="Dringend">⚠</span> : null}
            <span className="mc-title">{label}</span>
          </div>
        </article>
        <div className="complete-dialog-overlay" onClick={() => setIsCompleting(false)}>
          <div className="complete-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="complete-dialog-header">
              <strong className="complete-dialog-title">✓ Erledigt: {label}</strong>
              <button type="button" className="complete-dialog-close" onClick={() => setIsCompleting(false)} aria-label="Schließen">✕</button>
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
          </div>
        </div>
      </>
    );
  }

  // Main collapsible card
  return (
    <article className={`mc-card ${getTaskUrgencyClass(urgency)}`}>
      {/* ── Always visible header ── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        className="mc-header"
        onClick={() => setIsExpanded((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsExpanded((v) => !v); } }}
      >
        {showAlert ? <span className="mc-alert-icon" aria-hidden="true" title="Dringend">⚠</span> : null}
        <span className="mc-title">{label}</span>
        <span className={`mc-status-hint${statusHint.urgent ? " urgent" : ""}`}>
          {statusHint.text}
        </span>

        {/* ⋯ overflow menu */}
        {activeTask ? (
          <div ref={menuRef} className="mc-menu-wrap" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="mc-menu-trigger"
              aria-label="Mehr Aktionen"
              onClick={() => setShowMenu((v) => !v)}
            >
              ⋯
            </button>
            {showMenu ? (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setShowMenu(false)} />
                <div className="mc-menu-panel">
                  <button
                    type="button"
                    className="mc-menu-item danger"
                    onClick={() => { setShowMenu(false); setConfirmDelete(true); }}
                  >
                    Löschen
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        <span className={`mc-chevron${isExpanded ? " expanded" : ""}`} aria-hidden="true">▾</span>
      </div>

      {/* ── Collapsible body ── */}
      <div className={`mc-body ${isExpanded ? "mc-body--expanded" : "mc-body--collapsed"}`}>
        <div className="mc-body-inner">
          {activeTask && (activeTask.intervalMonths !== null || activeTask.intervalOperatingHours !== null || activeTask.intervalKilometers !== null) ? (
            <p className="mc-interval">{getMaintenanceRecurrenceLabel(activeTask)}</p>
          ) : null}

          {activeTask ? (
            <div className="mc-section">
              <p className="mc-section-label">Nächste Fälligkeit</p>
              <p className="mc-section-value mc-section-value--due">{getMostRelevantDueLabel(activeTask, machine)}</p>
            </div>
          ) : null}

          {lastCompleted ? (
            <div className="mc-section">
              <p className="mc-section-label">Zuletzt erledigt</p>
              <p className="mc-section-value mc-section-value--last">
                {lastCompleted.completedAt ? formatLongDate(lastCompleted.completedAt) : "–"}
                {lastCompleted.lastDoneReading !== null
                  ? ` · ${lastCompleted.lastDoneReading.toLocaleString("de-DE", { maximumFractionDigits: 0 })} ${getMachineUnitLabel(machine.unit)}`
                  : ""}
                {lastCompleted.photoUrls.length > 0 ? (
                  <PhotoGallery paths={lastCompleted.photoUrls} getSignedUrls={getMaintenancePhotoSignedUrls} />
                ) : null}
              </p>
            </div>
          ) : null}

          <div className="mc-actions">
            {activeTask ? (
              <button className="button primary mc-btn-complete" type="button" onClick={(e) => { e.stopPropagation(); setIsCompleting(true); }}>
                ✓ Erledigt
              </button>
            ) : null}
            <button className="button mc-btn-edit" type="button" onClick={(e) => { e.stopPropagation(); setIsAdding(true); }}>
              ✎ Bearbeiten
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && activeTask ? (
        <ConfirmDialog
          title={`${label} wirklich löschen?`}
          message="Diese Wartungsaufgabe wird gelöscht."
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setIsSaving(true);
            await onDelete(activeTask.id);
            setIsSaving(false);
            setConfirmDelete(false);
          }}
        />
      ) : null}
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
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);

  function addPhotos(files: File[]) {
    setPhotos((prev) => [...prev, ...files]);
    setPhotoPreviewUrls((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photoPreviewUrls[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const r = reading.trim() ? Number(reading) : null;
    await onSave({
      completedAt,
      currentReading: r && Number.isFinite(r) ? r : null,
      actualCost: cost.trim() ? Number(cost) : null,
      notes: notes.trim() || null,
      photos: photos.length > 0 ? photos : undefined
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
        {reading !== String(currentReading) ? (
          <span className="form-hint" style={{ color: "var(--color-subtle)" }}>
            Aktueller Maschinenstand: {currentReading.toLocaleString("de-DE", { maximumFractionDigits: 0 })} {unit}
          </span>
        ) : null}
      </label>
      <label>
        Kosten (€)
        <input inputMode="decimal" min="0" step="0.01" type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
      </label>
      <label>
        Notiz
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <PhotoUploadSection
        photos={photos}
        previewUrls={photoPreviewUrls}
        hint="Rechnung, Wartungsbuch, etc."
        onAdd={addPhotos}
        onRemove={removePhoto}
      />
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
  const [showForm, setShowForm] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<LiveCostBreakdown | null>(null);

  useEffect(() => {
    getMachineCostOverride(machine.id).then((existing) => {
      setOverride(existing);
      setForm(buildKostenFormState(machine, existing));
    });
  }, [machine]);

  useEffect(() => {
    calculateVariableCosts(machine).then(setBreakdown).catch((err: unknown) => {
      console.error("[MachineKosten] calculateVariableCosts failed:", err);
    });
  }, [machine.id]);

  const costInput = buildCostInputFromForm(machine, form);
  const result = calculateMachineCosts(costInput);
  const primaryKpi = isKm ? result.costPerKilometer : result.costPerOperatingHour;
  const hasValues = result.totalAnnualCosts > 0;

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
      <div className="kosten-kpi-grid">
        <div className="kosten-kpi-block">
          <span className="kosten-kpi-label">Kosten je {isKm ? "km" : "Stunde"}</span>
          <strong className="kosten-kpi-value">
            {!hasValues || primaryKpi === null ? "—" : formatCurrency(primaryKpi)}
          </strong>
        </div>
        <div className="kosten-kpi-block">
          <span className="kosten-kpi-label">Kosten je Jahr</span>
          <strong className="kosten-kpi-value">
            {!hasValues ? "—" : formatCurrency(result.totalAnnualCosts)}
          </strong>
        </div>
      </div>

      {!hasValues ? (
        <div className="kosten-empty-hint">
          <p>Noch keine Kostenwerte hinterlegt.</p>
          <button className="button" type="button" onClick={() => setShowForm(true)}>
            Jetzt einrichten →
          </button>
        </div>
      ) : (
        <div className="kosten-breakdown">
          <div className="kosten-breakdown-row">
            <span>Fixkosten/Jahr</span>
            <strong>{formatCurrency(result.fixedCosts.annualFixedCosts)}</strong>
          </div>
          <div className="kosten-breakdown-row">
            <span>Variable Kosten/Jahr</span>
            <strong>{formatCurrency(result.variableCosts.annualVariableCosts)}</strong>
          </div>
          <div className="kosten-breakdown-row">
            <span>Abschreibung/Jahr</span>
            <strong>{formatCurrency(result.fixedCosts.annualDepreciation)}</strong>
          </div>
          <div className="kosten-breakdown-row">
            <span>Auslastung</span>
            <strong>
              {isKm
                ? `${costInput.annualKilometers ?? 0} km/Jahr`
                : `${costInput.annualOperatingHours} h/Jahr`}
            </strong>
          </div>
        </div>
      )}

      {breakdown !== null ? (
        <div className="kosten-breakdown">
          <div className="kosten-breakdown-row" style={{ background: "var(--surface-muted)" }}>
            <span style={{ color: "var(--primary-dark)", fontWeight: 700 }}>Variable Kosten (Ø 12 Monate)</span>
          </div>
          <div className="kosten-breakdown-row">
            <span>Treibstoff</span>
            <strong>{formatCurrency(breakdown.fuelPerUnit)}{perUnitLabel}</strong>
          </div>
          <div className="kosten-breakdown-row">
            <span>Wartung (12 M Ø)</span>
            <strong>
              {breakdown.maintenancePerUnit === 0
                ? "—"
                : `${formatCurrency(breakdown.maintenancePerUnit)}${perUnitLabel}`}
            </strong>
          </div>
          <div className="kosten-breakdown-row">
            <span>Ersatzteile (12 M Ø)</span>
            <strong>
              {breakdown.sparePartsPerUnit === 0
                ? "—"
                : `${formatCurrency(breakdown.sparePartsPerUnit)}${perUnitLabel}`}
            </strong>
          </div>
          <div className="kosten-breakdown-row" style={{ borderTop: "2px solid var(--border)" }}>
            <span style={{ color: "var(--primary-dark)", fontWeight: 700 }}>Summe variabel</span>
            <strong style={{ fontSize: 16 }}>{formatCurrency(breakdown.totalPerUnit)}{perUnitLabel}</strong>
          </div>
        </div>
      ) : null}

      <button
        className="kosten-form-toggle"
        type="button"
        onClick={() => setShowForm((v) => !v)}
      >
        <span>Werte anpassen (ÖKL / manuell)</span>
        <span>{showForm ? "▲" : "▼"}</span>
      </button>

      {showForm && (
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

          <fieldset className="kosten-fieldset">
            <legend>Fixkosten</legend>
            <KostenField label="Versicherung/Jahr" value={form.insurancePerYear} unit="€" onChange={(v) => updateField("insurancePerYear", v)} />
            <KostenField label="Steuer/Jahr" value={form.taxPerYear} unit="€" onChange={(v) => updateField("taxPerYear", v)} />
            <KostenField label="Unterstand/Jahr" value={form.storagePerYear} unit="€" onChange={(v) => updateField("storagePerYear", v)} />
            <KostenField label="Sonstige Fix/Jahr" value={form.otherFixedCostsPerYear} unit="€" onChange={(v) => updateField("otherFixedCostsPerYear", v)} />
          </fieldset>

          <fieldset className="kosten-fieldset">
            <legend>Variable Kosten</legend>
            <KostenField label="Wartung/Jahr" value={form.maintenanceCostsPerYear} unit="€" onChange={(v) => updateField("maintenanceCostsPerYear", v)} />
            <KostenField label="Reparatur/Jahr" value={form.repairCostsPerYear} unit="€" onChange={(v) => updateField("repairCostsPerYear", v)} />
            <KostenField label={`Diesel${perUnitLabel}`} value={form.fuelCostsPerUnit} unit="€" onChange={(v) => updateField("fuelCostsPerUnit", v)} />
            <KostenField label={`Fahrer${perUnitLabel}`} value={form.operatorCostsPerUnit} unit="€" onChange={(v) => updateField("operatorCostsPerUnit", v)} />
            <KostenField label={`Sonstiges${perUnitLabel}`} value={form.otherVariableCostsPerUnit} unit="€" onChange={(v) => updateField("otherVariableCostsPerUnit", v)} />
          </fieldset>

          <div className="kosten-form-actions">
            {savedAt !== null && <span className="muted">Gespeichert {savedAt}</span>}
            <button className="button primary" type="submit" disabled={isSaving}>
              {isSaving ? "Speichern..." : "Werte speichern"}
            </button>
          </div>
        </form>
      )}

      <p className="kosten-footer-note">Berechnung nach ÖKL-Methodik. Werte manuell anpassbar.</p>
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

function buildNewTaskInput(
  machine: Machine,
  type: MaintenanceType,
  title: string,
  customTitle: string | null,
  months: number | null,
  hours: number | null,
  km: number | null
): CreateMaintenanceTaskInput {
  const now = new Date();
  const dueDate =
    months !== null
      ? (() => { const d = new Date(now); d.setMonth(d.getMonth() + months); return d.toISOString().slice(0, 10); })()
      : null;
  const currentReading = getMachineCurrentReading(machine);
  const dueOperatingHours = hours !== null ? currentReading + hours : null;
  const dueKilometers = km !== null ? currentReading + km : null;
  const intervalType: MaintenanceIntervalType =
    months !== null && (hours !== null || km !== null) ? "combined"
    : months !== null ? "months"
    : hours !== null || km !== null ? "operating_hours"
    : "none";

  return {
    farmId: machine.farmId,
    machineId: machine.id,
    title,
    type,
    customTitle,
    status: "open",
    dueDate,
    dueOperatingHours,
    dueKilometers,
    intervalType,
    intervalDays: null,
    intervalMonths: months ?? null,
    intervalOperatingHours: hours ?? null,
    intervalKilometers: km ?? null,
    estimatedCost: 0,
    actualCost: null,
    notes: null,
    photoUrls: []
  };
}

// ─── Ersatzteile Tab ───────────────────────────────────────────────────────

type AdjustMode = "consume" | "add";

type SparePartsTabContentProps = {
  machine: MachineSummary;
  fabTrigger?: number;
};

function SparePartsTabContent({ machine, fabTrigger }: SparePartsTabContentProps) {
  const [parts, setParts] = useState<MachineSparePart[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (fabTrigger && fabTrigger > 0) setShowAddForm(true);
  }, [fabTrigger]);
  const [adjusting, setAdjusting] = useState<{ id: string; mode: AdjustMode } | null>(null);
  const [deletingPartId, setDeletingPartId] = useState<string | null>(null);

  const loadParts = useCallback(async () => {
    setIsLoading(true);
    try {
      setParts(await getMachineSpareParts(machine.id));
    } finally {
      setIsLoading(false);
    }
  }, [machine.id]);

  useEffect(() => {
    loadParts();
  }, [loadParts]);

  async function handleAdjust(part: MachineSparePart, amount: number, mode: AdjustMode) {
    const newQty = mode === "consume"
      ? Math.max(0, part.stockQuantity - amount)
      : part.stockQuantity + amount;
    await updateMachineSparePart(part.id, { stockQuantity: newQty });
    await loadParts();
    setAdjusting(null);
  }

  async function handleAddPart(input: CreateMachineSparePartInput & { photos?: File[] }) {
    await createMachineSparePart(input);
    await loadParts();
    setShowAddForm(false);
  }

  async function handleDeletePart(id: string) {
    await deleteMachineSparePart(id);
    await loadParts();
    setDeletingPartId(null);
  }

  return (
    <section className="spare-parts-tab">
      <div className="spare-parts-tab-header">
        <span className="spare-parts-tab-title">
          Ersatzteile
          {parts.length > 0 && (
            <span className="spare-parts-tab-count">{parts.length}</span>
          )}
        </span>
        {!showAddForm && (
          <button className="button small" type="button" onClick={() => setShowAddForm(true)}>
            + Hinzufügen
          </button>
        )}
      </div>

      {showAddForm && (
        <SparePartAddForm
          machine={machine}
          onSave={handleAddPart}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {isLoading ? (
        <p className="preference-hint">Laden...</p>
      ) : parts.length === 0 && !showAddForm ? (
        <EmptyState
          emoji="📦"
          title="Noch keine Ersatzteile erfasst"
          message="Erfasse Ersatzteile um Bestand und Mindestbestand zu tracken — mit Preisen für die Kostenrechnung."
          actionLabel="Ersatzteil hinzufügen"
          onAction={() => setShowAddForm(true)}
        />
      ) : (
        <div className="mc-list">
          {parts.map((part) => (
            <SparePartCard
              key={part.id}
              part={part}
              adjusting={adjusting}
              onAdjust={handleAdjust}
              onStartAdjust={setAdjusting}
              onCancelAdjust={() => setAdjusting(null)}
              onDelete={setDeletingPartId}
            />
          ))}
        </div>
      )}

      {deletingPartId !== null ? (
        <ConfirmDialog
          title={`${parts.find((p) => p.id === deletingPartId)?.name ?? "Ersatzteil"} wirklich löschen?`}
          message="Das Ersatzteil wird aus dem Bestand gelöscht."
          onCancel={() => setDeletingPartId(null)}
          onConfirm={() => void handleDeletePart(deletingPartId)}
        />
      ) : null}
    </section>
  );
}

type SparePartCardProps = {
  part: MachineSparePart;
  adjusting: { id: string; mode: AdjustMode } | null;
  onAdjust: (part: MachineSparePart, amount: number, mode: AdjustMode) => Promise<void>;
  onStartAdjust: (v: { id: string; mode: AdjustMode }) => void;
  onCancelAdjust: () => void;
  onDelete: (id: string) => void;
};

function SparePartCard({ part, adjusting, onAdjust, onStartAdjust, onCancelAdjust, onDelete }: SparePartCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLow = part.minimumStockQuantity > 0 && part.stockQuantity <= part.minimumStockQuantity;
  const isAdjusting = adjusting?.id === part.id;

  return (
    <article className={`mc-card${isLow ? " urgency-overdue" : ""}`}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        className="mc-header"
        onClick={() => setIsExpanded((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsExpanded((v) => !v); } }}
      >
        <span className="mc-title" style={{ fontSize: 15 }}>{part.name}</span>
        <span className="mc-status-hint" style={{ fontSize: 14, fontWeight: 600 }}>
          {formatNumber(part.stockQuantity)} {part.unit}
        </span>
        {isLow ? <span className="mc-status-hint urgent" style={{ marginLeft: 4 }}>Niedrig</span> : null}
        <span className={`mc-chevron${isExpanded ? " expanded" : ""}`} aria-hidden="true">▾</span>
      </div>

      <div className={`mc-body ${isExpanded ? "mc-body--expanded" : "mc-body--collapsed"}`}>
        <div className="mc-body-inner">
          {part.partNumber || part.manufacturer ? (
            <div className="mc-section">
              {part.partNumber ? <><p className="mc-section-label">Teilenummer</p><p className="mc-section-value">{part.partNumber}</p></> : null}
              {part.manufacturer ? <><p className="mc-section-label">Hersteller</p><p className="mc-section-value">{part.manufacturer}</p></> : null}
            </div>
          ) : null}
          <div className="mc-section">
            <p className="mc-section-label">Bestand / Minimum</p>
            <p className="mc-section-value">
              {formatNumber(part.stockQuantity)} / {formatNumber(part.minimumStockQuantity)} {part.unit}
            </p>
          </div>
          {part.photoUrls.length > 0 ? (
            <PhotoGallery paths={part.photoUrls} getSignedUrls={getSparePartPhotoSignedUrls} />
          ) : null}
          {isAdjusting ? (
            <ConsumeAddInlineForm
              mode={adjusting!.mode}
              onSave={(amount) => onAdjust(part, amount, adjusting!.mode)}
              onCancel={onCancelAdjust}
            />
          ) : (
            <div className="mc-actions">
              <button className="button primary mc-btn-complete" type="button"
                onClick={(e) => { e.stopPropagation(); onStartAdjust({ id: part.id, mode: "consume" }); }}>
                − Verbrauchen
              </button>
              <button className="button mc-btn-edit" type="button"
                onClick={(e) => { e.stopPropagation(); onStartAdjust({ id: part.id, mode: "add" }); }}>
                + Hinzufügen
              </button>
              <button className="button gold" type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(part.id); }}>
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

type ConsumeAddInlineFormProps = {
  mode: AdjustMode;
  onSave: (amount: number) => Promise<void>;
  onCancel: () => void;
};

function ConsumeAddInlineForm({ mode, onSave, onCancel }: ConsumeAddInlineFormProps) {
  const [amount, setAmount] = useState("1");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) return;
    setIsSaving(true);
    await onSave(num);
    setIsSaving(false);
  }

  return (
    <form className="spare-part-inline-form" onSubmit={handleSubmit}>
      <label className="spare-part-inline-label">
        {mode === "consume" ? "Menge verbrauchen" : "Menge hinzufügen"}
        <input
          autoFocus
          inputMode="decimal"
          min="0.01"
          step="0.01"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <div className="spare-part-inline-actions">
        <button className="button small" type="button" onClick={onCancel}>Abbrechen</button>
        <button className="button primary small" type="submit" disabled={isSaving}>
          {isSaving ? "..." : "Bestätigen"}
        </button>
      </div>
    </form>
  );
}

const SPARE_PART_UNITS = ["Stk.", "Liter", "kg", "m", "Paar"] as const;

type SparePartAddFormProps = {
  machine: MachineSummary;
  onSave: (input: CreateMachineSparePartInput & { photos?: File[] }) => Promise<void>;
  onCancel: () => void;
};

function SparePartAddForm({ machine, onSave, onCancel }: SparePartAddFormProps) {
  const [name, setName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [stockQuantity, setStockQuantity] = useState("1");
  const [unit, setUnit] = useState<string>("Stk.");
  const [minimumStockQuantity, setMinimumStockQuantity] = useState("0");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  function addPhotos(files: File[]) {
    setPhotos((prev) => [...prev, ...files]);
    setPreviewUrls((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(previewUrls[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) { setError("Bezeichnung eintragen."); return; }
    const qty = Number(stockQuantity);
    if (!Number.isFinite(qty) || qty < 0) { setError("Lagerbestand prüfen."); return; }
    setIsSaving(true);
    try {
      await onSave({
        farmId: machine.farmId,
        machineId: machine.id,
        name: name.trim(),
        category: "other",
        partNumber: partNumber.trim() || null,
        originalPartNumber: null,
        manufacturer: manufacturer.trim() || null,
        supplier: null,
        stockQuantity: qty,
        minimumStockQuantity: Number(minimumStockQuantity) || 0,
        unit: unit || "Stk.",
        storageLocation: null,
        purchasePrice: null,
        unitCost: null,
        notes: null,
        photoUrls: [],
        photos: photos.length > 0 ? photos : undefined
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="spare-part-add-form" onSubmit={handleSubmit}>
      <h4 className="spare-part-add-form-title">Neues Ersatzteil</h4>
      <label>
        Bezeichnung
        <input
          required
          placeholder="z.B. Ölfilter"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
        />
      </label>
      <label>
        Teilenummer / Seriennummer (optional)
        <input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} />
      </label>
      <label>
        Hersteller (optional)
        <input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
      </label>
      <div className="spare-part-add-stock-row">
        <label>
          Lagerbestand
          <input
            inputMode="decimal"
            min="0"
            required
            type="number"
            value={stockQuantity}
            onChange={(e) => { setStockQuantity(e.target.value); setError(null); }}
          />
        </label>
        <label>
          Einheit
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {SPARE_PART_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Mindestbestand (optional)
        <input
          inputMode="decimal"
          min="0"
          type="number"
          value={minimumStockQuantity}
          onChange={(e) => setMinimumStockQuantity(e.target.value)}
        />
      </label>
      <PhotoUploadSection
        photos={photos}
        previewUrls={previewUrls}
        hint="Teil, Verpackung, Rechnung"
        onAdd={addPhotos}
        onRemove={removePhoto}
      />
      {error && <p className="field-error">{error}</p>}
      <div className="form-actions">
        <button className="button" type="button" onClick={onCancel}>Abbrechen</button>
        <button className="button primary" type="submit" disabled={isSaving}>
          {isSaving ? "Speichern..." : "Speichern"}
        </button>
      </div>
    </form>
  );
}
