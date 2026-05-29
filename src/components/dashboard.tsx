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
import { syncRemindersFromCurrentData } from "@/lib/app/reminder-sync";

type DashboardProps = {
  locale: Locale;
};

export function Dashboard({ locale }: DashboardProps) {
  const [farmKey, setFarmKey] = useState<FarmProfileKey>("default");
  const farmConfig = getActiveFarmConfig(farmKey);
  const [machines, setMachines] = useState<MachineSummary[]>(() => getPlaceholderMachines().map(toMachineSummary));
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>(() => getPlaceholderMaintenanceTasks());
  const [lowStockSpareParts, setLowStockSpareParts] = useState<MachineSparePart[]>([]);
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
        const [machineData, taskData, lowStockSpareParts] = await Promise.all([
          loadMachines(),
          loadMaintenanceTasks(),
          getLowStockSpareParts()
        ]);

        setMachines(machineData.map(toMachineSummary));
        setMaintenanceTasks(taskData);
        setLowStockSpareParts(lowStockSpareParts);
        void syncRemindersFromCurrentData().catch(() => undefined);
      } catch {
        setMachines(getPlaceholderMachines().map(toMachineSummary));
        setMaintenanceTasks(getPlaceholderMaintenanceTasks());
        setLowStockSpareParts([]);
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
  const activeMachineCount = machines.filter((machine) => machine.status === "active").length;
  const costComparisonItems = createMachineCostComparison(machines, maintenanceTasks);
  const mostExpensiveMachine = costComparisonItems[0];
  const importantItems = createImportantItems({
    farmConfig,
    locale,
    lowStockSpareParts,
    machines,
    maintenanceTasks: sortedMaintenanceTasks
  });
  const mostImportantItem = importantItems[0] ?? null;
  const dashboardCards = createDailyCards({
    activeMachineCount,
    dueMaintenanceCount,
    farmConfig,
    lowStockSparePartsCount: lowStockSpareParts.length,
    locale,
    mostExpensiveCost: mostExpensiveMachine?.result.costPerOperatingHour ?? null
  });
  const quickActions = createDashboardQuickActions({ farmConfig, locale });

  return (
    <main className="page dashboard-page">
      <section className="dashboard-date" aria-label="Datum">
        <strong>{formatDashboardDate(new Date())}</strong>
      </section>

      <section className="dashboard-important" aria-label="Wichtig">
        {isLoading ? (
          <div className="dashboard-empty">
            <strong>Laden...</strong>
          </div>
        ) : mostImportantItem ? (
          <Link className={`important-item ${mostImportantItem.tone}`} href={mostImportantItem.href}>
            <strong>{mostImportantItem.title}</strong>
            <small>{mostImportantItem.meta}</small>
          </Link>
        ) : (
          <div className="dashboard-empty">
            <strong>Alles erledigt</strong>
          </div>
        )}
      </section>

      <section className="dashboard-focus-grid" aria-label="Betriebsuebersicht">
        {dashboardCards.map((card) => (
          <DashboardFocusCard {...card} key={card.id} />
        ))}
      </section>

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

type DashboardFocusCardProps = {
  helper: string;
  href: string;
  id: DashboardCardId;
  label: string;
  tone: DashboardCardTone;
  value: string;
};

type DashboardCardId = "maintenance" | "spareParts" | "machines" | "costs";
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
  activeMachineCount: number;
  dueMaintenanceCount: number;
  farmConfig: FarmAppConfig;
  lowStockSparePartsCount: number;
  locale: Locale;
  mostExpensiveCost: number | null;
};

function createDailyCards({
  activeMachineCount,
  dueMaintenanceCount,
  farmConfig,
  lowStockSparePartsCount,
  locale,
  mostExpensiveCost
}: DashboardCardInput): DashboardFocusCardProps[] {
  const cards: DashboardFocusCardProps[] = [
    {
      id: "maintenance",
      tone: dueMaintenanceCount > 0 ? "danger" : "good",
      label: "Wartung",
      value: dueMaintenanceCount.toString(),
      helper: "offen",
      href: `/${locale}/maintenance?filter=due`
    },
    {
      id: "spareParts",
      tone: lowStockSparePartsCount > 0 ? "warning" : "good",
      label: "Lager",
      value: lowStockSparePartsCount.toString(),
      helper: "niedrig",
      href: `/${locale}/machines`
    },
    {
      id: "machines",
      tone: "earth",
      label: "Maschinen",
      value: activeMachineCount.toString(),
      helper: "aktiv",
      href: `/${locale}/machines`
    },
    {
      id: "costs",
      tone: "primary",
      label: "Kosten",
      value: mostExpensiveCost === null ? "-" : `${formatCurrency(mostExpensiveCost)}/h`,
      helper: "hoechste",
      href: `/${locale}/costs`
    }
  ];

  return cards.filter((card) => isDashboardCardEnabled(card.id, farmConfig));
}

type DashboardQuickAction = {
  href: string;
  label: string;
  module: keyof FarmAppConfig["enabledModules"];
};

function createDashboardQuickActions({ farmConfig, locale }: Pick<DashboardCardInput, "farmConfig" | "locale">): DashboardQuickAction[] {
  const actions: DashboardQuickAction[] = [
    { label: "Tagesstand", href: `/${locale}/daily-usage`, module: "dailyUsage" },
    { label: "Wartung", href: `/${locale}/maintenance`, module: "maintenance" },
    { label: "Maschine", href: `/${locale}/machines`, module: "machines" }
  ];

  return actions.filter((action) => farmConfig.enabledModules[action.module]);
}

function isDashboardCardEnabled(id: DashboardFocusCardProps["id"], farmConfig: FarmAppConfig): boolean {
  const enabledModules: Record<DashboardCardId, boolean> = {
    maintenance: farmConfig.enabledModules.maintenance,
    spareParts: farmConfig.enabledModules.machines,
    machines: farmConfig.enabledModules.machines,
    costs: farmConfig.enabledModules.costs
  };

  return enabledModules[id];
}

type ImportantItem = {
  href: string;
  id: string;
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
        title: part.name,
        meta: machine ? `${machine.name} / ${part.storageLocation || "Lager"}` : part.partNumber ?? "Ersatzteil",
        href: `/${locale}/machines/${part.machineId}`
      });
    }
  }

  return items.slice(0, 1);
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
