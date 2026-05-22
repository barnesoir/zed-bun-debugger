#!/usr/bin/env bun
/**
 * Build orchestration script for zed-bun-debugger-extension.
 *
 * Steps:
 *  1. Build the bridge (bundle with Bun's bundler, target=node, add shebang)
 *  2. Compile the Rust extension to WASM
 */

import { spawn } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = import.meta.dir + "/..";
const EXTENSION_DIR = join(ROOT, "extension");
const BIN_DIR = join(EXTENSION_DIR, "bin");

async function run(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[build] ${cmd} ${args.join(" ")}`);
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["inherit", "inherit", "inherit"],
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} exited with code ${code}`));
      }
    });
  });
}

async function buildBridge(): Promise<void> {
  console.log("[build] Building bridge...");
  mkdirSync(BIN_DIR, { recursive: true });

  const bridgeJs = join(BIN_DIR, "bridge.js");
  const bridgeBin = join(BIN_DIR, "bridge");

  // Bundle bridge with Bun (target=node)
  await run("bun", [
    "build",
    "src/main.ts",
    "--target=node",
    "--outfile=" + bridgeJs,
  ], join(ROOT, "bridge"));

  // Make executable (Bun already adds shebang with --target=node)
  const fs = await import("node:fs");
  fs.renameSync(bridgeJs, bridgeBin);
  fs.chmodSync(bridgeBin, 0o755);

  console.log("[build] Bridge built at", bridgeBin);
}

async function buildWasm(): Promise<void> {
  console.log("[build] Building WASM extension...");
  await run("cargo", [
    "build",
    "--target", "wasm32-wasip1",
    "--release",
  ], EXTENSION_DIR);

  const wasmSrc = join(EXTENSION_DIR, "target", "wasm32-wasip1", "release", "zed_bun_debugger.wasm");
  const wasmDest = join(EXTENSION_DIR, "zed_bun_debugger.wasm");

  const fs = await import("node:fs");
  fs.copyFileSync(wasmSrc, wasmDest);
  console.log("[build] WASM built at", wasmDest);
}

async function main(): Promise<void> {
  try {
    await buildBridge();
    await buildWasm();
    console.log("[build] All done!");
    process.exit(0);
  } catch (err) {
    console.error("[build] FAILED:", err);
    process.exit(1);
  }
}

main();
