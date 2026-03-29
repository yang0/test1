export const trendingPeriods = ["daily", "weekly", "monthly"] as const;

export type TrendingPeriod = (typeof trendingPeriods)[number];

type SearchParamValue = string | string[] | undefined;

type TrendMetricSource = {
  starsToday: number;
  starsThisWeek: number;
  starsThisMonth: number;
};

export function normalizeTrendingPeriod(value: SearchParamValue): TrendingPeriod {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (candidate === "weekly" || candidate === "monthly") {
    return candidate;
  }

  return "daily";
}

export function getTrendingPeriodBadgeLabel(period: TrendingPeriod) {
  switch (period) {
    case "weekly":
      return "周趋势";
    case "monthly":
      return "月趋势";
    default:
      return "日趋势";
  }
}

export function getTrendingPeriodDescriptionLabel(period: TrendingPeriod) {
  switch (period) {
    case "weekly":
      return "本周";
    case "monthly":
      return "本月";
    default:
      return "当日";
  }
}

export function getTrendingMetricLabel(period: TrendingPeriod) {
  switch (period) {
    case "weekly":
      return "本周 +";
    case "monthly":
      return "本月 +";
    default:
      return "今日 +";
  }
}

export function getTrendingMetricValue(period: TrendingPeriod, repository: TrendMetricSource) {
  switch (period) {
    case "weekly":
      return repository.starsThisWeek;
    case "monthly":
      return repository.starsThisMonth;
    default:
      return repository.starsToday;
  }
}
