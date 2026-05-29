import { ReminderCenter } from "@/components/reminder-center";
import { defaultLocale, isLocale } from "@/i18n/routing";

type RemindersPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function RemindersPage({ params }: RemindersPageProps) {
  const { locale } = await params;

  return <ReminderCenter locale={isLocale(locale) ? locale : defaultLocale} />;
}
