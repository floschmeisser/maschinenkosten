"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { createNavigation } from "@/i18n/navigation";
import type { Messages } from "@/i18n/request";
import type { Locale } from "@/i18n/routing";
import { GlobalSearch } from "./global-search";

type AppShellProps = {
  children: ReactNode;
  locale: Locale;
  messages: Messages;
};

export function AppShell({ children, locale, messages }: AppShellProps) {
  const pathname = usePathname();
  const navItems = createNavigation(locale);

  return (
    <div className="shell">
      <header className="topbar">
        <Link href={`/${locale}/dashboard`} className="brand" aria-label={messages.app.name}>
          <Image src="/assets/logo.svg" alt="" width={160} height={40} priority />
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
