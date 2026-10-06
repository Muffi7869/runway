import { redirect } from "next/navigation";

import { requireSettingsComplete } from "@/lib/settings/server";

export default async function Home() {
  await requireSettingsComplete();
  redirect("/week");
}
