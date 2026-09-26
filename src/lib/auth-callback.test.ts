import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { completeEmailSignIn } from "./supabase/auth-callback-handler";

test("redirect response carries cookies written during code exchange", async () => {
  const request = new NextRequest(
    "http://localhost:3000/auth/callback?code=valid-code",
  );

  const response = await completeEmailSignIn(request, (_request, redirect) => ({
    auth: {
      async exchangeCodeForSession(code) {
        assert.equal(code, "valid-code");
        redirect.cookies.set("session-test", "signed-in", {
          httpOnly: true,
          path: "/",
        });
        return { error: null };
      },
    },
  }));

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://localhost:3000/");
  assert.match(response.headers.get("set-cookie") ?? "", /session-test=signed-in/);
});

test("provider errors redirect without exchanging a code", async () => {
  const request = new NextRequest(
    "http://localhost:3000/auth/callback?error=access_denied",
  );
  let createdClient = false;

  const response = await completeEmailSignIn(request, () => {
    createdClient = true;
    throw new Error("should not create a client");
  });

  assert.equal(createdClient, false);
  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "http://localhost:3000/auth/error?reason=provider_error",
  );
});
