import { connection } from "next/server";
import { CarpoolApp } from "@/components/carpool-app";
import { SignInForm } from "@/components/auth/sign-in-form";
import { accountForUser, syncAccountMemberships } from "@/lib/account";
import { loadAppData } from "@/lib/app-data";
import { navigationStateFromSearchParams } from "@/lib/navigation-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  await connection();
  const urlSearchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    const firstValue = Array.isArray(value) ? value[0] : value;
    if (firstValue !== undefined) urlSearchParams.set(key, firstValue);
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

  // An organizer can add this phone to a group at any time; reconciling here
  // is what makes that group simply appear on the next load.
  const admin = createAdminClient();
  await syncAccountMemberships(admin, userId);

  const account = await accountForUser(admin, userId);
  if (!account) {
    return <SignInForm />;
  }

  const groups = await loadAppData(userId);

  return (
    <CarpoolApp
      initialGroups={groups}
      initialNavigation={navigationStateFromSearchParams(urlSearchParams)}
    />
  );
}
