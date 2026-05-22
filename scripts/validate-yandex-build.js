import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const buildDir = path.join(root, "dist-yandex");
const maxSize = 100 * 1024 * 1024;
const forbiddenSegments = new Set(["server", "backend", "api", "node_modules"]);
const forbiddenContent = [
  { pattern: /https?:\/\/localhost(?::\d+)?/i, label: "absolute localhost URL" },
  { pattern: /https?:\/\/127\.0\.0\.1(?::\d+)?/i, label: "absolute loopback URL" },
  { pattern: /VITE_LEADERBOARD_BACKEND_URL/, label: "development backend environment name" },
];
const contentExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".mjs", ".txt"]);
const failures = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(buildDir, absolute);
    const normalized = relative.split(path.sep).join("/");
    const segments = normalized.split("/");

    if (segments.some((segment) => forbiddenSegments.has(segment.toLowerCase()))) {
      failures.push(`Forbidden path in build: ${normalized}`);
    }
    if (segments.some((segment) => segment.startsWith(".env"))) {
      failures.push(`Environment file in build: ${normalized}`);
    }
    if (/[\sА-Яа-яЁё]/u.test(normalized)) {
      failures.push(`Path has whitespace or Cyrillic characters: ${normalized}`);
    }

    if (entry.isDirectory()) {
      files.push(...await walk(absolute));
    } else if (entry.isFile()) {
      files.push({ absolute, relative: normalized });
    }
  }

  return files;
}

async function run() {
  try {
    const index = await readFile(path.join(buildDir, "index.html"), "utf8");
    if (!/<script\b[^>]*\bsrc=["']\/sdk\.js["'][^>]*>/i.test(index)) {
      failures.push("dist-yandex/index.html does not load the SDK from /sdk.js.");
    }
    if (!/onload=["']initSDK\(\)["']/i.test(index)) {
      failures.push("dist-yandex/index.html does not call initSDK() from the SDK onload handler.");
    }
    if (/(?:src|href)=["']\/assets\//i.test(index)) {
      failures.push("dist-yandex/index.html uses root-absolute Vite asset paths. Yandex build assets must be relative.");
    }
  } catch {
    failures.push("dist-yandex/index.html is missing.");
  }

  let files = [];
  try {
    files = await walk(buildDir);
  } catch {
    failures.push("dist-yandex cannot be read. Run npm run build:yandex first.");
  }

  let size = 0;
  for (const file of files) {
    size += (await stat(file.absolute)).size;
    if (!contentExtensions.has(path.extname(file.relative))) continue;

    const content = await readFile(file.absolute, "utf8");
    for (const check of forbiddenContent) {
      if (check.pattern.test(content)) {
        failures.push(`${file.relative} contains ${check.label}.`);
      }
    }
  }

  if (size > maxSize) {
    failures.push(`dist-yandex is ${(size / 1024 / 1024).toFixed(2)} MB; limit is 100 MB.`);
  }

  if (failures.length > 0) {
    console.error("Yandex build validation failed:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log(`Yandex build validation passed: ${files.length} files, ${(size / 1024 / 1024).toFixed(2)} MB.`);
}

await run();
