import { ensureAppSettings } from "@/lib/server/settings";

export async function bootstrapLocalFoundation() {
  await ensureAppSettings();
}
