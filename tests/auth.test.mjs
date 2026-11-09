import test from "node:test";
import assert from "node:assert/strict";
import {
  validEmail, randomCode, randomSecret, digest, sameHash,
  sameOrigin, sessionCookie, sessionToken
} from "../functions/_shared/auth.js";

test("email addresses are validated and normalized", () => {
  assert.equal(validEmail(" Test.User+game@Example.com "), "test.user+game@example.com");
  assert.equal(validEmail("not-an-email"), null);
  assert.equal(validEmail("x@localhost"), null);
  assert.equal(validEmail("a".repeat(255) + "@example.com"), null);
});

test("generated OTP codes always contain exactly six decimal digits", () => {
  const codes = new Set(Array.from({length: 100}, () => randomCode()));
  for (const code of codes) assert.match(code, /^[0-9]{6}$/);
  assert.ok(codes.size > 80);
});

test("random session token is opaque and URL safe", () => {
  const token = randomSecret();
  assert.match(token, /^[A-Za-z0-9_-]{40,100}$/);
  assert.notEqual(token, randomSecret());
});

test("HMAC OTP is keyed, distinct and comparable", async () => {
  const a = await digest("otp:person@example.com:123456", "secret-one");
  assert.equal(a.length, 64);
  assert.ok(sameHash(a, a));
  assert.ok(!sameHash(a, await digest("otp:person@example.com:123456", "secret-two")));
  assert.ok(!sameHash(a, await digest("otp:person@example.com:123457", "secret-one")));
});

test("POST requests require matching browser origin", () => {
  const accepted = new Request("https://playblockbet.com/api/auth/request", {method: "POST",headers:{
    Origin:"https://playblockbet.com", "Content-Type":"application/json"
  }});
  const rejected = new Request("https://playblockbet.com/api/auth/request",{method:"POST",headers:{
    Origin:"https://evil.example", "Content-Type":"application/json"
  }});
  assert.equal(sameOrigin(accepted),true);
  assert.equal(sameOrigin(rejected),false);
});

test("session cookies cannot be accessed by browser scripts", () => {
  const token = randomSecret();
  const cookie = sessionCookie(token);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.equal(sessionToken(new Request("https://playblockbet.com/",{headers:{Cookie:cookie}})),token);
});
