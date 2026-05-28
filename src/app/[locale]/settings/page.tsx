import { SettingsPanel } from "@/components/shared-ui-components";

export default function SettingsPage() {
  return (
    <main className="page">
      <section className="page-header">
        <h1>Einstellungen</h1>
      </section>
      <SettingsPanel />
    </main>
  );
}
