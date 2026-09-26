import { CarpoolApp } from "@/components/carpool-app";
import { SignInForm } from "@/components/auth/sign-in-form";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return <SignInForm />;
  }

  const email =
    typeof data.claims.email === "string" ? data.claims.email : "Signed in";

  return <CarpoolApp userEmail={email} />;
}
