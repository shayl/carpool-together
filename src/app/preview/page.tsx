import { notFound } from "next/navigation";
import { PreviewApp } from "@/components/preview-app";
import { navigationStateFromSearchParams } from "@/lib/navigation-state";
import { createPreviewGroups, previewEnabled } from "@/lib/preview-data";

export default async function PreviewPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!previewEnabled(process.env.NODE_ENV)) notFound();
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") params.set(key, value);
  }
  const now = new Date();
  return <PreviewApp initialGroups={createPreviewGroups(now)} initialNavigation={navigationStateFromSearchParams(params, now)} />;
}
