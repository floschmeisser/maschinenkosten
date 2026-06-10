"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Messages } from "@/i18n/request";
import type { Locale } from "@/i18n/routing";
import { getActiveFarmConfig } from "@/lib/app/farm-config";
import type { FarmProfileKey } from "@/lib/app/farm-config";
import { getFarmProfilePreference } from "@/lib/app/preferences";
import { GlobalSearch } from "./global-search";
import { ToastProvider } from "@/contexts/toast-context";

type AppShellProps = {
  children: ReactNode;
  locale: Locale;
  messages: Messages;
};

const BOTTOM_TABS = [
  { key: "dashboard",   label: "Übersicht",  icon: "🏠" },
  { key: "machines",    label: "Maschinen",  icon: "🚜" },
  { key: "maintenance", label: "Wartung",    icon: "🔧" },
  { key: "settings",    label: "Mehr",       icon: "⚙️" },
] as const;

export function AppShell({ children, locale, messages }: AppShellProps) {
  const pathname = usePathname();
  const [farmKey, setFarmKey] = useState<FarmProfileKey>("default");
  const farmConfig = getActiveFarmConfig(farmKey);
  const shellStyle = {
    "--color-bg": farmConfig.branding.backgroundColor,
    "--color-primary": farmConfig.branding.primaryColor,
    "--color-warning": farmConfig.branding.accentColor
  } as CSSProperties;

  useEffect(() => {
    function syncFarmProfile() { setFarmKey(getFarmProfilePreference()); }
    syncFarmProfile();
    window.addEventListener("maschinenkosten.farmProfileChanged", syncFarmProfile);
    window.addEventListener("storage", syncFarmProfile);
    return () => {
      window.removeEventListener("maschinenkosten.farmProfileChanged", syncFarmProfile);
      window.removeEventListener("storage", syncFarmProfile);
    };
  }, []);

  function isActive(key: string) {
    const href = `/${locale}/${key}`;
    if (key === "dashboard" && (pathname === `/${locale}` || pathname === `/${locale}/dashboard`)) return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="shell" style={shellStyle}>
      {/* ── Desktop Top Header ── */}
      <header className="topbar">
        <Link href={`/${locale}/dashboard`} className="brand" aria-label={farmConfig.branding.appName || messages.app.name}>
          <Image src={farmConfig.branding.logoPath} alt="" width={160} height={40} priority />
          <span>
            <strong>{farmConfig.branding.appName}</strong>
            <small>{farmConfig.branding.farmName}</small>
          </span>
        </Link>
        {/* Desktop nav items inline in topbar */}
        <nav className="topbar-nav" aria-label="Hauptnavigation">
          {BOTTOM_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/${locale}/${tab.key}`}
              className={`topbar-nav-item${isActive(tab.key) ? " active" : ""}`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <GlobalSearch locale={locale} placeholder={messages.search.placeholder} />
      </header>

      <div className="layout">
        <div className="content">
          <ToastProvider>{children}</ToastProvider>
        </div>
      </div>

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav className="nav-bottom" aria-label="Navigation">
        {BOTTOM_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/${locale}/${tab.key}`}
            className={`nav-bottom-item${isActive(tab.key) ? " active" : ""}`}
          >
            <span className="nav-bottom-icon">{tab.icon}</span>
            <span className="nav-bottom-label">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
