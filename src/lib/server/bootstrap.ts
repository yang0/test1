import { ensureAppSettings } from "@/lib/server/settings";
import { startDailyTrendingSyncScheduler } from "@/lib/server/trending-scheduler";

export async function bootstrapLocalFoundation() {
  await ensureAppSettings();
  startDailyTrendingSyncScheduler();
}
