const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));

test("Electron app entry points exist", () => {
  assert.equal(typeof packageJson.scripts?.start, "string");
  assert.ok(packageJson.scripts.start.length > 0, "package.json must define a start script");
  assert.equal(typeof packageJson.main, "string");
  assert.ok(fs.existsSync(path.join(projectRoot, packageJson.main)), `main file not found: ${packageJson.main}`);
  assert.ok(fs.existsSync(path.join(projectRoot, "src/preload/preload.js")), "preload file is missing");
  assert.ok(fs.existsSync(path.join(projectRoot, "src/renderer/index.html")), "renderer index file is missing");
});
