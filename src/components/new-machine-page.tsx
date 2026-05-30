"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import type { CreateMachineInput } from "@/lib/app/machines";
import { createMachine } from "@/lib/app/machines-database";
import { MachineFormModal } from "./machine-form-modal";

type NewMachinePageClientProps = {
  locale: Locale;
};

export function NewMachinePageClient({ locale }: NewMachinePageClientProps) {
  const router = useRouter();

  async function handleSave(input: CreateMachineInput) {
    const newMachine = await createMachine(input);
    router.push(`/${locale}/machines/${newMachine.id}`);
  }

  return <MachineFormModal mode="page" formMode="create" onSave={handleSave} onCancel={() => router.push(`/${locale}/machines`)} />;
}
