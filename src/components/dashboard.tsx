"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatCurrency, formatNumber } from "@/lib/app/format";
import type { MachineSummary } from "@/lib/app/machines";
import { getMachines as getPlaceholderMachines, toMachineSummary } from "@/lib/app/machines";
import { getMachines as loadMachines } from "@/lib/app/machines-database";
import {
  getMaintenanceDisplayStatus,
  getMaintenanceRecurrenceLabel,
  getMaintenanceTasks as getPlaceholderMaintenanceTasks,
  getMaintenanceTypeLabel,
  getMostRelevantDueLabel,
  getTodaysWorkTasks,
  type MaintenanceTask,
  sortMaintenanceTasksByUrgency
} from "@/lib/app/maintenance";
import { getMaintenanceTasks as loadMaintenanceTasks } from "@/lib/app/maintenance-database";
import { calculateMachineCosts, createCostInputFromMachine, defaultCostInputs } from "@/lib/app/cost-calculation";
import type { Locale } from "@/i18n/routing";
import { StatCard } from "./shared-ui-components";

type DashboardProps = {
  locale: Locale;
};

export function Dashboard({ locale }: DashboardProps) {
  const [machines, setMachines] = useState<MachineSummary[]>(() => getPlaceholderMachines().map(toMachineSummary));
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>(() => getPlaceholderMaintenanceTasks());

  useEffect(() => {
    async function loadDashboardData() {
      const [machineData, taskData] = await Promise.all([loadMachines(), loadMaintenanceTasks()]);
      setMachines(machineData.map(toMachineSummary));
      setMaintenanceTasks(taskData);
    }

    loadDashboardData();
  }, []);

  const sortedMaintenanceTasks = sortMaintenanceTasksByUrgency(maintenanceTasks, machines);
  const openMaintenance = maintenanceTasks.filter((task) => task.status !== "completed" && task.status !== "cancelled").length;
  const dueMaintenance = sortedMaintenanceTasks.filter((task) => {
    const machine = machines.find((item) => item.id === task.machineId);
    return getMaintenanceDisplayStatus(task, machine) === "due";
  }).length;
  const todaysWorkTasks = getTodaysWorkTasks(maintenanceTasks, machines);
  const exampleMachine = machines[0];
  const costInput = exampleMachine ? createCostInputFromMachine(exampleMachine, maintenanceTasks) : defaultCostInputs;
  const costs = calculateMachineCosts(costInput);
  const activeMachines = machines.filter((machine) => machine.status === "active");
  const dueTasks = sortedMaintenanceTasks.filter((task) => {
    const machine = machines.find((item) => item.id === task.machineId);
    return getMaintenanceDisplayStatus(task, machine) === "due";
  });

  return (
    <main className="page">
      <section className="page-header">
        <h1>Dashboard</h1>
        <p>Der schnelle Blick auf Maschinen, Wartung und Kosten im Betrieb.</p>
      </section>

      <section className="stats-grid" aria-label="Uebersicht">
        <StatCard label="Maschinen" value={machines.length.toString()} helper="angelegt" />
        <StatCard label="Wartung offen" value={openMaintenance.toString()} helper="Aufgaben" />
        <StatCard label="Heute zu erledigen" value={todaysWorkTasks.length.toString()} helper="dringend" />
        <StatCard label="Faellige Wartung" value={dueMaintenance.toString()} helper="heute pruefen" />
        <StatCard
          label="Kosten je Stunde"
          value={costs.costPerOperatingHour === null ? "-" : formatCurrency(costs.costPerOperatingHour)}
          helper={exampleMachine ? exampleMachine.name : "Beispiel"}
        />
      </section>

      <section className="quick-actions panel" aria-label="Schnellaktionen">
        <div className="panel-heading">
          <h2>Schnellaktionen</h2>
          <span className="muted">Fuer den Alltag</span>
        </div>
        <div className="action-grid">
          <Link className="button primary large-action" href={`/${locale}/daily-usage`}>
            Tagesstand erfassen
          </Link>
          <Link className="button large-action" href={`/${locale}/machines/new`}>
            Maschine anlegen
          </Link>
          <Link className="button large-action" href={`/${locale}/maintenance`}>
            Wartung anlegen
          </Link>
        </div>
      </section>

      <section className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Heute zu erledigen</h2>
            <Link className="button" href={`/${locale}/maintenance`}>
              Oeffnen
            </Link>
          </div>
          <p className="muted">Was heute in der Werkstatt zuerst zaehlt.</p>
          <DashboardTaskList machines={machines} tasks={todaysWorkTasks.slice(0, 3)} emptyText="Heute nichts Dringendes" />
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Faellige Wartung</h2>
            <Link className="button" href={`/${locale}/maintenance?filter=due`}>
              Faellige zeigen
            </Link>
          </div>
          <p className="muted">Aufgaben, die nach Datum, Stunden oder Kilometern faellig sind.</p>
          <DashboardTaskList machines={machines} tasks={dueTasks.slice(0, 3)} emptyText="Keine faellige Wartung" />
        </section>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Maschinenuebersicht</h2>
          <Link className="button" href={`/${locale}/machines`}>
            Maschinen oeffnen
          </Link>
        </div>
        <p className="muted">Aktive Maschinen und die letzten bekannten Staende.</p>
        <div className="mini-list">
          {activeMachines.slice(0, 4).map((machine) => (
            <Link className="mini-list-item" href={`/${locale}/machines/${machine.id}`} key={machine.id}>
              <span>{machine.name}</span>
              <strong>{formatNumber(machine.currentOperatingHours)} h</strong>
            </Link>
          ))}
          {activeMachines.length === 0 ? <EmptyMiniList label="Keine aktiven Maschinen" value="-" /> : null}
        </div>
      </section>
    </main>
  );
}

type DashboardTaskListProps = {
  emptyText: string;
  machines: MachineSummary[];
  tasks: MaintenanceTask[];
};

function DashboardTaskList({ emptyText, machines, tasks }: DashboardTaskListProps) {
  return (
    <div className="mini-list">
      {tasks.map((task) => {
        const machine = machines.find((item) => item.id === task.machineId);

        return (
          <div className="mini-list-item" key={task.id}>
            <span>
              {machine?.name ?? "Unbekannte Maschine"} / {getMaintenanceTypeLabel(task.type)} / {getMaintenanceRecurrenceLabel(task)}
            </span>
            <strong>{getMostRelevantDueLabel(task, machine)}</strong>
          </div>
        );
      })}
      {tasks.length === 0 ? <EmptyMiniList label={emptyText} value="OK" /> : null}
    </div>
  );
}

function EmptyMiniList({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-list-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
