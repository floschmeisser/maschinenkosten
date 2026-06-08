import { MachineManagement } from "@/components/machine-management";
import { isLocale } from "@/i18n/routing";
import { isCategoryGroupId, type MachineCategoryGroupId } from "@/lib/app/machine-categories";

type MachinesPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MachinesPage({ params, searchParams }: MachinesPageProps) {
  const { locale: localeParam } = await params;
  const locale = isLocale(localeParam) ? localeParam : "de";
  const resolvedSearch = await searchParams;
  const categoryParam = typeof resolvedSearch.category === "string" ? resolvedSearch.category : undefined;
  const defaultCategory: MachineCategoryGroupId | undefined =
    categoryParam && isCategoryGroupId(categoryParam) ? categoryParam : undefined;

  return <MachineManagement locale={locale} defaultCategory={defaultCategory} />;
}
