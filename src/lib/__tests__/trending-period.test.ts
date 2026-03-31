import { describe, expect, it } from "vitest";

import {
  getTrendingPeriodBadgeLabel,
  normalizeHomePeriod,
  normalizeTrendingPeriod,
} from "@/lib/trending-period";

describe("trending period helpers", () => {
  it("defaults invalid search params to daily", () => {
    expect(normalizeTrendingPeriod(undefined)).toBe("daily");
    expect(normalizeTrendingPeriod("yearly")).toBe("daily");
    expect(normalizeTrendingPeriod(["monthly", "daily"])).toBe("monthly");
  });

  it("supports all as a homepage-only period", () => {
    expect(normalizeHomePeriod("all")).toBe("all");
    expect(normalizeHomePeriod("weekly")).toBe("weekly");
    expect(normalizeHomePeriod(undefined)).toBe("daily");
  });

  it("returns the expected badge label for each period", () => {
    expect(getTrendingPeriodBadgeLabel("daily")).toBe("日趋势");
    expect(getTrendingPeriodBadgeLabel("weekly")).toBe("周趋势");
    expect(getTrendingPeriodBadgeLabel("monthly")).toBe("月趋势");
  });
});
