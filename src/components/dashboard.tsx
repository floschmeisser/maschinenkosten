"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/routing";
import { calculateMachineCosts, createCostInputFromMachine, defaultCostInputs } from "@/lib/app/cost-calculation";
import { getActiveFarmConfig, type FarmAppConfig, type FarmProfileKey } from "@/lib/app/farm-config";
import { formatCurrency } from "@/lib/app/format";
import type { MachineSummary } from "@/lib/app/machines";
import { getMachines as getPlaceholderMachines, toMachineSummary } from "@/lib/app/machines";
import { getMachines as loadMachines } from "@/lib/app/machines-database";
import {
  getMaintenanceDisplayStatus,
  getMaintenanceTasks as getPlaceholderMaintenanceTasks,
  getTodaysWorkTasks,
  type MaintenanceTask,
  sortMaintenanceTasksByUrgency
} from "@/lib/app/maintenance";
import { getMaintenanceTasks as loadMaintenanceTasks } from "@/lib/app/maintenance-database";
import { getFarmProfilePreference } from "@/lib/app/preferences";

type DashboardProps = {
  locale: Locale;
};

export function Dashboard({ locale }: DashboardProps) {
  const [farmKey, setFarmKey] = useState<FarmProfileKey>("default");
  const farmConfig = getActiveFarmConfig(farmKey);
  const [machines, setMachines] = useState<MachineSummary[]>(() => getPlaceholderMachines().map(toMachineSummary));
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>(() => getPlaceholderMaintenanceTasks());
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
        const [machineData, taskData] = await Promise.all([loadMachines(), loadMaintenanceTasks()]);
        setMachines(machineData.map(toMachineSummary));
        setMaintenanceTasks(taskData);
      } catch {
        setMachines(getPlaceholderMachines().map(toMachineSummary));
        setMaintenanceTasks(getPlaceholderMaintenanceTasks());
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const sortedMaintenanceTasks = sortMaintenanceTasksByUrgency(maintenanceTasks, machines);
  const todaysWorkCount = getTodaysWorkTasks(maintenanceTasks, machines).length;
  const dueMaintenanceCount = sortedMaintenanceTasks.filter((task) => {
    const machine = machines.find((item) => item.id === task.machineId);
    return getMaintenanceDisplayStatus(task, machine) === "due";
  }).length;
  const activeMachineCount = machines.filter((machine) => machine.status === "active").length;
  const exampleMachine = machines[0];
  const costInput = exampleMachine ? createCostInputFromMachine(exampleMachine, maintenanceTasks) : defaultCostInputs;
  const costs = calculateMachineCosts(costInput);

  const dashboardCards = createDashboardCards({
    activeMachineCount,
    costLabel: costs.costPerOperatingHour === null ? "-" : formatCurrency(costs.costPerOperatingHour),
    dueMaintenanceCount,
    exampleMachineName: exampleMachine?.name ?? "je Stunde",
    farmConfig,
    locale,
    todaysWorkCount
  });
  const quickActions = createDashboardQuickActions({ farmConfig, locale });

  return (
    <main className="page dashboard-page">
      <section className="dashboard-hero">
        <span>{farmConfig.branding.farmName}</span>
        <h1>{farmConfig.branding.welcomeTitle}</h1>
        {isLoading ? <small>Laden...</small> : null}
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
  tone: "primary" | "good" | "warning" | "danger" | "earth";
  value: string;
};

type DashboardCardId = "today" | "maintenance" | "dailyUsage" | "machines" | "costs";

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
  costLabel: string;
  dueMaintenanceCount: number;
  exampleMachineName: string;
  farmConfig: FarmAppConfig;
  locale: Locale;
  todaysWorkCount: number;
};

function createDashboardCards({
  activeMachineCount,
  costLabel,
  dueMaintenanceCount,
  exampleMachineName,
  farmConfig,
  locale,
  todaysWorkCount
}: DashboardCardInput): DashboardFocusCardProps[] {
  const cards: DashboardFocusCardProps[] = [
    {
      id: "today",
      tone: todaysWorkCount > 0 ? "warning" : "good",
      label: "Heute",
      value: todaysWorkCount.toString(),
      helper: todaysWorkCount === 0 ? "Alles erledigt" : "offen",
      href: `/${locale}/maintenance`
    },
    {
      id: "maintenance",
      tone: dueMaintenanceCount > 0 ? "danger" : "good",
      label: "Faellig",
      value: dueMaintenanceCount.toString(),
      helper: dueMaintenanceCount === 0 ? "Keine Wartung" : "Wartung",
      href: `/${locale}/maintenance?filter=due`
    },
    {
      id: "dailyUsage",
      tone: "primary",
      label: farmConfig.customLabels.dailyUsageLabel,
      value: "Jetzt",
      helper: "Tagesstand",
      href: `/${locale}/daily-usage`
    },
    {
      id: "machines",
      tone: "earth",
      label: farmConfig.customLabels.machinesLabel,
      value: activeMachineCount.toString(),
      helper: activeMachineCount === 0 ? "Noch keine" : "aktiv",
      href: `/${locale}/machines`
    },
    {
      id: "costs",
      tone: "primary",
      label: farmConfig.customLabels.costsLabel,
      value: costLabel,
      helper: exampleMachineName,
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
    { label: "Tagesstand erfassen", href: `/${locale}/daily-usage`, module: "dailyUsage" },
    { label: "Wartung oeffnen", href: `/${locale}/maintenance`, module: "maintenance" },
    { label: "Maschine anlegen", href: `/${locale}/machines`, module: "machines" },
    { label: "Kosten ansehen", href: `/${locale}/costs`, module: "costs" }
  ];

  return actions.filter((action) => farmConfig.enabledModules[action.module]);
}

function isDashboardCardEnabled(id: DashboardFocusCardProps["id"], farmConfig: FarmAppConfig): boolean {
  const enabledModules: Record<DashboardCardId, boolean> = {
    today: farmConfig.enabledModules.maintenance,
    maintenance: farmConfig.enabledModules.maintenance,
    dailyUsage: farmConfig.enabledModules.dailyUsage,
    machines: farmConfig.enabledModules.machines,
    costs: farmConfig.enabledModules.costs
  };

  return enabledModules[id];
}
