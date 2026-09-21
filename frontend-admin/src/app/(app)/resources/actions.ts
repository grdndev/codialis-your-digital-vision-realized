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

export async function updateApiAction(formData: FormData) {
  await apiPost(RESOURCES, {
    action: "update-api",
    apiId: str(formData, "apiId"),
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

export async function deleteApiAction(apiId: string) {
  await apiPost(RESOURCES, { action: "delete-api", apiId });
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

// --- Reprendre et retirer ce qui a été saisi (CC-343) ----------------------
//
// Les clés d'API savaient déjà se corriger (CC-301) ; les six autres types de
// ressources, non — une URL mal collée ou une maquette périmée restaient là.
// L'API acceptait pourtant ces actions, aucun écran ne les appelait.

export async function updateUrlAction(formData: FormData) {
  await apiPost(RESOURCES, {
    action: "update-url",
    urlId: str(formData, "urlId"),
    env: str(formData, "env"),
    url: str(formData, "url"),
    access: str(formData, "access"),
    deployNote: str(formData, "deployNote"),
  });
  revalidatePath("/resources");
}

export async function deleteUrlAction(urlId: string) {
  await apiPost(RESOURCES, { action: "delete-url", urlId });
  revalidatePath("/resources");
}

export async function updateAccountAction(formData: FormData) {
  await apiPost(RESOURCES, {
    action: "update-account",
    accountId: str(formData, "accountId"),
    role: str(formData, "role"),
    login: str(formData, "login"),
    passwordMasked: str(formData, "passwordMasked"),
    env: str(formData, "env"),
    note: str(formData, "note"),
  });
  revalidatePath("/resources");
}

export async function deleteAccountAction(accountId: string) {
  await apiPost(RESOURCES, { action: "delete-account", accountId });
  revalidatePath("/resources");
}

export async function updateMockupAction(formData: FormData) {
  await apiPost(RESOURCES, {
    action: "update-mockup",
    mockupId: str(formData, "mockupId"),
    name: str(formData, "name"),
    version: str(formData, "version"),
    status: (str(formData, "status") || "BROUILLON") as MockupStatus,
  });
  revalidatePath("/resources");
}

export async function deleteMockupAction(mockupId: string) {
  await apiPost(RESOURCES, { action: "delete-mockup", mockupId });
  revalidatePath("/resources");
}

export async function updateCdcDocAction(formData: FormData) {
  await apiPost(RESOURCES, {
    action: "update-cdc-doc",
    docId: str(formData, "docId"),
    name: str(formData, "name"),
    version: str(formData, "version"),
    meta: str(formData, "meta"),
    status: str(formData, "status") || "En vigueur",
  });
  revalidatePath("/resources");
}

export async function deleteCdcDocAction(docId: string) {
  await apiPost(RESOURCES, { action: "delete-cdc-doc", docId });
  revalidatePath("/resources");
}

export async function updateTechDocAction(formData: FormData) {
  await apiPost(RESOURCES, {
    action: "update-tech-doc",
    docId: str(formData, "docId"),
    name: str(formData, "name"),
    ext: str(formData, "ext") || "PDF",
    meta: str(formData, "meta"),
    status: str(formData, "status") || "À jour",
  });
  revalidatePath("/resources");
}

export async function deleteTechDocAction(docId: string) {
  await apiPost(RESOURCES, { action: "delete-tech-doc", docId });
  revalidatePath("/resources");
}

export async function updateCustomCategoryAction(formData: FormData) {
  await apiPost(RESOURCES, {
    action: "update-custom-category",
    categoryId: str(formData, "categoryId"),
    name: str(formData, "name"),
    visibility: (str(formData, "visibility") || "TEAM") as CategoryVisibility,
    format: (str(formData, "format") || "TABLE") as CategoryFormat,
  });
  revalidatePath("/resources");
}

// Supprimer une catégorie emporte ses lignes : c'est la table entière qui
// disparaît, pas seulement son en-tête.
export async function deleteCustomCategoryAction(categoryId: string) {
  await apiPost(RESOURCES, { action: "delete-custom-category", categoryId });
  revalidatePath("/resources");
}

export async function updateCustomCategoryRowAction(formData: FormData) {
  const rowId = str(formData, "rowId");
  if (!rowId) return;

  const values: string[] = [];
  for (let i = 0; formData.has(`col_${i}`); i++) values.push(str(formData, `col_${i}`));

  await apiPost(RESOURCES, { action: "update-custom-category-row", rowId, values });
  revalidatePath("/resources");
}

export async function deleteCustomCategoryRowAction(rowId: string) {
  await apiPost(RESOURCES, { action: "delete-custom-category-row", rowId });
  revalidatePath("/resources");
}
