"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiPost } from "@/lib/api";
import type { SiteContentType } from "./types";

const CONTENT = "/api/admin/site/content";
const SETTINGS = "/api/admin/site/settings";
const INBOX = "/api/admin/site/inbox";

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

// Champs saisis en liste séparée par des virgules (secteurs, technologies).
function list(fd: FormData, key: string) {
  return str(fd, key)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

// Compose l'objet exactement tel que le site public le lit. C'est le backend
// qui le valide, mais le formulaire doit déjà produire la bonne forme.
function contentPayload(type: SiteContentType, fd: FormData): Record<string, unknown> {
  if (type === "blog") {
    return {
      cat: str(fd, "cat") || "dev",
      title: str(fd, "title"),
      excerpt: str(fd, "excerpt"),
      content: str(fd, "content"),
      date: str(fd, "date"),
      read: str(fd, "read"),
      image: String(fd.get("image") ?? ""),
      featured: fd.get("featured") === "on",
      source: str(fd, "source"),
    };
  }

  if (type === "portfolio") {
    // Deux chiffres clés au maximum, chacun n'étant retenu que s'il porte une
    // valeur ou un libellé.
    const results: { v: string; l: string }[] = [];
    for (const i of [1, 2]) {
      const v = str(fd, `r${i}v`);
      const l = str(fd, `r${i}l`);
      if (v || l) results.push({ v: v || "—", l });
    }
    return {
      sector: list(fd, "sector"),
      title: str(fd, "title"),
      desc: str(fd, "desc"),
      image: String(fd.get("image") ?? ""),
      tech: list(fd, "tech"),
      results,
      featured: fd.get("featured") === "on",
    };
  }

  return {
    quote: str(fd, "quote"),
    author: str(fd, "author"),
    company: str(fd, "company"),
    // Recalculés côté API depuis l'auteur : on envoie des valeurs vides.
    initials: "",
    bg: "",
  };
}

export async function saveContentAction(type: SiteContentType, formData: FormData) {
  const id = str(formData, "id");
  const data = contentPayload(type, formData);

  await apiPost(CONTENT, id ? { action: "update", type, id, data } : { action: "create", type, data });

  revalidatePath("/site");
  // Le contenu est servi par des routes publiques mises en cache 60 s côté
  // navigateur : la page publique se rafraîchira d'elle-même.
  redirect(`/site?type=${type}&saved=1`);
}

export async function deleteContentAction(type: SiteContentType, id: string) {
  await apiPost(CONTENT, { action: "delete", type, id });
  revalidatePath("/site");
  redirect(`/site?type=${type}&deleted=1`);
}

export async function saveBlogHeroAction(formData: FormData) {
  await apiPost(SETTINGS, {
    action: "update",
    key: "blog_page",
    data: {
      hero: {
        kicker: str(formData, "kicker"),
        accent: str(formData, "accent"),
        sub: str(formData, "sub"),
        lead: str(formData, "lead"),
      },
    },
  });
  revalidatePath("/site/reglages");
}

export async function savePortfolioHeroAction(formData: FormData) {
  // Trois statistiques d'en-tête, dans l'ordre du formulaire.
  const stats = [0, 1, 2].map((i) => ({
    v: str(formData, `stat${i}v`),
    suffix: str(formData, `stat${i}suffix`),
    l: str(formData, `stat${i}l`),
  }));

  await apiPost(SETTINGS, {
    action: "update",
    key: "portfolio_page",
    data: {
      hero: {
        title: str(formData, "title"),
        titleAccent: str(formData, "titleAccent"),
        subtitle: str(formData, "subtitle"),
        // Une statistique sans libellé ni valeur est retirée : la page
        // publique retombe alors sur ses trois valeurs par défaut.
        stats: stats.filter((s) => s.v || s.l),
      },
    },
  });
  revalidatePath("/site/reglages");
}

export async function saveSocialsAction(formData: FormData) {
  // Le formulaire numérote ses lignes social_0_icon, social_0_href…
  const items: { icon: string; href: string; name: string }[] = [];
  for (let i = 0; formData.has(`social_${i}_icon`); i++) {
    const icon = str(formData, `social_${i}_icon`);
    const href = str(formData, `social_${i}_href`);
    // Une ligne sans lien n'est pas un réseau social : on l'ignore.
    if (icon && href) items.push({ icon, href, name: str(formData, `social_${i}_name`) || icon });
  }

  await apiPost(SETTINGS, { action: "update", key: "contact_socials", data: { items } });
  revalidatePath("/site/reglages");
}

export async function saveLogosAction(formData: FormData) {
  const items: { image: string; name: string; href: string }[] = [];
  for (let i = 0; formData.has(`logo_${i}_image`); i++) {
    const image = String(formData.get(`logo_${i}_image`) ?? "");
    // Un logo sans image n'a rien à afficher.
    if (image) items.push({ image, name: str(formData, `logo_${i}_name`), href: str(formData, `logo_${i}_href`) });
  }

  await apiPost(SETTINGS, { action: "update", key: "home_logos", data: { items } });
  revalidatePath("/site/reglages");
}

export async function setContactStatusAction(id: string, status: string) {
  await apiPost(INBOX, { action: "set-contact-status", id, status });
  revalidatePath("/site/messages");
}

export async function deleteContactAction(id: string) {
  await apiPost(INBOX, { action: "delete-contact", id });
  revalidatePath("/site/messages");
}

export async function deleteSubscriberAction(id: string) {
  await apiPost(INBOX, { action: "delete-subscriber", id });
  revalidatePath("/site/messages");
}
