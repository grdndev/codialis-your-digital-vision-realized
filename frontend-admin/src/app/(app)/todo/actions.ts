"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";

// L'action ne fait plus que traduire : le contrôle du rôle et la bascule
// elle-même appartiennent au backend, seul juge des droits et des données.
export async function createActionItemAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await apiPost(
    "/api/admin/todo",
    {
      action: "create",
      category: String(formData.get("category") ?? "URGENT"),
      title,
      detail: String(formData.get("detail") ?? "").trim(),
      tag: String(formData.get("tag") ?? "").trim(),
      dueLabel: String(formData.get("dueLabel") ?? "").trim(),
      amountLabel: String(formData.get("amountLabel") ?? "").trim(),
      linkedProjectId: String(formData.get("linkedProjectId") ?? "") || null,
    },
    "/dashboard",
  );
  revalidatePath("/todo");
}

export async function toggleActionItemAction(itemId: string) {
  await apiPost("/api/admin/todo", { action: "toggle", itemId }, "/dashboard");
  revalidatePath("/todo");
}
