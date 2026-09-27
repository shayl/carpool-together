import { connection } from "next/server";
import { CarpoolApp } from "@/components/carpool-app";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SetupForm } from "@/components/auth/setup-form";
import { loadAppData } from "@/lib/app-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  await connection();

  const admin = createAdminClient();
  const { count: groupCount, error: groupCountError } = await admin
    .from("groups")
    .select("id", { count: "exact", head: true });

  if (groupCountError) {
    throw groupCountError;
  }

  if (groupCount === 0) {
    return <SetupForm />;
  }

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

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .single();

  if (profileError) {
    throw profileError;
  }

  return (
    <CarpoolApp initialGroups={groups} memberName={profile.display_name} />
  );
}
