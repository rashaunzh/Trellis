import { existsSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { resolve } from "node:path";

export const BASE = process.env.TRELLIS_BASE ?? "http://127.0.0.1:5174";
export const PORT = Number(process.env.TRELLIS_CDP_PORT ?? 0) || 9224 + (process.pid % 1000);
export const USER_DATA_DIR = resolve(`.tmp-trellis-browser-${process.pid}`);

export function check(name, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  if (!condition) process.exitCode = 1;
}

export async function apiPost(path, body = {}, ownerId) {
  const payload = JSON.stringify(body);
  const url = new URL(path, BASE);
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolvePromise, rejectPromise) => {
    const request = transport.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), "Connection": "close",
        ...(ownerId ? { "x-trellis-owner-id": ownerId } : {}),
      },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if ((response.statusCode ?? 500) >= 400) return rejectPromise(new Error(`${path} -> ${response.statusCode}: ${text}`));
        try { resolvePromise(text ? JSON.parse(text) : {}); } catch (error) { rejectPromise(error); }
      });
    });
    request.setTimeout(30_000, () => request.destroy(new Error(`${path} timed out`)));
    request.on("error", rejectPromise);
    request.end(payload);
  });
}

export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

export async function waitForJsonVersion() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return response.json();
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    }
  }
  throw new Error("Chrome CDP endpoint did not start");
}

export async function waitForPageTarget() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const target = targets.find((item) => item.type === "page");
        if (target?.webSocketDebuggerUrl) return target;
      }
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    }
  }
  throw new Error("Chrome page target did not start");
}

export function connectCdp(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve: resolvePending, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolvePending(message.result);
      return;
    }
    events.push(message);
  };
  const ready = new Promise((resolveReady, rejectReady) => {
    ws.onopen = resolveReady;
    ws.onerror = rejectReady;
  });
  return {
    ready,
    events,
    send(method, params = {}) {
      return new Promise((resolveSend, rejectSend) => {
        const messageId = ++id;
        pending.set(messageId, { resolve: resolveSend, reject: rejectSend });
        ws.send(JSON.stringify({ id: messageId, method, params }));
      });
    },
    close() {
      ws.close();
    },
  };
}
