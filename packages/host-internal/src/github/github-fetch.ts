let githubFetchImpl: typeof fetch | undefined;

/** Desktop 等宿主可注入 electron.net.fetch，以使用系统证书库与代理。 */
export function setGitHubFetchImplementation(fetchImpl: typeof fetch | undefined): void {
  githubFetchImpl = fetchImpl;
}

export function githubFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return (githubFetchImpl ?? globalThis.fetch)(input, init);
}
