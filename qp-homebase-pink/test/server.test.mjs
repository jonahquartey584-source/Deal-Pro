import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "qphb-"));
const { server } = await import("../server.mjs");
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());
const H = { "Content-Type": "application/json", "X-Homebase": "1" };

test("serves the app and health", async () => {
  assert.equal((await fetch(base + "/")).status, 200);
  assert.equal((await (await fetch(base + "/api/health")).json()).ok, true);
});

test("saves data and refuses stale writes", async () => {
  let r = await (await fetch(base + "/api/state")).json();
  assert.equal(r.rev, 0);
  r = await (await fetch(base + "/api/state", { method: "PUT", headers: H, body: JSON.stringify({ rev: 0, data: { todos: [{ id: "a" }] } }) })).json();
  assert.equal(r.rev, 1);
  const stale = await fetch(base + "/api/state", { method: "PUT", headers: H, body: JSON.stringify({ rev: 0, data: {} }) });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).current.data.todos[0].id, "a");
  assert.ok(fs.existsSync(path.join(process.env.DATA_DIR, "homebase.json")));
});

test("blocks writes without the app header and from other hosts", async () => {
  assert.equal((await fetch(base + "/api/state", { method: "PUT", body: "{}" })).status, 403);
  const http = await import("node:http");
  const status = await new Promise((res) => http.get({ host: "127.0.0.1", port: server.address().port, path: "/api/health", headers: { Host: "evil.example" } }, (r) => { r.resume(); res(r.statusCode); }));
  assert.equal(status, 403);
});

test("assistant asks for a key when none is set", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const r = await fetch(base + "/api/assistant", { method: "POST", headers: H, body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }) });
  assert.equal(r.status, 401);
});

test("settings never return the key itself", async () => {
  const s = await (await fetch(base + "/api/settings", { method: "PUT", headers: H, body: JSON.stringify({ apiKey: "sk-ant-test-1234567890" }) })).json();
  assert.equal(s.hasApiKey, true);
  assert.ok(!JSON.stringify(s).includes("1234567890"));
});
