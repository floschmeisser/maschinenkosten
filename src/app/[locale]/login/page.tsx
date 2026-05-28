import { LoginPanel } from "@/components/shared-ui-components";

export default function LoginPage() {
  return (
    <main className="page">
      <section className="page-header">
        <h1>Anmelden</h1>
        <p>Benutzerkonten sind noch nicht aktiv. Die App laeuft bis dahin lokal mit Fallback-Daten.</p>
      </section>
      <LoginPanel />
    </main>
  );
}
