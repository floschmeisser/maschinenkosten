"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/routing";
import { formatCurrency, formatDate, formatNumber } from "@/lib/app/format";
import type { Machine, MachineSparePart } from "@/lib/app/machines";
import {
  getMachineSparePartStockStatus,
  getMachineSparePartStockStatusLabel,
  getMachines as getPlaceholderMachines
} from "@/lib/app/machines";
import { getMachines } from "@/lib/app/machines-database";
import { getMachineSpareParts } from "@/lib/app/machine-spare-parts-database";
import { getMaintenanceViewPreference, setMaintenanceViewPreference } from "@/lib/app/preferences";
import {
  completeMaintenanceTask,
  createMaintenanceTask,
  getMaintenanceTasks,
  updateMaintenanceTask
} from "@/lib/app/maintenance-database";
import {
  applyUsedPartsToStock,
  createMaintenanceUsedPart,
  getUsedPartHistoryForMaintenanceTask,
  type MaintenanceTaskUsedPartHistoryItem
} from "@/lib/app/maintenance-used-parts-database";
import {
  filterMaintenanceTasks,
  getMaintenanceDisplayStatus,
  getMaintenanceRecurrenceLabel,
  getMaintenanceTypeLabel,
  getMaintenanceUrgencyLabel,
  getMostRelevantDueLabel,
  getTodaysWorkTasks,
  isMaintenanceFilter,
  sortMaintenanceTasksByUrgency,
  type CompleteMaintenanceTaskInput,
  type CreateMaintenanceTaskInput,
  type MaintenanceDisplayStatus,
  type MaintenanceFilter,
  type MaintenanceTask
} from "@/lib/app/maintenance";
import { MaintenanceFormModal } from "./maintenance-form-modal";

type TaskGroup = {
  key: MaintenanceDisplayStatus;
  title: string;
  tasks: MaintenanceTask[];
};

type MaintenanceManagementProps = {
  initialFilter?: string;
  initialFocusedTaskId?: string;
  locale: Locale;
};

export function MaintenanceManagement({ initialFilter, initialFocusedTaskId, locale }: MaintenanceManagementProps) {
  const [machines, setMachines] = useState<Machine[]>(() => getPlaceholderMachines());
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [completionTask, setCompletionTask] = useState<MaintenanceTask | null>(null);
  const [costEditTaskId, setCostEditTaskId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<MaintenanceFilter>("all");
  const [isTodayMode, setIsTodayMode] = useState(false);
  const [openedWithFilter, setOpenedWithFilter] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [hasFocusedFromUrl, setHasFocusedFromUrl] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const refreshData = useCallback(async () => {
    setIsLoadingData(true);

    try {
      const [machineData, taskData] = await Promise.all([getMachines(), getMaintenanceTasks()]);
      setMachines(machineData);
      setTasks(sortMaintenanceTasksByUrgency(taskData, machineData));
    } catch {
      setMachines(getPlaceholderMachines());
      setTasks([]);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (isMaintenanceFilter(initialFilter)) {
      setSelectedFilter(initialFilter);
      setIsTodayMode(false);
      setOpenedWithFilter(true);
      return;
    }

    setSelectedFilter("all");
    setIsTodayMode(getMaintenanceViewPreference() === "today");
    setOpenedWithFilter(false);
  }, [initialFilter]);

  useEffect(() => {
    setFocusedTaskId(null);
    setHasFocusedFromUrl(false);
  }, [initialFocusedTaskId]);

  const filteredTasks = useMemo(() => filterMaintenanceTasks(tasks, machines, selectedFilter), [tasks, machines, selectedFilter]);
  const todaysWorkTasks = useMemo(() => getTodaysWorkTasks(tasks, machines), [tasks, machines]);
  const taskGroups = useMemo(() => groupTasks(filteredTasks, machines), [filteredTasks, machines]);
  const dueTaskCount = useMemo(
    () => tasks.filter((task) => getMaintenanceDisplayStatus(task, machines.find((machine) => machine.id === task.machineId)) === "due").length,
    [machines, tasks]
  );
  const soonTaskCount = useMemo(
    () => tasks.filter((task) => getMaintenanceDisplayStatus(task, machines.find((machine) => machine.id === task.machineId)) === "soon").length,
    [machines, tasks]
  );
  const completedTaskCount = useMemo(() => tasks.filter((task) => task.status === "completed").length, [tasks]);
  const focusedTask = useMemo(
    () => (focusedTaskId ? tasks.find((task) => task.id === focusedTaskId) ?? null : null),
    [focusedTaskId, tasks]
  );

  useEffect(() => {
    if (!initialFocusedTaskId || hasFocusedFromUrl || tasks.length === 0) {
      return;
    }

    const focusedTask = tasks.find((task) => task.id === initialFocusedTaskId);

    if (!focusedTask) {
      return;
    }

    const isVisibleInNormalView = filteredTasks.some((task) => task.id === focusedTask.id);
    const isVisibleInTodayMode = todaysWorkTasks.some((task) => task.id === focusedTask.id);

    if (isTodayMode && !isVisibleInTodayMode) {
      setIsTodayMode(false);
      return;
    }

    if (!isTodayMode && !isVisibleInNormalView) {
      setSelectedFilter(getFilterForTask(focusedTask, machines));
      return;
    }

    setExpandedTaskId(focusedTask.id);
    setFocusedTaskId(focusedTask.id);
    setHasFocusedFromUrl(true);

    window.setTimeout(() => {
      document.getElementById(getTaskElementId(focusedTask.id))?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }, 80);
  }, [filteredTasks, hasFocusedFromUrl, initialFocusedTaskId, isTodayMode, machines, tasks, todaysWorkTasks]);

  async function handleCreateTask(input: CreateMaintenanceTaskInput) {
    await createMaintenanceTask(input);
    await refreshData();
    setIsCreating(false);
    setSuccessMessage(null);
  }

  async function handleUpdateTask(input: CreateMaintenanceTaskInput) {
    if (!editingTask) {
      return;
    }

    await updateMaintenanceTask(editingTask.id, input);
    await refreshData();
    setEditingTask(null);
    setSuccessMessage(null);
  }

  async function handleQuickCostSave(task: MaintenanceTask, actualCost: number | null, notes: string | null) {
    await updateMaintenanceTask(task.id, { actualCost, notes });
    await refreshData();
    setCostEditTaskId(null);
    setSuccessMessage("Kosten gespeichert.");
  }

  async function handleCompleteTask(
    task: MaintenanceTask,
    completionData: CompleteMaintenanceTaskInput,
    usedParts: CompletionUsedPartInput[] = []
  ) {
    const result = await completeMaintenanceTask(task.id, completionData);
    const completedTask = result.completedTask;

    if (completedTask && usedParts.length > 0) {
      await Promise.all(
        usedParts.map((usedPart) =>
          createMaintenanceUsedPart({
            farmId: completedTask.farmId,
            maintenanceTaskId: task.id,
            sparePartId: usedPart.sparePartId,
            machineId: task.machineId,
            quantityUsed: usedPart.quantityUsed,
            notes: usedPart.notes
          })
        )
      );
    }

    const stockResult = completedTask && usedParts.length > 0 ? await applyUsedPartsToStock(task.id) : null;
    await refreshData();
    setCompletionTask(null);
    setExpandedTaskId(task.id);
    setFocusedTaskId(null);
    setSuccessMessage(createCompletionSuccessMessage(Boolean(result.nextTask), stockResult?.warnings ?? []));
  }

  return (
    <main className="page">
      <section className="maintenance-hero">
        <div>
          <span>Werkstatt</span>
          <h1>Wartung</h1>
          <p>{isLoadingData ? "Laden..." : dueTaskCount > 0 ? `${dueTaskCount} faellig` : "Keine dringenden Arbeiten"}</p>
        </div>
        <div className="maintenance-hero-stats">
          <div className={dueTaskCount > 0 ? "danger" : "good"}>
            <span>Faellig</span>
            <strong>{dueTaskCount}</strong>
          </div>
          <div className={todaysWorkTasks.length > 0 ? "warning" : "good"}>
            <span>Heute</span>
            <strong>{todaysWorkTasks.length}</strong>
          </div>
          <div>
            <span>Bald</span>
            <strong>{soonTaskCount}</strong>
          </div>
        </div>
      </section>

      {isCreating ? (
        <MaintenanceFormModal
          mode="create"
          machines={machines}
          onSave={handleCreateTask}
          onCancel={() => setIsCreating(false)}
        />
      ) : editingTask ? (
        <MaintenanceFormModal
          mode="edit"
          machines={machines}
          task={editingTask}
          onSave={handleUpdateTask}
          onCancel={() => setEditingTask(null)}
        />
      ) : (
        <section className="panel maintenance-create-panel">
          <div className="panel-heading">
            <h2>Wartung anlegen</h2>
            <button className="button primary" type="button" onClick={() => setIsCreating(true)}>
              Wartung anlegen
            </button>
          </div>
        </section>
      )}

      {completionTask ? (
        <CompletionForm
          task={completionTask}
          onCancel={() => setCompletionTask(null)}
          onComplete={(completionData, usedParts) => handleCompleteTask(completionTask, completionData, usedParts)}
        />
      ) : null}

      {successMessage ? <section className="panel success-panel">{successMessage}</section> : null}
      {openedWithFilter ? <section className="panel info-panel">Ansicht gesetzt.</section> : null}
      {focusedTask ? <FocusedTaskPanel locale={locale} task={focusedTask} onComplete={setCompletionTask} /> : null}

      <section className={isTodayMode ? "today-mode-panel active" : "today-mode-panel"}>
        <div>
          <span>Meine Arbeit heute</span>
          <h2>{todaysWorkTasks.length === 0 ? "Alles erledigt" : `${todaysWorkTasks.length} offen`}</h2>
          <p>{todaysWorkTasks.length === 0 ? "Heute keine Wartung offen" : "Jetzt abarbeiten"}</p>
        </div>
        <button
          className={isTodayMode ? "button primary large-action" : "button large-action"}
          type="button"
          onClick={() => {
            setIsTodayMode((current) => {
              const nextValue = !current;
              setMaintenanceViewPreference(nextValue ? "today" : "overview");
              return nextValue;
            });
            setCostEditTaskId(null);
            setExpandedTaskId(null);
          }}
        >
          {isTodayMode ? "Alle anzeigen" : "Heute"}
        </button>
        {isTodayMode ? <p className="preference-hint">Ansicht gemerkt.</p> : null}
      </section>

      {isTodayMode ? (
        <TodayWorkList
          costEditTaskId={costEditTaskId}
          expandedTaskId={expandedTaskId}
          focusedTaskId={focusedTaskId}
          machines={machines}
          onComplete={setCompletionTask}
          onCostEdit={setCostEditTaskId}
          onCostSave={handleQuickCostSave}
          onToggle={(taskId) => setExpandedTaskId((current) => (current === taskId ? null : taskId))}
          tasks={todaysWorkTasks}
        />
      ) : (
        <>
      <MaintenanceFilters
        selectedFilter={selectedFilter}
        onChange={(filter) => {
          setSelectedFilter(filter);
          setCostEditTaskId(null);
          setSuccessMessage(null);
        }}
      />

      {taskGroups.map((group) => (
        <MaintenanceGroup
          costEditTaskId={costEditTaskId}
          expandedTaskId={expandedTaskId}
          focusedTaskId={focusedTaskId}
          group={group}
          key={group.key}
          machines={machines}
          onComplete={setCompletionTask}
          onCostEdit={setCostEditTaskId}
          onCostSave={handleQuickCostSave}
          onEdit={setEditingTask}
          onToggle={(taskId) => setExpandedTaskId((current) => (current === taskId ? null : taskId))}
        />
      ))}
      {completedTaskCount > 0 ? <p className="preference-hint maintenance-history-note">{completedTaskCount} erledigte Arbeiten in der Historie.</p> : null}
        </>
      )}
    </main>
  );
}

type TodayWorkListProps = {
  costEditTaskId: string | null;
  expandedTaskId: string | null;
  focusedTaskId: string | null;
  machines: Machine[];
  tasks: MaintenanceTask[];
  onComplete: (task: MaintenanceTask) => void;
  onCostEdit: (taskId: string | null) => void;
  onCostSave: (task: MaintenanceTask, actualCost: number | null, notes: string | null) => Promise<void> | void;
  onToggle: (taskId: string) => void;
};

function TodayWorkList({
  costEditTaskId,
  expandedTaskId,
  focusedTaskId,
  machines,
  onComplete,
  onCostEdit,
  onCostSave,
  onToggle,
  tasks
}: TodayWorkListProps) {
  return (
    <section className="today-work-list">
      {tasks.length === 0 ? (
        <section className="panel empty-state maintenance-empty">
          <h2>Heute keine Wartung offen</h2>
          <p className="muted">Alle Maschinen sind einsatzbereit.</p>
        </section>
      ) : null}

      {tasks.map((task) => {
        const machine = machines.find((item) => item.id === task.machineId);
        const isExpanded = expandedTaskId === task.id;

        return (
          <article
            className={focusedTaskId === task.id ? "today-task-card focused-task" : "today-task-card"}
            id={getTaskElementId(task.id)}
            key={task.id}
          >
            <button className="task-summary workshop-task-summary" type="button" onClick={() => onToggle(task.id)}>
              <span>
                <strong>{task.title}</strong>
                <small>
                  {machine?.name ?? "Unbekannte Maschine"}
                </small>
              </span>
              <span className="task-side">
                <span className="urgency-badge due">{getMaintenanceUrgencyLabel(task, machine)}</span>
                <strong>{getMostRelevantDueLabel(task, machine)}</strong>
              </span>
            </button>

            {isExpanded ? <MaintenanceDetails task={task} machine={machine} /> : null}

            <div className="today-actions">
              <button className="button primary large-action" type="button" onClick={() => onComplete(task)}>
                Erledigen
              </button>
              <button className="button large-action" type="button" onClick={() => onCostEdit(costEditTaskId === task.id ? null : task.id)}>
                Kosten
              </button>
              <button className="button large-action" type="button" onClick={() => onToggle(task.id)}>
                Details
              </button>
            </div>

            {costEditTaskId === task.id ? (
              <QuickCostForm task={task} onCancel={() => onCostEdit(null)} onSave={(actualCost, notes) => onCostSave(task, actualCost, notes)} />
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

type MaintenanceGroupProps = {
  costEditTaskId: string | null;
  expandedTaskId: string | null;
  focusedTaskId: string | null;
  group: TaskGroup;
  machines: Machine[];
  onEdit: (task: MaintenanceTask) => void;
  onComplete: (task: MaintenanceTask) => void;
  onCostEdit: (taskId: string | null) => void;
  onCostSave: (task: MaintenanceTask, actualCost: number | null, notes: string | null) => Promise<void> | void;
  onToggle: (taskId: string) => void;
};

function MaintenanceGroup({
  costEditTaskId,
  expandedTaskId,
  focusedTaskId,
  group,
  machines,
  onEdit,
  onComplete,
  onCostEdit,
  onCostSave,
  onToggle
}: MaintenanceGroupProps) {
  return (
    <section className={`panel maintenance-group ${group.key}`}>
      <div className="panel-heading">
        <h2>{group.title}</h2>
        <span className="muted">{group.tasks.length} Aufgaben</span>
      </div>

      {group.tasks.length === 0 ? (
        <div className="empty-state">
          <strong>{group.key === "completed" ? "Noch keine Historie" : "Keine dringenden Arbeiten"}</strong>
        </div>
      ) : (
        <div className="task-list">
          {group.tasks.map((task) => {
            const machine = machines.find((item) => item.id === task.machineId);
            const isCompleted = task.status === "completed";
            const isExpanded = expandedTaskId === task.id;
            const urgency = getMaintenanceDisplayStatus(task, machine);

            return (
              <article
                className={focusedTaskId === task.id ? `task-item ${urgency} focused-task` : `task-item ${urgency}`}
                id={getTaskElementId(task.id)}
                key={task.id}
              >
                <button className="task-summary" type="button" onClick={() => onToggle(task.id)}>
                  <span>
                    <strong>{task.title}</strong>
                    <small>
                      {machine?.name ?? "Unbekannte Maschine"}
                    </small>
                  </span>
                  <span className="task-side">
                    <span className={`urgency-badge ${urgency}`}>{getMaintenanceUrgencyLabel(task, machine)}</span>
                    <strong>{getMostRelevantDueLabel(task, machine)}</strong>
                  </span>
                </button>

                <div className="maintenance-card-tags">
                  <span>{getMaintenanceTypeLabel(task.type)}</span>
                  <span>{getMaintenanceRecurrenceLabel(task)}</span>
                  {isCompleted && task.completedAt ? <span>{formatDate(task.completedAt)}</span> : null}
                  {isCompleted && task.actualCost !== null ? <span>{formatCurrency(task.actualCost)}</span> : null}
                </div>

                {isExpanded ? (
                  <>
                    <MaintenanceDetails task={task} machine={machine} />
                    {isCompleted ? <MaintenanceUsedPartsSummary taskId={task.id} /> : null}
                  </>
                ) : null}

                <div className="task-actions">
                  <button className="button" type="button" onClick={() => onEdit(task)}>
                    Bearbeiten
                  </button>
                  <button className="button" type="button" onClick={() => onCostEdit(costEditTaskId === task.id ? null : task.id)}>
                    Kosten
                  </button>
                  {!isCompleted ? (
                    <button className="button primary" type="button" onClick={() => onComplete(task)}>
                      Erledigen
                    </button>
                  ) : null}
                </div>

                {costEditTaskId === task.id ? (
                  <QuickCostForm task={task} onCancel={() => onCostEdit(null)} onSave={(actualCost, notes) => onCostSave(task, actualCost, notes)} />
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

type MaintenanceFiltersProps = {
  selectedFilter: MaintenanceFilter;
  onChange: (filter: MaintenanceFilter) => void;
};

const filterOptions: Array<{ label: string; value: MaintenanceFilter }> = [
  { label: "Heute", value: "today" },
  { label: "Faellig", value: "due" },
  { label: "Diese Woche", value: "week" },
  { label: "Erledigt", value: "completed" },
  { label: "Alle", value: "all" }
];

function MaintenanceFilters({ selectedFilter, onChange }: MaintenanceFiltersProps) {
  return (
    <section className="filter-row" aria-label="Wartung filtern">
      {filterOptions.map((option) => (
        <button
          className={selectedFilter === option.value ? "filter-button active" : "filter-button"}
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </section>
  );
}

type FocusedTaskPanelProps = {
  locale: Locale;
  task: MaintenanceTask;
  onComplete: (task: MaintenanceTask) => void;
};

function FocusedTaskPanel({ locale, task, onComplete }: FocusedTaskPanelProps) {
  const isCompleted = task.status === "completed";

  return (
    <section className="panel focused-task-panel">
      <div>
        <h2>{task.title}</h2>
        <p>{isCompleted ? "Erledigt." : "Aus Tagesstand."}</p>
      </div>
      <div className="focused-task-actions">
        {!isCompleted ? (
          <button className="button primary large-action" type="button" onClick={() => onComplete(task)}>
            Jetzt erledigen
          </button>
        ) : null}
        <Link className="button large-action" href={`/${locale}/daily-usage`}>
          Zurueck zum Tagesstand
        </Link>
      </div>
    </section>
  );
}

type MaintenanceDetailsProps = {
  task: MaintenanceTask;
  machine?: Machine;
};

function MaintenanceDetails({ task, machine }: MaintenanceDetailsProps) {
  return (
    <dl className="detail-list task-details maintenance-details">
      <div>
        <dt>Maschine</dt>
        <dd>{machine?.name ?? "Unbekannte Maschine"}</dd>
      </div>
      <div>
        <dt>Art</dt>
        <dd>{getMaintenanceTypeLabel(task.type)}</dd>
      </div>
      <div>
        <dt>Faellig</dt>
        <dd>{formatDue(task)}</dd>
      </div>
      <div>
        <dt>Wiederholung</dt>
        <dd>{getMaintenanceRecurrenceLabel(task)}</dd>
      </div>
      <div>
        <dt>Geschaetzt</dt>
        <dd>{formatCurrency(task.estimatedCost)}</dd>
      </div>
      <div>
        <dt>Tatsaechlich</dt>
        <dd>{task.actualCost === null ? "-" : formatCurrency(task.actualCost)}</dd>
      </div>
      <div>
        <dt>Notiz</dt>
        <dd>{task.notes || "-"}</dd>
      </div>
      <div>
        <dt>Erledigt am</dt>
        <dd>{task.completedAt ? formatDate(task.completedAt) : "-"}</dd>
      </div>
    </dl>
  );
}

type MaintenanceUsedPartsSummaryProps = {
  taskId: string;
};

function MaintenanceUsedPartsSummary({ taskId }: MaintenanceUsedPartsSummaryProps) {
  const [usedParts, setUsedParts] = useState<MaintenanceTaskUsedPartHistoryItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let isActive = true;

    getUsedPartHistoryForMaintenanceTask(taskId)
      .then((items) => {
        if (isActive) {
          setUsedParts(items);
        }
      })
      .finally(() => {
        if (isActive) {
          setHasLoaded(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, [taskId]);

  if (!hasLoaded) {
    return <p className="preference-hint">Ersatzteile laden...</p>;
  }

  if (usedParts.length === 0) {
    return <p className="preference-hint">Keine Ersatzteile verwendet.</p>;
  }

  return (
    <div className="used-parts-summary">
      <strong>Verwendete Teile</strong>
      {usedParts.map((part) => (
        <span key={part.id}>
          {part.sparePartName ?? "Ersatzteil"} / {formatNumber(part.quantityUsed)} {part.sparePartUnit ?? ""}
        </span>
      ))}
    </div>
  );
}

type CompletionFormProps = {
  task: MaintenanceTask;
  onCancel: () => void;
  onComplete: (completionData: CompleteMaintenanceTaskInput, usedParts: CompletionUsedPartInput[]) => Promise<void> | void;
};

type CompletionUsedPartInput = {
  sparePartId: string;
  quantityUsed: number;
  notes: string | null;
};

type UsedPartFormRow = {
  id: string;
  sparePartId: string;
  quantityUsed: string;
  notes: string;
};

function CompletionForm({ task, onCancel, onComplete }: CompletionFormProps) {
  const [actualCost, setActualCost] = useState(String(task.actualCost ?? task.estimatedCost ?? 0));
  const [completedAt, setCompletedAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(task.notes ?? "");
  const [spareParts, setSpareParts] = useState<MachineSparePart[]>([]);
  const [usedPartRows, setUsedPartRows] = useState<UsedPartFormRow[]>([]);
  const [partsMessage, setPartsMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isActive = true;

    getMachineSpareParts(task.machineId)
      .then((parts) => {
        if (isActive) {
          setSpareParts(parts);
        }
      })
      .catch(() => {
        if (isActive) {
          setSpareParts([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, [task.machineId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const usedParts = parseUsedPartRows(usedPartRows);

    if (usedPartRows.length > 0 && usedParts.length !== usedPartRows.length) {
      setPartsMessage("Ersatzteil und Menge pruefen.");
      return;
    }

    setIsSaving(true);

    try {
      await onComplete({
        actualCost: toOptionalNumber(actualCost),
        completedAt,
        notes
      }, usedParts);
    } finally {
      setIsSaving(false);
    }
  }

  function handleAddUsedPart() {
    setPartsMessage(null);
    setUsedPartRows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        sparePartId: spareParts[0]?.id ?? "",
        quantityUsed: "1",
        notes: ""
      }
    ]);
  }

  function handleUpdateUsedPart(rowId: string, input: Partial<UsedPartFormRow>) {
    setPartsMessage(null);
    setUsedPartRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...input } : row)));
  }

  return (
    <section className="panel form-panel completion-panel">
      <div className="panel-heading">
        <div>
          <h2>Abschliessen</h2>
          <span className="muted">{task.title}</span>
        </div>
      </div>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Kosten
          <input min="0" type="number" value={actualCost} onChange={(event) => setActualCost(event.target.value)} />
        </label>
        <label>
          Erledigt am
          <input type="date" value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} />
        </label>
        <label className="form-section">
          Notiz
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </label>
        <section className="form-section used-parts-section">
          <div className="panel-heading compact">
            <h3>Verwendete Ersatzteile</h3>
            <button className="button" type="button" onClick={handleAddUsedPart} disabled={spareParts.length === 0}>
              Teil dazu
            </button>
          </div>
          {spareParts.length === 0 ? <p className="muted">Keine Ersatzteile erfasst.</p> : null}
          {partsMessage ? <p className="field-error">{partsMessage}</p> : null}
          {usedPartRows.length > 0 ? (
            <div className="used-parts-list">
              {usedPartRows.map((row) => {
                const selectedPart = spareParts.find((part) => part.id === row.sparePartId) ?? null;
                const quantityUsed = toOptionalNumber(row.quantityUsed) ?? 0;
                const stockAfterUse = selectedPart ? Math.max(0, selectedPart.stockQuantity - quantityUsed) : 0;
                const hasStockWarning = Boolean(selectedPart && quantityUsed > selectedPart.stockQuantity);
                const stockStatus = selectedPart ? getMachineSparePartStockStatus(selectedPart) : "ok";
                const stockAfterUseStatus = selectedPart
                  ? getProjectedStockStatus(selectedPart, stockAfterUse)
                  : "ok";
                const shouldReorderAfterUse = selectedPart ? stockAfterUse <= selectedPart.minimumStockQuantity : false;

                return (
                  <div className={hasStockWarning || shouldReorderAfterUse ? "used-part-row warning" : "used-part-row"} key={row.id}>
                    <label>
                      Ersatzteil
                      <select
                        value={row.sparePartId}
                        onChange={(event) => handleUpdateUsedPart(row.id, { sparePartId: event.target.value })}
                      >
                        {spareParts.map((part) => (
                          <option key={part.id} value={part.id}>
                            {part.name}{part.partNumber ? ` / ${part.partNumber}` : ""} / {formatNumber(part.stockQuantity)} {part.unit}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Menge
                      <input
                        min="0"
                        step="0.1"
                        type="number"
                        value={row.quantityUsed}
                        onChange={(event) => handleUpdateUsedPart(row.id, { quantityUsed: event.target.value })}
                      />
                    </label>
                    <label>
                      Notiz
                      <input value={row.notes} onChange={(event) => handleUpdateUsedPart(row.id, { notes: event.target.value })} />
                    </label>
                    {selectedPart ? (
                      <div className="maintenance-part-stock-impact">
                        <span className={`reorder-badge ${stockStatus}`}>{getMachineSparePartStockStatusLabel(stockStatus)}</span>
                        <p className={hasStockWarning || shouldReorderAfterUse ? "stock-preview warning-text" : "stock-preview"}>
                          Jetzt {formatNumber(selectedPart.stockQuantity)} {selectedPart.unit} / danach {formatNumber(stockAfterUse)}{" "}
                          {selectedPart.unit}
                        </p>
                        {shouldReorderAfterUse ? (
                          <span className={`reorder-badge ${stockAfterUseStatus}`}>
                            {stockAfterUse <= 0 ? "Nachbestellen" : "Nach Nutzung niedrig"}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {hasStockWarning ? <p className="field-error">Nicht genug auf Lager</p> : null}
                    <button
                      className="button"
                      type="button"
                      onClick={() => setUsedPartRows((current) => current.filter((item) => item.id !== row.id))}
                    >
                      Entfernen
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
        <div className="form-actions">
          <button className="button" type="button" onClick={onCancel}>
            Abbrechen
          </button>
          <button className="button primary" type="submit" disabled={isSaving}>
            {isSaving ? "Speichern..." : "Erledigt speichern"}
          </button>
        </div>
      </form>
    </section>
  );
}

type QuickCostFormProps = {
  task: MaintenanceTask;
  onCancel: () => void;
  onSave: (actualCost: number | null, notes: string | null) => Promise<void> | void;
};

function QuickCostForm({ task, onCancel, onSave }: QuickCostFormProps) {
  const [actualCost, setActualCost] = useState(String(task.actualCost ?? task.estimatedCost ?? 0));
  const [notes, setNotes] = useState(task.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      await onSave(toOptionalNumber(actualCost), notes.trim() || null);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="quick-cost-form" onSubmit={handleSubmit}>
      <label>
        Kosten
        <input min="0" type="number" value={actualCost} onChange={(event) => setActualCost(event.target.value)} />
      </label>
      <label>
        Notiz
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
      </label>
      <div className="form-actions">
        <button className="button" type="button" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="button primary" type="submit" disabled={isSaving}>
          {isSaving ? "Speichern..." : "Kosten speichern"}
        </button>
      </div>
    </form>
  );
}

function groupTasks(tasks: MaintenanceTask[], machines: Machine[]): TaskGroup[] {
  const groups: TaskGroup[] = [
    { key: "due", title: "Faellig", tasks: [] },
    { key: "soon", title: "Bald faellig", tasks: [] },
    { key: "planned", title: "Geplant", tasks: [] },
    { key: "completed", title: "Erledigt", tasks: [] }
  ];

  for (const task of sortMaintenanceTasksByUrgency(tasks, machines)) {
    const machine = machines.find((item) => item.id === task.machineId);
    const status = getMaintenanceDisplayStatus(task, machine);
    const group = groups.find((item) => item.key === status);
    group?.tasks.push(task);
  }

  return groups;
}

function getFilterForTask(task: MaintenanceTask, machines: Machine[]): MaintenanceFilter {
  const machine = machines.find((item) => item.id === task.machineId);
  const displayStatus = getMaintenanceDisplayStatus(task, machine);

  if (displayStatus === "completed") {
    return "completed";
  }

  if (displayStatus === "due") {
    return "due";
  }

  if (displayStatus === "soon") {
    return "soon";
  }

  return "all";
}

function getTaskElementId(taskId: string): string {
  return `maintenance-task-${taskId}`;
}

function createCompletionSuccessMessage(hasNextTask: boolean, stockWarnings: string[]): string {
  const baseMessage = hasNextTask ? "Erledigt. Neuer Termin." : "Erledigt.";

  if (stockWarnings.length === 0) {
    return baseMessage;
  }

  return `${baseMessage} Lager pruefen.`;
}

function parseUsedPartRows(rows: UsedPartFormRow[]): CompletionUsedPartInput[] {
  return rows
    .map((row) => ({
      sparePartId: row.sparePartId,
      quantityUsed: toOptionalNumber(row.quantityUsed),
      notes: row.notes.trim() || null
    }))
    .filter((row): row is CompletionUsedPartInput => Boolean(row.sparePartId) && row.quantityUsed !== null && row.quantityUsed > 0);
}

function formatDue(task: MaintenanceTask): string {
  const parts: string[] = [];

  if (task.dueDate) {
    parts.push(formatDate(task.dueDate));
  }

  if (task.dueOperatingHours !== null) {
    parts.push(`${formatNumber(task.dueOperatingHours)} h`);
  }

  if (task.dueKilometers !== null) {
    parts.push(`${formatNumber(task.dueKilometers)} km`);
  }

  return parts.length > 0 ? parts.join(" / ") : "Keine Faelligkeit";
}

function toOptionalNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getProjectedStockStatus(part: MachineSparePart, stockQuantity: number): ReturnType<typeof getMachineSparePartStockStatus> {
  return getMachineSparePartStockStatus({ ...part, stockQuantity });
}
