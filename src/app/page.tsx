import { connection } from "next/server";
import { CarpoolApp } from "@/components/carpool-app";
import { SignInForm } from "@/components/auth/sign-in-form";
import { loadAppData } from "@/lib/app-data";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  await connection();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return <SignInForm />;
  }

  const userId =
    typeof data.claims.sub === "string" ? data.claims.sub : undefined;

  if (!userId) {
    return <SignInForm />;
  }

  const groups = await loadAppData(userId);
  if (groups.length === 0) {
    return <SignInForm />;
  }

  return <CarpoolApp initialGroups={groups} />;
}
