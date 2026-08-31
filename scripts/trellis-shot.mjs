// Trellis drawer screenshot via CDP
const port = process.argv[2] || "63761";
const outFile = process.argv[3] || "trellis-drawer.png";

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((t) => t.type === "page" && t.url.includes("localhost:5173/learn"))
  ?? targets.find((t) => t.type === "page");
if (!target) { console.error("no page target", targets.map(t => t.url).slice(0, 5)); process.exit(1); }
console.error("target:", target.url);

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
    else p.resolve(msg.result);
  }
};
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

// scroll the assessment section into the drawer viewport
const scrollRes = await send("Runtime.evaluate", {
  expression: `(() => {
    const d = document.querySelector('.t2-drawer');
    const a = document.querySelector('.t2-assessment');
    if (!d || !a) return 'missing drawer=' + !!d + ' assessment=' + !!a;
    a.scrollIntoView({ block: 'start' });
    d.scrollTop = a.offsetTop - 16;
    return 'scrollTop=' + d.scrollTop + ' assessTop=' + a.offsetTop;
  })()`,
  returnByValue: true,
});
console.error("scroll:", scrollRes.result.value);
await new Promise((r) => setTimeout(r, 900));

// confirm the assessment is inside the viewport
const rectRes = await send("Runtime.evaluate", {
  expression: `(() => { const a = document.querySelector('.t2-assessment'); if (!a) return 'none'; const r = a.getBoundingClientRect(); return JSON.stringify({ top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight }); })()`,
  returnByValue: true,
});
console.error("rect:", rectRes.result.value);

// capture top
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
const fs = await import("node:fs");
fs.writeFileSync(outFile, Buffer.from(shot.data, "base64"));
console.error("saved:", outFile, fs.statSync(outFile).size, "bytes");

// scroll to the BOTTOM of the assessment (next action line visible)
const scrollBottom = await send("Runtime.evaluate", {
  expression: `(() => {
    const d = document.querySelector('.t2-drawer');
    const a = document.querySelector('.t2-assessment');
    if (!d || !a) return 'missing';
    d.scrollTop = a.offsetTop + a.offsetHeight - d.clientHeight + 20;
    return 'scrollTop=' + d.scrollTop;
  })()`,
  returnByValue: true,
});
console.error("scrollBottom:", scrollBottom.result.value);
await new Promise((r) => setTimeout(r, 900));
const rect2 = await send("Runtime.evaluate", {
  expression: `(() => { const a = document.querySelector('.t2-assessment'); const r = a.getBoundingClientRect(); const next = [...document.querySelectorAll('.t2-assessment .t2-hint b')].map(x => x.textContent); return JSON.stringify({ top: Math.round(r.top), bottom: Math.round(r.bottom), lastHint: next }); })()`,
  returnByValue: true,
});
console.error("rect2:", rect2.result.value);
const shot2 = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
fs.writeFileSync(outFile.replace(".png", "-bottom.png"), Buffer.from(shot2.data, "base64"));
console.error("saved:", outFile.replace(".png", "-bottom.png"), fs.statSync(outFile.replace(".png", "-bottom.png")).size, "bytes");

// verify new classes are actually styled
const styleRes = await send("Runtime.evaluate", {
  expression: `(() => {
    const subs = [...document.querySelectorAll('.t2-assessment-sub')];
    const cs = subs[0] ? getComputedStyle(subs[0]) : null;
    const note = document.querySelector('.t2-signal-note');
    const hints = [...document.querySelectorAll('.t2-assessment .t2-hint b')].map(x => x.textContent);
    const tags = [...document.querySelectorAll('.t2-evidence-card .t2-review-tags span')].map(x => x.textContent);
    return JSON.stringify({
      subLabels: subs.map(s => s.textContent),
      subDisplay: cs ? cs.display : null,
      subMarginTop: cs ? cs.marginTop : null,
      subFontWeight: cs ? cs.fontWeight : null,
      signalNote: note ? note.textContent : null,
      hintBolds: hints,
      cardTags: tags,
      coveredCards: document.querySelectorAll('.t2-signal.covered').length,
      pendingCards: document.querySelectorAll('.t2-signal.partial, .t2-signal.missing').length,
      dimensionCount: document.querySelectorAll('.t2-dimension').length,
      missingBlock: document.querySelector('.t2-assessment-missing')?.textContent.slice(0, 60) ?? null,
    });
  })()`,
  returnByValue: true,
});
console.log("STYLE_CHECK " + styleRes.result.value);
ws.close();
