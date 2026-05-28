"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/i18n/routing";
import { getMachines as loadMachines } from "@/lib/app/machines-database";
import { getMaintenanceTasks as loadMaintenanceTasks } from "@/lib/app/maintenance-database";
import { getMachines as getPlaceholderMachines, toMachineSummary, type MachineSummary } from "@/lib/app/machines";
import {
  getMaintenanceTasks as getPlaceholderMaintenanceTasks,
  getMaintenanceTypeLabel,
  type MaintenanceTask
} from "@/lib/app/maintenance";

type GlobalSearchProps = {
  locale: Locale;
  placeholder: string;
};

type SearchResult = {
  href: string;
  label: string;
  meta: string;
};

export function GlobalSearch({ locale, placeholder }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [machines, setMachines] = useState<MachineSummary[]>(() => getPlaceholderMachines().map(toMachineSummary));
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>(() => getPlaceholderMaintenanceTasks());

  useEffect(() => {
    async function loadSearchData() {
      const [machineData, taskData] = await Promise.all([loadMachines(), loadMaintenanceTasks()]);
      setMachines(machineData.map(toMachineSummary));
      setMaintenanceTasks(taskData);
    }

    loadSearchData();
  }, []);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.length < 2) {
      return [];
    }

    const machineResults = machines
      .filter((machine) =>
        [machine.name, machine.manufacturer, machine.model, machine.displayCategory].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        )
      )
      .slice(0, 4)
      .map<SearchResult>((machine) => ({
        href: `/${locale}/machines/${machine.id}`,
        label: machine.name,
        meta: `${machine.manufacturer} ${machine.model}`
      }));

    const maintenanceResults = maintenanceTasks
      .filter((task) =>
        [task.title, getMaintenanceTypeLabel(task.type), task.notes ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery))
      )
      .slice(0, 4)
      .map<SearchResult>((task) => {
        const machine = machines.find((item) => item.id === task.machineId);

        return {
          href: `/${locale}/maintenance?taskId=${encodeURIComponent(task.id)}`,
          label: task.title,
          meta: machine ? `Wartung / ${machine.name}` : "Wartung"
        };
      });

    return [...machineResults, ...maintenanceResults].slice(0, 6);
  }, [locale, machines, maintenanceTasks, query]);

  return (
    <div className="search">
      <label>
        <span className="sr-only">Suche</span>
        <input
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-expanded={query.trim().length >= 2}
        />
      </label>
      {query.trim().length >= 2 ? (
        <div className="search-results">
          {results.length > 0 ? (
            results.map((result) => (
              <Link href={result.href} key={`${result.href}-${result.label}`} onClick={() => setQuery("")}>
                <strong>{result.label}</strong>
                <span>{result.meta}</span>
              </Link>
            ))
          ) : (
            <p>Keine Treffer</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
