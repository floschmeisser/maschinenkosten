"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/routing";
import { calculateMachineCosts, createCostInputFromMachine, defaultCostInputs } from "@/lib/app/cost-calculation";
import { getFarmConfig, type FarmAppConfig, type FarmProfileKey } from "@/lib/app/farm-config";
import { formatCurrency, formatNumber } from "@/lib/app/format";
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
  const farmConfig = getFarmConfig(farmKey);
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
  const hectaresLabel =
    exampleMachine?.hectaresPerHour === null || exampleMachine?.hectaresPerHour === undefined
      ? "-"
      : `${formatNumber(exampleMachine.hectaresPerHour)} ha/h`;

  const dashboardCards = createDashboardCards({
    activeMachineCount,
    costLabel: costs.costPerOperatingHour === null ? "-" : formatCurrency(costs.costPerOperatingHour),
    dueMaintenanceCount,
    exampleMachineName: exampleMachine?.name ?? "je Stunde",
    farmConfig,
    hectaresLabel,
    locale,
    todaysWorkCount
  });

  return (
    <main className="page dashboard-page">
      <section className="dashboard-hero">
        <span>{farmConfig.branding.farmName}</span>
        <h1>{farmConfig.branding.welcomeTitle}</h1>
        <p>{farmConfig.branding.welcomeSubtitle}</p>
        {isLoading ? <small>Aktuelle Daten werden geladen...</small> : null}
      </section>

      <section className="dashboard-focus-grid" aria-label="Betriebsuebersicht">
        {dashboardCards.map((card) => (
          <DashboardFocusCard {...card} key={card.id} />
        ))}
      </section>
    </main>
  );
}

type DashboardFocusCardProps = {
  action: string;
  helper: string;
  href: string;
  id: string;
  label: string;
  tone: "primary" | "good" | "warning" | "danger" | "earth";
  value: string;
};

function DashboardFocusCard({ action, helper, href, label, tone, value }: Omit<DashboardFocusCardProps, "id">) {
  return (
    <Link className={`dashboard-focus-card ${tone}`} href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
      <b>{action}</b>
    </Link>
  );
}

type DashboardCardInput = {
  activeMachineCount: number;
  costLabel: string;
  dueMaintenanceCount: number;
  exampleMachineName: string;
  farmConfig: FarmAppConfig;
  hectaresLabel: string;
  locale: Locale;
  todaysWorkCount: number;
};

function createDashboardCards({
  activeMachineCount,
  costLabel,
  dueMaintenanceCount,
  exampleMachineName,
  farmConfig,
  hectaresLabel,
  locale,
  todaysWorkCount
}: DashboardCardInput): DashboardFocusCardProps[] {
  const cards: Record<FarmAppConfig["dashboardFocus"][number], DashboardFocusCardProps | null> = {
    today: farmConfig.enabledModules.maintenance
      ? {
          id: "today",
          tone: todaysWorkCount > 0 ? "warning" : "good",
          label: "Heute",
          value: todaysWorkCount.toString(),
          helper: todaysWorkCount === 1 ? "Aufgabe" : "Aufgaben",
          href: `/${locale}/maintenance`,
          action: "Oeffnen"
        }
      : null,
    maintenance: farmConfig.enabledModules.maintenance
      ? {
          id: "maintenance",
          tone: dueMaintenanceCount > 0 ? "danger" : "good",
          label: farmConfig.customLabels.maintenanceLabel,
          value: dueMaintenanceCount.toString(),
          helper: "faellig",
          href: `/${locale}/maintenance?filter=due`,
          action: "Pruefen"
        }
      : null,
    dailyUsage: farmConfig.enabledModules.dailyUsage
      ? {
          id: "dailyUsage",
          tone: "primary",
          label: farmConfig.customLabels.dailyUsageLabel,
          value: "Jetzt",
          helper: "Staende eintragen",
          href: `/${locale}/daily-usage`,
          action: "Erfassen"
        }
      : null,
    machines: farmConfig.enabledModules.machines
      ? {
          id: "machines",
          tone: "earth",
          label: "Maschinenstatus",
          value: activeMachineCount.toString(),
          helper: "aktiv",
          href: `/${locale}/machines`,
          action: "Ansehen"
        }
      : null,
    costs: farmConfig.enabledModules.costs
      ? {
          id: "costs",
          tone: "primary",
          label: "Kostenuebersicht",
          value: costLabel,
          helper: exampleMachineName,
          href: `/${locale}/costs`,
          action: "Rechnen"
        }
      : null,
    hectares: farmConfig.enabledModules.machines
      ? {
          id: "hectares",
          tone: "earth",
          label: "Hektarleistung",
          value: hectaresLabel,
          helper: exampleMachineName,
          href: `/${locale}/machines`,
          action: "Ansehen"
        }
      : null
  };

  return farmConfig.dashboardFocus.map((focus) => cards[focus]).filter((card): card is DashboardFocusCardProps => card !== null);
}
