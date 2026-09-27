import { APP_VERSION } from "@/lib/app-version";

export function AppVersion({ className = "app-version" }: { className?: string }) {
  return (
    <span className={className}>
      Carpool Together · v{APP_VERSION}
    </span>
  );
}
