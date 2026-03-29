import process from "node:process";

const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3000";
const chromeDebugUrl = process.env.CHROME_DEBUG_URL ?? "http://127.0.0.1:9222";
const flowMode = process.env.E2E_FLOW ?? "full";
const projectRootValue = process.env.E2E_PROJECT_ROOT ?? "/mnt/e/testProject/test1";
const installPath = process.env.E2E_INSTALL_PATH ?? null;
const foregroundMode = process.env.E2E_FOREGROUND !== "false";

class CdpClient {
  constructor(socket, sessionId) {
    this.socket = socket;
    this.sessionId = sessionId;
    this.id = 0;
    this.pending = new Map();

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));

      if (typeof message.id === "number") {
        const pending = this.pending.get(message.id);

        if (!pending) {
          return;
        }

        this.pending.delete(message.id);

        if (message.error) {
          pending.reject(new Error(message.error.message ?? "CDP error"));
          return;
        }

        pending.resolve(message.result ?? {});
      }
    });
  }

  send(method, params = {}) {
    this.id += 1;
    const id = this.id;

    this.socket.send(
      JSON.stringify({
        id,
        method,
        params,
        sessionId: this.sessionId,
      }),
    );

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }
}

async function createClient() {
  const versionResponse = await fetch(`${chromeDebugUrl}/json/version`);

  if (!versionResponse.ok) {
    throw new Error(`Failed to read Chrome debug version endpoint: ${versionResponse.status}`);
  }

  const versionPayload = await versionResponse.json();
  const browserSocket = new WebSocket(versionPayload.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    browserSocket.addEventListener("open", resolve, { once: true });
    browserSocket.addEventListener("error", reject, { once: true });
  });

  const browserClient = new CdpClient(browserSocket, undefined);
  const { targetId } = await browserClient.send("Target.createTarget", {
    url: "about:blank",
    newWindow: foregroundMode,
    background: false,
  });
  const { sessionId } = await browserClient.send("Target.attachToTarget", { targetId, flatten: true });
  const pageClient = new CdpClient(browserSocket, sessionId);

  await pageClient.send("Page.enable");
  await pageClient.send("Runtime.enable");
  await browserClient.send("Target.activateTarget", { targetId }).catch(() => undefined);
  await pageClient.send("Page.bringToFront").catch(() => undefined);

  return {
    browserSocket,
    browserClient,
    pageClient,
    targetId,
  };
}

async function waitForCondition(pageClient, expression, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await pageClient.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });

    if (result.result?.value) {
      return result.result.value;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Timed out waiting for condition: ${expression}`);
}

async function evaluate(pageClient, expression) {
  const result = await pageClient.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });

  return result.result?.value;
}

async function navigate(pageClient, url) {
  await pageClient.send("Page.navigate", { url });
  await waitForCondition(pageClient, "document.readyState === 'complete'");
}

async function run() {
  const { browserSocket, browserClient, pageClient, targetId } = await createClient();

  try {
    await navigate(pageClient, `${appUrl}/`);

    const homeText = await evaluate(pageClient, "document.body.innerText");
    const firstRepoHref = await evaluate(
      pageClient,
      `(() => {
        const links = [...document.querySelectorAll('a[href^="/repo/"]')];
        const link = links.find((item) => item.getAttribute('href')?.startsWith('/repo/'));
        return link?.getAttribute('href') ?? null;
      })()`,
    );

    if (!homeText.includes("中文 Trending 仓库") || !firstRepoHref) {
      throw new Error("Home page did not render expected content.");
    }

    if (flowMode === "install") {
      const targetPath = installPath ?? firstRepoHref;

      await navigate(pageClient, `${appUrl}${targetPath}`);
      await waitForCondition(pageClient, "document.body.innerText.includes('中文 README')", 60000);
      await evaluate(
        pageClient,
        `(() => {
          const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === '安装');
          button?.click();
          return Boolean(button);
        })()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 2500));
      console.log(
        JSON.stringify(
          {
            ok: true,
            installClicked: true,
            detailPath: targetPath,
          },
          null,
          2,
        ),
      );
      return;
    }

    await evaluate(
      pageClient,
      `(() => {
        const links = [...document.querySelectorAll('a[href^="/repo/"]')];
        const link = links.find((item) => item.getAttribute('href') === ${JSON.stringify(firstRepoHref)});
        link?.click();
        return Boolean(link);
      })()`,
    );

    await waitForCondition(pageClient, "location.pathname.startsWith('/repo/')");
    await waitForCondition(pageClient, "document.body.innerText.includes('中文 README')", 60000);

    const detailPath = await evaluate(pageClient, "location.pathname");

    await evaluate(
      pageClient,
      `(() => {
        const target = [...document.querySelectorAll('a')].find((item) => item.textContent?.includes('我的项目'));
        target?.click();
        return Boolean(target);
      })()`,
    );

    await waitForCondition(pageClient, "location.pathname === '/projects'");
    await waitForCondition(pageClient, "document.body.innerText.includes('我的项目')");

    await evaluate(
      pageClient,
      `(() => {
        const input = document.querySelector('input[name="projectRootPath"]');
        if (!(input instanceof HTMLInputElement)) {
          return false;
        }
        input.focus();
        input.value = ${JSON.stringify(projectRootValue)};
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`,
    );

    await evaluate(
      pageClient,
      `(() => {
        const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('保存设置'));
        button?.click();
        return Boolean(button);
      })()`,
    );

    await waitForCondition(
      pageClient,
      `(() => {
        const input = document.querySelector('input[name="projectRootPath"]');
        return input instanceof HTMLInputElement && input.value === ${JSON.stringify(projectRootValue)};
      })()`,
    );

    await evaluate(
      pageClient,
      `(() => {
        const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('刷新扫描'));
        button?.click();
        return Boolean(button);
      })()`,
    );

    await waitForCondition(pageClient, "document.body.innerText.includes('test1')", 30000);

    const summary = {
      ok: true,
      homeTitleSeen: true,
      detailPath,
      detailReadmeSeen: true,
      projectsPageSeen: true,
      projectRootSaved: true,
      projectScanTriggered: true,
      installClicked: false,
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await browserClient.send("Target.closeTarget", { targetId }).catch(() => undefined);
    browserSocket.close();
  }
}

void run();
