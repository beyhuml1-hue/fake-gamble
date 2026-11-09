import test from "node:test";
import assert from "node:assert/strict";
import {
  validPassword, PASSWORD_ITERATIONS, randomSalt, passwordHash, sameHash,
} from "../functions/_shared/auth.js";

test("password rules accept passphrases and block very short or huge inputs", () => {
  assert.equal(validPassword("a secure passphrase here"), true);
  assert.equal(validPassword("short123"), false);
  assert.equal(validPassword(" ".repeat(20)), false);
  assert.equal(validPassword("a".repeat(129)), false);
  assert.equal(PASSWORD_ITERATIONS, 100000);
});

test("stored password hashes are salted and server-peppered", async () => {
  const salt1 = randomSalt();
  const salt2 = randomSalt();
  assert.match(salt1, /^[0-9a-f]{32}$/);
  assert.notEqual(salt1, salt2);
  const pass = "a fairly long login passphrase";
  const hash1 = await passwordHash(pass, salt1, "server-secret-one");
  const repeat = await passwordHash(pass, salt1, "server-secret-one");
  const hash2 = await passwordHash(pass, salt2, "server-secret-one");
  const other = await passwordHash(pass, salt1, "server-secret-two");
  assert.match(hash1, /^[a-f0-9]{64}$/);
  assert.ok(sameHash(hash1, repeat));
  assert.ok(!sameHash(hash1, hash2));
  assert.ok(!sameHash(hash1, other));
});
