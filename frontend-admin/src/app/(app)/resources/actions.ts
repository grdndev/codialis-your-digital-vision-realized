"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";
import type { CategoryFormat, CategoryVisibility, MockupStatus } from "@/lib/types";

const RESOURCES = "/api/admin/resources";

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

export async function addApiAction(formData: FormData) {
  await apiPost(RESOURCES, {
    action: "add-api",
    projectId: str(formData, "projectId"),
    name: str(formData, "name"),
    role: str(formData, "role"),
    env: str(formData, "env"),
    baseUrl: str(formData, "baseUrl"),
    maskedKey: str(formData, "maskedKey"),
    authType: str(formData, "authType"),
    ownerId: str(formData, "ownerId") || null,
    expiryNote: str(formData, "expiryNote"),
  });
  revalidatePath("/resources");
}

export async function addUrlAction(formData: FormData) {
  await apiPost(RESOURCES, {
    action: "add-url",
    projectId: str(formData, "projectId"),
    env: str(formData, "env"),
    url: str(formData, "url"),
    access: str(formData, "access"),
    deployNote: str(formData, "deployNote"),
  });
  revalidatePath("/resources");
}

export async function addAccountAction(formData: FormData) {
  await apiPost(RESOURCES, {
    action: "add-account",
    projectId: str(formData, "projectId"),
    role: str(formData, "role"),
    login: str(formData, "login"),
    passwordMasked: str(formData, "passwordMasked"),
    env: str(formData, "env"),
    note: str(formData, "note"),
  });
  revalidatePath("/resources");
}

export async function addMockupAction(formData: FormData) {
  await apiPost(RESOURCES, {
    action: "add-mockup",
    projectId: str(formData, "projectId"),
    name: str(formData, "name"),
    version: str(formData, "version"),
    status: (str(formData, "status") || "BROUILLON") as MockupStatus,
  });
  revalidatePath("/resources");
}

export async function addCdcDocAction(formData: FormData) {
  await apiPost(RESOURCES, {
    action: "add-cdc-doc",
    projectId: str(formData, "projectId"),
    name: str(formData, "name"),
    version: str(formData, "version"),
    meta: str(formData, "meta"),
    status: str(formData, "status") || "En vigueur",
  });
  revalidatePath("/resources");
}

export async function addTechDocAction(formData: FormData) {
  await apiPost(RESOURCES, {
    action: "add-tech-doc",
    projectId: str(formData, "projectId"),
    name: str(formData, "name"),
    ext: str(formData, "ext") || "PDF",
    meta: str(formData, "meta"),
    status: str(formData, "status") || "À jour",
  });
  revalidatePath("/resources");
}

export async function addCustomCategoryAction(formData: FormData) {
  await apiPost(RESOURCES, {
    action: "add-custom-category",
    projectId: str(formData, "projectId"),
    name: str(formData, "name"),
    visibility: (str(formData, "visibility") || "TEAM") as CategoryVisibility,
    format: (str(formData, "format") || "TABLE") as CategoryFormat,
    // Les colonnes sont saisies dans un seul champ, séparées par des virgules.
    columns: str(formData, "columns").split(",").map((c) => c.trim()).filter(Boolean),
  });
  revalidatePath("/resources");
}

export async function addCustomCategoryRowAction(formData: FormData) {
  const categoryId = str(formData, "categoryId");
  if (!categoryId) return;

  // Le formulaire nomme ses champs col_0, col_1… dans l'ordre des colonnes.
  // C'est l'API qui connaît le nombre réel de colonnes et recadre la ligne.
  const values: string[] = [];
  for (let i = 0; formData.has(`col_${i}`); i++) values.push(str(formData, `col_${i}`));

  await apiPost(RESOURCES, { action: "add-custom-category-row", categoryId, values });
  revalidatePath("/resources");
}
