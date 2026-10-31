#!/usr/bin/env node
// Prints a PostgreSQL SCRAM-SHA-256 verifier for the password read from stdin, so ALTER ROLE … PASSWORD
// carries a hash instead of the plaintext — the statement text can stay in pg_stat_statements.
//   node scram-verifier.mjs < password-file
// Printable ASCII passwords only (SASLprep is not applied), e.g. `openssl rand -hex 32`.
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function scramVerifier(password, { salt = randomBytes(16), iterations = 4096 } = {}) {
  if (!/^[\x21-\x7e]{16,}$/.test(password)) throw new Error("use a printable ASCII password of at least 16 characters");
  const salted = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const hmac = (key, message) => createHmac("sha256", key).update(message).digest();
  const storedKey = createHash("sha256").update(hmac(salted, "Client Key")).digest();
  const serverKey = hmac(salted, "Server Key");
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(scramVerifier(readFileSync(0, "utf8").trim()));
}
