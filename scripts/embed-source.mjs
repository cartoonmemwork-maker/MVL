import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(root, "worker/source");

const [html, css, javascript, solLocomotion, solActions, cloudSmall, cloudMedium, cloudLong] = await Promise.all([
  readFile(resolve(sourceRoot, "index.html"), "utf8"),
  readFile(resolve(sourceRoot, "style.css"), "utf8"),
  readFile(resolve(sourceRoot, "game.js"), "utf8"),
  readFile(resolve(sourceRoot, "assets/sol-locomotion-v4.png")),
  readFile(resolve(sourceRoot, "assets/sol-actions-v2.png")),
  readFile(resolve(sourceRoot, "assets/cloud-small-v2.png")),
  readFile(resolve(sourceRoot, "assets/cloud-medium-v2.png")),
  readFile(resolve(sourceRoot, "assets/cloud-long-v2.png")),
]);

const files = {
  "/": { contentType: "text/html; charset=utf-8", body: html },
  "/index.html": { contentType: "text/html; charset=utf-8", body: html },
  "/style.css": { contentType: "text/css; charset=utf-8", body: css },
  "/game.js": { contentType: "text/javascript; charset=utf-8", body: javascript },
  "/assets/sol-locomotion-v4.png": { contentType: "image/png", base64: solLocomotion.toString("base64") },
  "/assets/sol-actions-v2.png": { contentType: "image/png", base64: solActions.toString("base64") },
  "/assets/cloud-small-v2.png": { contentType: "image/png", base64: cloudSmall.toString("base64") },
  "/assets/cloud-medium-v2.png": { contentType: "image/png", base64: cloudMedium.toString("base64") },
  "/assets/cloud-long-v2.png": { contentType: "image/png", base64: cloudLong.toString("base64") },
};

const worker = `const files = ${JSON.stringify(files, null, 2)};

const securityHeaders = {
  "cache-control": "public, max-age=60, must-revalidate",
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

export default {
  async fetch(request, env, ctx) {
    void env;
    void ctx;

    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204, headers: securityHeaders });
    }

    const file = files[url.pathname];
    if (!file) {
      return new Response("Not found", {
        status: 404,
        headers: { ...securityHeaders, "content-type": "text/plain; charset=utf-8" },
      });
    }

    const body = file.base64
      ? Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0))
      : file.body;
    return new Response(request.method === "HEAD" ? null : body, {
      headers: {
        ...securityHeaders,
        "content-type": file.contentType,
      },
    });
  },
};
`;

await writeFile(resolve(root, "worker/index.js"), worker, "utf8");
