"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import type { FeedItemStatus, RefreshSummary, VeilleDraft } from "./types";

const VEILLE = "/api/admin/site/veille";

export async function refreshFeedsAction() {
  const summary = await apiPost<RefreshSummary>(VEILLE, { action: "refresh" });
  revalidatePath("/site/veille");
  // Le compte-rendu passe par l'URL : les flux en panne doivent être visibles,
  // c'est le seul moment où on s'aperçoit qu'une source est morte.
  const broken = summary.feeds.filter((f) => !f.ok).map((f) => f.label);
  const params = new URLSearchParams({
    added: String(summary.added),
    purged: String(summary.purged),
  });
  if (broken.length) params.set("broken", broken.join(","));
  redirect(`/site/veille?${params}`);
}

export async function setFeedStatusAction(itemId: string, status: FeedItemStatus) {
  await apiPost(VEILLE, { action: "set-status", itemId, status });
  revalidatePath("/site/veille");
}

export async function setFeedCategoryAction(itemId: string, formData: FormData) {
  const category = String(formData.get("category") ?? "").trim();
  if (!category) return;
  await apiPost(VEILLE, { action: "set-category", itemId, category });
  revalidatePath("/site/veille");
}

// Publie un article de veille dans le blog : le backend prépare le brouillon
// (enrichissement compris), on le pousse tel quel dans le contenu du site, puis
// l'article de veille est marqué publié pour ne plus revenir dans la file.
export async function publishFeedItemAction(itemId: string) {
  const { draft } = await apiGet<VeilleDraft>(
    `/api/admin/site/veille/prefill?itemId=${encodeURIComponent(itemId)}`,
  );

  await apiPost("/api/admin/site/content", { action: "create", type: "blog", data: draft });
  await apiPost(VEILLE, { action: "set-status", itemId, status: "PUBLISHED" });

  revalidatePath("/site/veille");
  revalidatePath("/site");
  // On atterrit sur la liste du blog, où l'article peut être relu et corrigé.
  redirect("/site?type=blog&saved=1");
}
