"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/routing";
import { createMachineCostComparison } from "@/lib/app/cost-calculation";
import { getActiveFarmConfig, type FarmAppConfig, type FarmProfileKey } from "@/lib/app/farm-config";
import { formatCurrency } from "@/lib/app/format";
import type { MachineSparePart, MachineSummary } from "@/lib/app/machines";
import { getMachineSparePartStockStatus, getMachines as getPlaceholderMachines, toMachineSummary } from "@/lib/app/machines";
import { getMachines as loadMachines } from "@/lib/app/machines-database";
import { getLowStockSpareParts } from "@/lib/app/machine-spare-parts-database";
import {
  getMaintenanceDisplayStatus,
  getMaintenanceTasks as getPlaceholderMaintenanceTasks,
  sortMaintenanceTasksByUrgency,
  type MaintenanceTask
} from "@/lib/app/maintenance";
import { getMaintenanceTasks as loadMaintenanceTasks } from "@/lib/app/maintenance-database";
import { getFarmProfilePreference } from "@/lib/app/preferences";
import { getReminderPriorityLabel, getReminderTypeLabel, type Reminder } from "@/lib/app/reminders";
import { getOpenReminders } from "@/lib/app/reminders-database";
import { syncRemindersFromCurrentData } from "@/lib/app/reminder-sync";

type DashboardProps = {
  locale: Locale;
};

const maxImportantItems = 3;

export function Dashboard({ locale }: DashboardProps) {
  const [farmKey, setFarmKey] = useState<FarmProfileKey>("default");
  const farmConfig = getActiveFarmConfig(farmKey);
  const [machines, setMachines] = useState<MachineSummary[]>(() => getPlaceholderMachines().map(toMachineSummary));
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>(() => getPlaceholderMaintenanceTasks());
  const [lowStockSpareParts, setLowStockSpareParts] = useState<MachineSparePart[]>([]);
  const [openReminders, setOpenReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    function syncFarmProfile() {
      setFarmKey(getFarmProfilePreference());
    }

    syncFarmProfile();
    window.addEventListener("maschinenkosten.farmProfileChanged", syncFarmProfile);
    window.addEventListener("storage", syncFarmProfile);

    return () => {
      window.removeEventListener("maschinenkosten.farmProfileChanged", syncFarmProfile);
      window.removeEventListener("storage", syncFarmProfile);
    };
  }, []);

  useEffect(() => {
    async function loadDashboardData() {
      setIsLoading(true);

      try {
        const [machineData, taskData, lowStockSpareParts, reminderData] = await Promise.all([
          loadMachines(),
          loadMaintenanceTasks(),
          getLowStockSpareParts(),
          getOpenReminders()
        ]);

        setMachines(machineData.map(toMachineSummary));
        setMaintenanceTasks(taskData);
        setLowStockSpareParts(lowStockSpareParts);
        setOpenReminders(reminderData);
        void syncRemindersFromCurrentData()
          .then(async () => {
            setOpenReminders(await getOpenReminders());
          })
          .catch(() => undefined);
      } catch {
        setMachines(getPlaceholderMachines().map(toMachineSummary));
        setMaintenanceTasks(getPlaceholderMaintenanceTasks());
        setLowStockSpareParts([]);
        try {
          setOpenReminders(await getOpenReminders());
        } catch {
          setOpenReminders([]);
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const sortedMaintenanceTasks = sortMaintenanceTasksByUrgency(maintenanceTasks, machines);
  const dueMaintenanceCount = sortedMaintenanceTasks.filter((task) => {
    const machine = machines.find((item) => item.id === task.machineId);
    return getMaintenanceDisplayStatus(task, machine) === "due";
  }).length;
  const criticalLowStockCount = lowStockSpareParts.filter((part) => ["critical", "empty"].includes(getMachineSparePartStockStatus(part))).length;
  const importantReminderCount = openReminders.filter((reminder) => reminder.priority === "critical" || reminder.priority === "high").length;
  const costComparisonItems = createMachineCostComparison(machines, maintenanceTasks);
  const mostExpensiveMachine = costComparisonItems[0];
  const cheapestMachine = [...costComparisonItems]
    .filter((item) => item.result.costPerOperatingHour !== null)
    .sort((first, second) => (first.result.costPerOperatingHour ?? 0) - (second.result.costPerOperatingHour ?? 0))[0];
  const highMaintenanceMachine = [...costComparisonItems].sort(
    (first, second) => second.result.variableCosts.maintenanceCostsPerHour - first.result.variableCosts.maintenanceCostsPerHour
  )[0];
  const importantItems = createImportantItems({
    farmConfig,
    locale,
    lowStockSpareParts,
    machines,
    maintenanceTasks: sortedMaintenanceTasks
  });
  const statusSummary = createStatusSummary({
    dueMaintenanceCount,
    importantCount: importantItems.length,
    lowStockSparePartsCount: lowStockSpareParts.length,
    criticalLowStockCount
  });
  const dashboardCards = createDailyCards({
    dueMaintenanceCount,
    farmConfig,
    lowStockSparePartsCount: lowStockSpareParts.length,
    importantReminderCount,
    criticalLowStockCount,
    locale
  });
  const quickActions = createDashboardQuickActions({ farmConfig, locale });

  return (
    <main className="page dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span>{farmConfig.branding.farmName}</span>
          <h1>{farmConfig.branding.welcomeTitle}</h1>
        </div>
        <div className="today-status">
          <strong>{formatDashboardDate(new Date())}</strong>
          <small>{isLoading ? "Laden..." : statusSummary}</small>
        </div>
      </section>

      <section className="dashboard-important" aria-label="Heute wichtig">
        <div className="section-title-row">
          <h2>Heute wichtig</h2>
          <span>{importantItems.length}</span>
        </div>
        {importantItems.length === 0 ? (
          <div className="dashboard-empty">
            <strong>Alles ruhig</strong>
          </div>
        ) : (
          <div className="important-list">
            {importantItems.map((item) => (
              <Link className={`important-item ${item.tone}`} href={item.href} key={item.id}>
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-focus-grid" aria-label="Betriebsuebersicht">
        {dashboardCards.map((card) => (
          <DashboardFocusCard {...card} key={card.id} />
        ))}
      </section>

      {openReminders.length > 0 ? (
        <section className="dashboard-reminders" aria-label="Erinnerungen">
          {openReminders.slice(0, 3).map((reminder) => (
            <Link className={`dashboard-reminder-item ${reminder.priority}`} href={`/${locale}/reminders`} key={reminder.id}>
              <span>{getReminderPriorityLabel(reminder.priority)}</span>
              <strong>{reminder.title}</strong>
              <small>{getReminderTypeLabel(reminder.type)}</small>
            </Link>
          ))}
        </section>
      ) : null}

      {farmConfig.enabledModules.costs && costComparisonItems.length > 0 ? (
        <section className="dashboard-cost-strip" aria-label="Kostenblick">
          <DashboardCostSignal
            href={`/${locale}/costs`}
            label="Teuerste"
            machineName={mostExpensiveMachine?.machine.name ?? "-"}
            value={mostExpensiveMachine?.result.costPerOperatingHour ?? null}
          />
          <DashboardCostSignal
            href={`/${locale}/costs`}
            label="Guenstigste"
            machineName={cheapestMachine?.machine.name ?? "-"}
            value={cheapestMachine?.result.costPerOperatingHour ?? null}
          />
          <DashboardCostSignal
            href={`/${locale}/costs`}
            label="Wartung hoch"
            machineName={highMaintenanceMachine?.machine.name ?? "-"}
            value={highMaintenanceMachine?.result.variableCosts.maintenanceCostsPerHour ?? null}
          />
        </section>
      ) : null}

      <section className="dashboard-actions" aria-label="Schnellaktionen">
        {quickActions.map((action, index) => (
          <Link className={index === 0 ? "button primary large-action" : "button large-action"} href={action.href} key={action.href}>
            {action.label}
          </Link>
        ))}
      </section>
    </main>
  );
}

type DashboardCostSignalProps = {
  href: string;
  label: string;
  machineName: string;
  value: number | null;
};

function DashboardCostSignal({ href, label, machineName, value }: DashboardCostSignalProps) {
  return (
    <Link className="dashboard-cost-signal" href={href}>
      <span>{label}</span>
      <strong>{value === null ? "-" : `${formatCurrency(value)}/h`}</strong>
      <small>{machineName}</small>
    </Link>
  );
}

type DashboardFocusCardProps = {
  helper: string;
  href: string;
  id: DashboardCardId;
  label: string;
  tone: DashboardCardTone;
  value: string;
};

type DashboardCardId = "maintenance" | "spareParts" | "reminders";
type DashboardCardTone = "primary" | "good" | "warning" | "danger" | "earth";

function DashboardFocusCard({ helper, href, label, tone, value }: Omit<DashboardFocusCardProps, "id">) {
  return (
    <Link className={`dashboard-focus-card ${tone}`} href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </Link>
  );
}

type DashboardCardInput = {
  criticalLowStockCount: number;
  dueMaintenanceCount: number;
  farmConfig: FarmAppConfig;
  importantReminderCount: number;
  lowStockSparePartsCount: number;
  locale: Locale;
};

function createDailyCards({
  criticalLowStockCount,
  dueMaintenanceCount,
  farmConfig,
  importantReminderCount,
  lowStockSparePartsCount,
  locale
}: DashboardCardInput): DashboardFocusCardProps[] {
  const cards: DashboardFocusCardProps[] = [
    {
      id: "maintenance",
      tone: dueMaintenanceCount > 0 ? "danger" : "good",
      label: "Wartung",
      value: dueMaintenanceCount.toString(),
      helper: dueMaintenanceCount === 0 ? "ok" : "faellig",
      href: `/${locale}/maintenance?filter=due`
    },
    {
      id: "reminders",
      tone: importantReminderCount > 0 ? "danger" : "good",
      label: "Erinnerungen",
      value: importantReminderCount.toString(),
      helper: importantReminderCount === 0 ? "ok" : "offen",
      href: `/${locale}/reminders`
    },
    {
      id: "spareParts",
      tone: criticalLowStockCount > 0 ? "danger" : "warning",
      label: "Lager",
      value: lowStockSparePartsCount.toString(),
      helper: criticalLowStockCount > 0 ? "kritisch" : "niedrig",
      href: `/${locale}/machines`
    }
  ];

  return cards.filter((card) => isDashboardCardEnabled(card.id, farmConfig, lowStockSparePartsCount));
}

type DashboardQuickAction = {
  href: string;
  label: string;
  module: keyof FarmAppConfig["enabledModules"];
};

function createDashboardQuickActions({ farmConfig, locale }: Pick<DashboardCardInput, "farmConfig" | "locale">): DashboardQuickAction[] {
  const actions: DashboardQuickAction[] = [
    { label: "Tagesstand erfassen", href: `/${locale}/daily-usage`, module: "dailyUsage" },
    { label: "Wartung oeffnen", href: `/${locale}/maintenance`, module: "maintenance" },
    { label: "Maschine hinzufuegen", href: `/${locale}/machines`, module: "machines" }
  ];

  return actions.filter((action) => farmConfig.enabledModules[action.module]);
}

function isDashboardCardEnabled(id: DashboardFocusCardProps["id"], farmConfig: FarmAppConfig, lowStockSparePartsCount: number): boolean {
  const enabledModules: Record<DashboardCardId, boolean> = {
    maintenance: farmConfig.enabledModules.maintenance,
    reminders: true,
    spareParts: farmConfig.enabledModules.machines && lowStockSparePartsCount > 0
  };

  return enabledModules[id];
}

type ImportantItem = {
  href: string;
  id: string;
  label: string;
  meta: string;
  title: string;
  tone: "danger" | "warning" | "neutral";
};

type ImportantItemInput = {
  farmConfig: FarmAppConfig;
  locale: Locale;
  lowStockSpareParts: MachineSparePart[];
  machines: MachineSummary[];
  maintenanceTasks: MaintenanceTask[];
};

function createImportantItems({
  farmConfig,
  locale,
  lowStockSpareParts,
  machines,
  maintenanceTasks
}: ImportantItemInput): ImportantItem[] {
  const items: ImportantItem[] = [];

  if (farmConfig.enabledModules.maintenance) {
    for (const task of maintenanceTasks) {
      const machine = machines.find((item) => item.id === task.machineId);
      const status = getMaintenanceDisplayStatus(task, machine);

      if (status !== "due" && !isDueToday(task)) {
        continue;
      }

      items.push({
        id: `maintenance-${task.id}`,
        tone: isOverdue(task, machine) ? "danger" : "warning",
        label: isOverdue(task, machine) ? "Ueberfaellig" : "Heute",
        title: task.title,
        meta: machine?.name ?? "Wartung",
        href: `/${locale}/maintenance?filter=due&taskId=${task.id}`
      });
    }
  }

  if (farmConfig.enabledModules.machines) {
    for (const part of lowStockSpareParts) {
      const machine = machines.find((item) => item.id === part.machineId);
      const stockStatus = getMachineSparePartStockStatus(part);
      const isCritical = stockStatus === "critical" || stockStatus === "empty";
      items.push({
        id: `spare-part-${part.id}`,
        tone: isCritical ? "danger" : "warning",
        label: isCritical ? "Nachbestellen" : "Lager niedrig",
        title: part.name,
        meta: machine ? `${machine.name} / ${part.storageLocation || "Lager"}` : part.partNumber ?? "Ersatzteil",
        href: `/${locale}/machines/${part.machineId}`
      });
    }
  }

  return items.slice(0, maxImportantItems);
}

function createStatusSummary(input: {
  criticalLowStockCount: number;
  dueMaintenanceCount: number;
  importantCount: number;
  lowStockSparePartsCount: number;
}): string {
  if (input.importantCount === 0) {
    return "Alles ruhig";
  }

  if (input.dueMaintenanceCount > 0) {
    return `${input.dueMaintenanceCount} Wartung faellig`;
  }

  if (input.lowStockSparePartsCount > 0) {
    return input.criticalLowStockCount > 0 ? `${input.criticalLowStockCount} Teil kritisch` : `${input.lowStockSparePartsCount} Lager pruefen`;
  }

  return "Pruefen";
}

function formatDashboardDate(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function isDueToday(task: MaintenanceTask): boolean {
  if (!task.dueDate || task.status === "completed" || task.status === "cancelled") {
    return false;
  }

  return startOfDay(task.dueDate).getTime() === startOfDay().getTime();
}

function isOverdue(task: MaintenanceTask, machine?: MachineSummary): boolean {
  if (task.status === "completed" || task.status === "cancelled") {
    return false;
  }

  if (task.dueDate && startOfDay(task.dueDate).getTime() < startOfDay().getTime()) {
    return true;
  }

  if (machine && task.dueOperatingHours !== null && task.dueOperatingHours <= machine.currentOperatingHours) {
    return true;
  }

  if (machine && task.dueKilometers !== null && machine.currentKilometers !== null && task.dueKilometers <= machine.currentKilometers) {
    return true;
  }

  return false;
}

function startOfDay(value?: string): Date {
  const date = value ? new Date(value) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
