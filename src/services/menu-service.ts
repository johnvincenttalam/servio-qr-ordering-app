import { MENU_ITEMS } from "@/constants/menu-data";
import { CATEGORY_LABELS } from "@/constants";
import type { MenuItem, MenuCategory } from "@/types";

const SIMULATED_DELAY = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchMenu(): Promise<MenuItem[]> {
  await delay(SIMULATED_DELAY);
  return MENU_ITEMS;
}

export async function fetchCategories(): Promise<
  { id: MenuCategory; label: string }[]
> {
  await delay(SIMULATED_DELAY);
  return (Object.entries(CATEGORY_LABELS) as [MenuCategory, string][]).map(
    ([id, label]) => ({ id, label })
  );
}

export async function fetchMenuItem(
  id: string
): Promise<MenuItem | undefined> {
  await delay(SIMULATED_DELAY);
  return MENU_ITEMS.find((item) => item.id === id);
}
