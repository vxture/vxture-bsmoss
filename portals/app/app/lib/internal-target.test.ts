import { test } from "node:test";
import assert from "node:assert/strict";
import { assertInternalTarget } from "./internal-target";
test("cleartext credentials remain on actual loopback/private targets", () => {
  for (const target of ["http://127.0.0.1", "http://10.1.2.3", "http://[::1]", "http://platform.internal", "https://accounts.vxture.com"]) assert.ok(assertInternalTarget(target));
  for (const target of ["http://127.attacker.example", "http://192.168.attacker.example", "http://public.example", "https://user:secret@accounts.vxture.com"]) assert.throws(() => assertInternalTarget(target));
});
