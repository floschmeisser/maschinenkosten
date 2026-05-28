"use client";

import { useEffect, useState } from "react";
import type { MachineSummary } from "@/lib/app/machines";
import { toMachineSummary } from "@/lib/app/machines";
import { getMachineById } from "@/lib/app/machines-database";
import { MachineDetail } from "./machine-management";

type MachineDetailPageClientProps = {
  machineId: string;
};

export function MachineDetailPageClient({ machineId }: MachineDetailPageClientProps) {
  const [machine, setMachine] = useState<MachineSummary | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    async function loadMachine() {
      const machineData = await getMachineById(machineId);
      setMachine(machineData ? toMachineSummary(machineData) : null);
      setHasLoaded(true);
    }

    loadMachine();
  }, [machineId]);

  if (!hasLoaded) {
    return (
      <main className="page">
        <section className="panel empty-state">
          <strong>Maschine wird geladen...</strong>
          <p>Die Detaildaten werden aus Supabase oder dem lokalen Fallback geholt.</p>
        </section>
      </main>
    );
  }

  if (!machine) {
    return (
      <main className="page">
        <section className="page-header empty-state">
          <h1>Maschine nicht gefunden</h1>
          <p>Diese Maschine ist im lokalen Fallback oder in Supabase nicht vorhanden.</p>
        </section>
      </main>
    );
  }

  return <MachineDetail machine={machine} />;
}
