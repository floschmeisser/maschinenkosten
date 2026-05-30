import type { ReactNode } from "react";
import "../globals.css";
import { AppShell } from "@/components/app-shell";
import { getMessages } from "@/i18n/request";
import { isLocale, locales, type Locale } from "@/i18n/routing";

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{
    locale: string;
  }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

type LocaleParamsProps = {
  params: Promise<{
    locale: string;
  }>;
};

export async function generateMetadata({ params }: LocaleParamsProps) {
  const { locale: localeParam } = await params;
  const locale = isLocale(localeParam) ? localeParam : "de";
  const messages = await getMessages(locale);

  return {
    title: messages.app.name,
    description: messages.app.description
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "de";
  const messages = await getMessages(locale);

  return (
    <html lang={locale}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MaschinenKosten" />
        <link rel="apple-touch-icon" href="/assets/icon-192.png" />
        <meta name="theme-color" content="#2d5a1b" />
      </head>
      <body>
        <AppShell locale={locale} messages={messages}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
