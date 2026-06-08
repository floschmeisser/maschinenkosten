import type { MachineCategory } from "./machines";

export type MachineCategoryGroupId = "tractor" | "selfpropelled" | "implement" | "vehicle";

export type CategoryGroupDef = {
  id: MachineCategoryGroupId;
  label: string;
  icon: string;
  categories: MachineCategory[];
};

export const CATEGORY_GROUPS: CategoryGroupDef[] = [
  {
    id: "tractor",
    label: "Traktoren",
    icon: "🚜",
    categories: ["tractor"]
  },
  {
    id: "selfpropelled",
    label: "Selbstfahrer",
    icon: "🌾",
    categories: ["loader", "harvester", "sprayer", "slurry"]
  },
  {
    id: "implement",
    label: "Geräte",
    icon: "🔧",
    categories: ["grassland", "tillage", "transport", "trailer", "press", "chainsaw", "other"]
  },
  {
    id: "vehicle",
    label: "Autos",
    icon: "🚗",
    categories: ["vehicle"]
  }
];

export function getCategoryGroup(category: MachineCategory): CategoryGroupDef {
  return CATEGORY_GROUPS.find((g) => g.categories.includes(category)) ?? CATEGORY_GROUPS[2];
}

export function getCategoryGroupById(id: string): CategoryGroupDef | undefined {
  return CATEGORY_GROUPS.find((g) => g.id === id);
}

export function isCategoryGroupId(value: string): value is MachineCategoryGroupId {
  return CATEGORY_GROUPS.some((g) => g.id === value);
}
