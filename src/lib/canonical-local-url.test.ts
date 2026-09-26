import assert from "node:assert/strict";
import test from "node:test";
import { canonicalLocalUrl } from "./canonical-local-url";

test("canonicalizes loopback URLs without losing callback state", () => {
  assert.equal(
    canonicalLocalUrl(
      "http://127.0.0.1:3000/auth/callback?code=single-use-code",
      true,
    ),
    "http://localhost:3000/auth/callback?code=single-use-code",
  );
});

test("does not change localhost or production URLs", () => {
  assert.equal(canonicalLocalUrl("http://localhost:3000/", true), null);
  assert.equal(canonicalLocalUrl("https://carpool.example.com/", false), null);
});
