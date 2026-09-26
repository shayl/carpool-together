import type { NextRequest } from "next/server";
import { completeEmailSignIn } from "@/lib/supabase/auth-callback";

export async function GET(request: NextRequest) {
  return completeEmailSignIn(request);
}
