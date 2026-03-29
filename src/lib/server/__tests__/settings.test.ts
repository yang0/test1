import { describe, expect, it } from "vitest";

import {
  buildAppSettingsPatch,
  DEFAULT_INSTALL_PROMPT_TEMPLATE,
  DEFAULT_TRANSLATION_PROMPT_TEMPLATE,
  ensureAppSettings,
  updateAppSettings,
} from "@/lib/server/settings";

describe("settings helpers", () => {
  it("trims nullable values and keeps defaults for blank templates", () => {
    const patch = buildAppSettingsPatch({
      projectRootPath: "  E:/workspace/oss-lab  ",
      defaultTmuxSession: " dev-session ",
      defaultTmuxWindow: "   ",
      translationPromptTemplate: "   ",
      installPromptTemplate: " 自定义安装提示词 ",
    });

    expect(patch).toEqual({
      projectRootPath: "E:/workspace/oss-lab",
      defaultTmuxSession: "dev-session",
      defaultTmuxWindow: null,
      defaultTmuxPane: null,
      translationPromptTemplate: DEFAULT_TRANSLATION_PROMPT_TEMPLATE,
      installPromptTemplate: "自定义安装提示词",
    });
  });

  it("returns full defaults when values are omitted", () => {
    const patch = buildAppSettingsPatch({});

    expect(patch.translationPromptTemplate).toBe(DEFAULT_TRANSLATION_PROMPT_TEMPLATE);
    expect(patch.installPromptTemplate).toBe(DEFAULT_INSTALL_PROMPT_TEMPLATE);
    expect(patch.projectRootPath).toBeNull();
  });

  it("preserves unspecified settings when updating a single field", async () => {
    await ensureAppSettings();
    await updateAppSettings({
      defaultTmuxSession: "browser-e2e",
      installPromptTemplate: "请输出安装完成",
    });

    const updated = await updateAppSettings({
      projectRootPath: "/mnt/e/testProject",
    });

    expect(updated.projectRootPath).toBe("/mnt/e/testProject");
    expect(updated.defaultTmuxSession).toBe("browser-e2e");
    expect(updated.installPromptTemplate).toBe("请输出安装完成");
  });
});
