"use server";

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";

const MESSAGES = "/api/admin/messages";

export async function sendMessageAction(formData: FormData) {
  const threadId = String(formData.get("threadId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!threadId || !body) return;

  await apiPost(MESSAGES, { action: "send", threadId, body });
  revalidatePath("/messages");
}

export async function convertMessageToTicketAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "");
  if (!title || !projectId) return;

  await apiPost(MESSAGES, {
    action: "convert-to-ticket",
    messageId: String(formData.get("messageId") ?? ""),
    title,
    type: String(formData.get("type") ?? "DEV") === "BUG" ? "BUG" : "DEV",
    projectId,
  });
  revalidatePath("/messages");
  revalidatePath("/tickets");
}
