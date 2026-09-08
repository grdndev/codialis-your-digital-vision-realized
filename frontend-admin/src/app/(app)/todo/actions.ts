"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";

// L'action ne fait plus que traduire : le contrôle du rôle et la bascule
// elle-même appartiennent au backend, seul juge des droits et des données.
export async function toggleActionItemAction(itemId: string) {
  await apiPost("/api/admin/todo", { action: "toggle", itemId }, "/dashboard");
  revalidatePath("/todo");
}
