import { describe, expect, it } from "vitest";

import { resolveTmuxTarget, targetToString } from "@/lib/server/tmux";

describe("tmux helpers", () => {
  it("prefers explicit tmux target values over defaults", () => {
    const target = resolveTmuxTarget(
      {
        defaultTmuxSession: "default-session",
        defaultTmuxWindow: "0",
        defaultTmuxPane: "1",
      },
      {
        session: "custom-session",
        pane: "3",
      },
    );
  
    expect(target).toEqual({
      session: "custom-session",
      window: "0",
      pane: "3",
    });
    expect(targetToString(target)).toBe("custom-session:0.3");
  });
});
