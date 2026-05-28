import { MachineFormModal } from "@/components/machine-form-modal";

export default function NewMachinePage() {
  return (
    <main className="page">
      <section className="page-header">
        <h1>Neue Maschine</h1>
        <p>Erfasse die wichtigsten Grunddaten. Speichern wird spaeter mit Supabase verbunden.</p>
      </section>
      <MachineFormModal mode="page" />
    </main>
  );
}
