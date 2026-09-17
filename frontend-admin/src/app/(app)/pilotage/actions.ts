"use server";

import { revalidatePath } from "next/cache";
import { parseNumber } from "@/lib/format";
import { apiPost } from "@/lib/api";

const PILOTAGE = "/api/admin/pilotage";

export async function updateMonthlyChargesAction(formData: FormData) {
  const value = parseNumber(formData.get("monthlyCharges"));
  if (!Number.isFinite(value) || value < 0) return;

  await apiPost(PILOTAGE, { action: "update-monthly-charges", value });
  revalidatePath("/pilotage");
}

export async function updateMonthlyRevenueTargetAction(formData: FormData) {
  const value = parseNumber(formData.get("monthlyRevenueTarget"));
  if (!Number.isFinite(value) || value <= 0) return;

  await apiPost(PILOTAGE, { action: "update-monthly-revenue-target", value });
  revalidatePath("/pilotage");
}

export async function addDecisionAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await apiPost(PILOTAGE, {
    action: "add-decision",
    title,
    detail: String(formData.get("detail") ?? "").trim(),
    impact: String(formData.get("impact") ?? "").trim(),
    tag: String(formData.get("tag") ?? "Arbitrage").trim(),
  });
  revalidatePath("/pilotage");
}
