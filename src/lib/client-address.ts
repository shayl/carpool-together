export function clientAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  return (
    forwardedFor?.split(",", 1)[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}
