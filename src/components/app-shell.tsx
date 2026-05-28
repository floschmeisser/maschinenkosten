"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createNavigation } from "@/i18n/navigation";
import type { Messages } from "@/i18n/request";
import type { Locale } from "@/i18n/routing";
import { getFarmConfig } from "@/lib/app/farm-config";
import type { FarmProfileKey } from "@/lib/app/farm-config";
import { getFarmProfilePreference } from "@/lib/app/preferences";
import { GlobalSearch } from "./global-search";

type AppShellProps = {
  children: ReactNode;
  locale: Locale;
  messages: Messages;
};

export function AppShell({ children, locale, messages }: AppShellProps) {
  const pathname = usePathname();
  const [farmKey, setFarmKey] = useState<FarmProfileKey>("default");
  const farmConfig = getFarmConfig(farmKey);
  const navItems = createNavigation(locale, farmConfig);
  const shellStyle = {
    "--color-bg": farmConfig.branding.backgroundColor,
    "--color-primary": farmConfig.branding.primaryColor,
    "--color-warning": farmConfig.branding.accentColor
  } as CSSProperties;

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

  return (
    <div className="shell" style={shellStyle}>
      <header className="topbar">
        <Link href={`/${locale}/dashboard`} className="brand" aria-label={farmConfig.branding.appName || messages.app.name}>
          <Image src={farmConfig.branding.logoPath} alt="" width={160} height={40} priority />
          <span>
            <strong>{farmConfig.branding.appName}</strong>
            <small>{farmConfig.branding.farmName}</small>
          </span>
        </Link>
        <GlobalSearch locale={locale} placeholder={messages.search.placeholder} />
      </header>

      <div className="layout">
        <nav className="nav" aria-label="Hauptnavigation">
          {navItems.map((item) => {
            const isDashboardRoot = item.href === `/${locale}/dashboard` && pathname === `/${locale}`;
            const isActive = isDashboardRoot || pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link className={isActive ? "nav-link active" : "nav-link"} href={item.href} key={item.href}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
