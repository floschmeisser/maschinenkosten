import { LoginPanel } from "@/components/shared-ui-components";

export default function LoginPage() {
  return (
    <main className="page">
      <section className="page-header">
        <h1>Anmelden</h1>
        <p>Der Zugang ist vorbereitet. Supabase Auth wird im naechsten Schritt verbunden.</p>
      </section>
      <LoginPanel />
    </main>
  );
}
