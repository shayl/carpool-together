import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import {
  completeEmailSignIn as handleEmailSignIn,
  type AuthClient,
} from "./auth-callback-handler";
import { supabasePublishableKey, supabaseUrl } from "./config";

function createCallbackClient(
  request: NextRequest,
  response: NextResponse,
): AuthClient {
  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });
}

export function completeEmailSignIn(request: NextRequest) {
  return handleEmailSignIn(request, createCallbackClient);
}
