import { prisma } from "@/lib/server/db";
import { syncTrendingRepositories } from "@/lib/server/trending";

const DEFAULT_TIMEZONE = "Asia/Shanghai";
const DEFAULT_SCHEDULE = "03:00";
const CHECK_INTERVAL_MS = 60_000;
const ENABLE_IN_DEV = process.env.TRENDING_SYNC_ENABLE_IN_DEV === "true";

type SchedulerState = {
  started: boolean;
  running: boolean;
  timer: ReturnType<typeof setInterval> | null;
  lastCompletedDayKey: string | null;
};

declare global {
  var __dailyTrendingSyncScheduler__: SchedulerState | undefined;
}

function getSchedulerState() {
  if (!globalThis.__dailyTrendingSyncScheduler__) {
    globalThis.__dailyTrendingSyncScheduler__ = {
      started: false,
      running: false,
      timer: null,
      lastCompletedDayKey: null,
    };
  }

  return globalThis.__dailyTrendingSyncScheduler__;
}

function isSchedulerEnabled() {
  if (process.env.TRENDING_SYNC_ENABLED === "false") {
    return false;
  }

  if (process.env.NODE_ENV === "production") {
    return true;
  }

  return ENABLE_IN_DEV;
}

function getSchedulerTimezone() {
  return process.env.TRENDING_SYNC_TIMEZONE?.trim() || DEFAULT_TIMEZONE;
}

function parseSchedule() {
  const raw = process.env.TRENDING_SYNC_SCHEDULE?.trim() || DEFAULT_SCHEDULE;
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return { hour: 3, minute: 0, label: DEFAULT_SCHEDULE };
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return { hour: 3, minute: 0, label: DEFAULT_SCHEDULE };
  }

  return {
    hour,
    minute,
    label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";

  return {
    dayKey: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    hour: Number(getPart("hour")),
    minute: Number(getPart("minute")),
  };
}

function hasReachedSchedule(date: Date, timeZone: string, scheduledHour: number, scheduledMinute: number) {
  const zoned = getZonedParts(date, timeZone);

  if (zoned.hour > scheduledHour) {
    return true;
  }

  if (zoned.hour === scheduledHour && zoned.minute >= scheduledMinute) {
    return true;
  }

  return false;
}

async function getLastCompletedDayKey(timeZone: string) {
  const latestRepository = await prisma.repository.findFirst({
    where: {
      lastSyncedAt: {
        not: null,
      },
    },
    orderBy: {
      lastSyncedAt: "desc",
    },
    select: {
      lastSyncedAt: true,
    },
  });

  if (!latestRepository?.lastSyncedAt) {
    return null;
  }

  return getZonedParts(latestRepository.lastSyncedAt, timeZone).dayKey;
}

async function runDailySync(reason: string, timeZone: string) {
  const state = getSchedulerState();
  if (state.running) {
    return;
  }

  state.running = true;
  const startedAt = new Date();

  try {
    console.info(
      `[trending-sync] Starting daily sync (${reason}) at ${startedAt.toISOString()} using timezone ${timeZone}.`,
    );
    const result = await syncTrendingRepositories();
    state.lastCompletedDayKey = getZonedParts(new Date(), timeZone).dayKey;
    console.info(
      `[trending-sync] Completed daily sync with ${result.repositories.length} repositories at ${new Date().toISOString()}.`,
    );
  } catch (error) {
    console.error("[trending-sync] Daily sync failed.", error);
  } finally {
    state.running = false;
  }
}

async function tickDailySyncScheduler() {
  const timeZone = getSchedulerTimezone();
  const schedule = parseSchedule();
  const state = getSchedulerState();
  const now = new Date();
  const dayKey = getZonedParts(now, timeZone).dayKey;

  if (state.lastCompletedDayKey === null) {
    state.lastCompletedDayKey = await getLastCompletedDayKey(timeZone);
  }

  if (!hasReachedSchedule(now, timeZone, schedule.hour, schedule.minute)) {
    return;
  }

  if (state.lastCompletedDayKey === dayKey) {
    return;
  }

  await runDailySync(`scheduled ${schedule.label}`, timeZone);
}

export function startDailyTrendingSyncScheduler() {
  if (!isSchedulerEnabled()) {
    return;
  }

  const state = getSchedulerState();
  if (state.started) {
    return;
  }

  state.started = true;
  const timeZone = getSchedulerTimezone();
  const schedule = parseSchedule();

  console.info(
    `[trending-sync] Daily scheduler enabled for ${schedule.label} (${timeZone}) with ${CHECK_INTERVAL_MS / 1000}s checks.`,
  );

  void tickDailySyncScheduler();
  state.timer = setInterval(() => {
    void tickDailySyncScheduler();
  }, CHECK_INTERVAL_MS);
}
