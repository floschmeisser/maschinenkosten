import type { MachineCategory } from "./machines";

export type MachineCategoryGroupId = "tractor" | "selfpropelled" | "implement" | "vehicle";

export type CategoryGroupDef = {
  id: MachineCategoryGroupId;
  label: string;
  icon: string;
  categories: MachineCategory[];
};

// Canonical 4 emojis — use these everywhere, never deviate
export const CATEGORY_EMOJIS: Record<MachineCategoryGroupId, string> = {
  tractor:      "🚜",
  selfpropelled: "🌾",
  implement:    "⚙️",
  vehicle:      "🚗",
};

export const CATEGORY_GROUPS: CategoryGroupDef[] = [
  {
    id: "tractor",
    label: "Traktoren",
    icon: CATEGORY_EMOJIS.tractor,
    categories: ["tractor"]
  },
  {
    id: "selfpropelled",
    label: "Selbstfahrer",
    icon: CATEGORY_EMOJIS.selfpropelled,
    categories: ["loader", "harvester", "sprayer", "slurry"]
  },
  {
    id: "implement",
    label: "Geräte",
    icon: CATEGORY_EMOJIS.implement,
    categories: ["grassland", "tillage", "transport", "trailer", "press", "chainsaw", "other"]
  },
  {
    id: "vehicle",
    label: "Autos",
    icon: CATEGORY_EMOJIS.vehicle,
    categories: ["vehicle"]
  }
];

/** Canonical emoji for any DB machine category */
export function getCategoryEmoji(cat: MachineCategory): string {
  return getCategoryGroup(cat).icon;
}

/** Canonical label for any DB machine category */
export function getCategoryGroupLabel(cat: MachineCategory): string {
  return getCategoryGroup(cat).label;
}

export function getCategoryGroup(category: MachineCategory): CategoryGroupDef {
  return CATEGORY_GROUPS.find((g) => g.categories.includes(category)) ?? CATEGORY_GROUPS[2];
}

export function getCategoryGroupById(id: string): CategoryGroupDef | undefined {
  return CATEGORY_GROUPS.find((g) => g.id === id);
}

export function isCategoryGroupId(value: string): value is MachineCategoryGroupId {
  return CATEGORY_GROUPS.some((g) => g.id === value);
}
