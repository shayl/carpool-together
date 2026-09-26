const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]"]);

export function canonicalLocalUrl(
  currentUrl: string,
  isDevelopment = process.env.NODE_ENV === "development",
) {
  const url = new URL(currentUrl);

  if (!isDevelopment || !LOOPBACK_HOSTS.has(url.hostname)) {
    return null;
  }

  url.hostname = "localhost";
  return url.toString();
}
