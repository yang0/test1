import { ProxyAgent, fetch as undiciFetch, type Dispatcher } from "undici";

type ExternalFetchInit = Parameters<typeof undiciFetch>[1];

const proxyUrl =
  process.env.HTTPS_PROXY ??
  process.env.https_proxy ??
  process.env.HTTP_PROXY ??
  process.env.http_proxy ??
  null;

const proxyDispatcher: Dispatcher | null = proxyUrl ? new ProxyAgent(proxyUrl) : null;

export function fetchExternal(input: string | URL, init?: ExternalFetchInit) {
  if (!proxyDispatcher) {
    return fetch(input, init as RequestInit);
  }

  return undiciFetch(input, {
    ...init,
    dispatcher: proxyDispatcher,
  });
}
