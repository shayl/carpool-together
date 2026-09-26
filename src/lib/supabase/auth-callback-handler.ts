import { NextResponse, type NextRequest } from "next/server";

export type AuthClient = {
  auth: {
    exchangeCodeForSession(code: string): Promise<{ error: unknown | null }>;
  };
};

export type AuthClientFactory = (
  request: NextRequest,
  response: NextResponse,
) => AuthClient;

function redirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), { status: 303 });
}

export async function completeEmailSignIn(
  request: NextRequest,
  createAuthClient: AuthClientFactory,
) {
  const authError = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");

  if (authError || !code) {
    return redirect(
      request,
      `/auth/error?reason=${authError ? "provider_error" : "missing_code"}`,
    );
  }

  const response = redirect(request, "/");
  const supabase = createAuthClient(request, response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirect(request, "/auth/error?reason=invalid_link");
  }

  return response;
}
