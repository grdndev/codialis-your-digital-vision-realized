import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { defaultPathFor } from "@/lib/nav";

export default async function RootPage() {
  const user = await requireUser();
  redirect(defaultPathFor(user.role));
}
