# Zed Bun Debugger Extension

Debug Bun applications directly in [Zed](https://zed.dev) via the Debug Adapter Protocol (DAP).

## Architecture

```
Zed Host
   │ stdin/stdout: DAP JSON-RPC
   ▼
WASM Extension (Rust)
   │ get_dap_binary() returns path
   ▼
Bridge Process (Node.js)
   │ imports
   ▼
Vendored Bun Adapter (TypeScript)
   │ WebSocket
   ▼
Bun Runtime (--inspect)
```

## Prerequisites

- [Zed](https://zed.dev) (latest stable)
- [Bun](https://bun.sh) 1.2.0+ (1.3.14+ recommended for full debugging support)
- [Node.js](https://nodejs.org) 18+ (for the bridge runtime)
- [Rust](https://rust-lang.org) 1.85.0+ with `wasm32-wasip1` target

## Installation

### Zed Extension Store

Install via:

```
Cmd+Shift+P → extensions: install extension → "Bun Debugger"
```

### Dev Extension (for contributors)

1. Clone this repository:
   ```bash
   git clone git@github.com:barnesoir/zed-bun-debugger.git
   cd zed-bun-debugger
   ```

2. Install dependencies and build:
   ```bash
   bun install
   bun run scripts/build.ts
   ```

3. In Zed, open the command palette (`Cmd+Shift+P`) and run:
   ```
   extensions: install dev extension
   ```

4. Select the `extension/` directory inside this repository.

5. "Bun Debugger" should now appear in your debug adapters list.

## Usage

Add a debug configuration to your project's `.zed/debug.json`:

```json
[
  {
    "label": "Debug Bun App",
    "adapter": "bun-debug",
    "program": "${workspaceFolder}/src/index.ts",
    "args": ["--watch"],
    "env": { "NODE_ENV": "development" },
    "stopOnEntry": false
  }
]
```

Then start debugging via Zed's debugger UI (`Cmd+Shift+D` → "Debug Bun App").

### Debugging

The Bun Debugger supports the following capabilities in Zed:

- **Breakpoints** — set breakpoints in your source code before or during a debug session
- **Step-through** — step over, step into, and step out of function calls
- **Variable inspection** — inspect local and global variables in the Variables panel
- **Call stack** — view the current call stack and navigate between frames

Use `stopOnEntry: false` (or omit it) for normal debugging. The debugger will pause at breakpoints as expected.

## Build

```bash
# Full build (bridge + WASM extension)
bun run scripts/build.ts

# Build only the bridge
bun run bridge build

# Build only the WASM extension
cd extension && cargo build --target wasm32-wasip1 --release
```

## Testing

```bash
# Unit tests for bridge framing
bun test

# Integration test (requires Bun runtime)
bun run tests/integration.ts

# Build verification
bun run tests/verify-build.ts
```

## Project Structure

| Path | Description |
|------|-------------|
| `extension/` | Zed extension (Rust/WASM) |
| `extension/extension.toml` | Zed extension manifest |
| `extension/src/lib.rs` | Extension entry — returns bridge path and maps launch configs |
| `bridge/` | TypeScript DAP bridge |
| `bridge/src/main.ts` | Stdio server that proxies DAP to the vendored adapter |
| `bridge/src/adapter-loader.ts` | Lifecycle wrapper around Bun's WebSocketDebugAdapter |
| `bridge/src/types.ts` | DAP JSON-RPC framing utilities |
| `vendor/` | Vendored Bun packages (not on npm) |
| `vendor/bun-debug-adapter-protocol/` | Bun's official DAP adapter |
| `vendor/bun-inspector-protocol/` | Bun's WebKit Inspector Protocol client |
| `scripts/build.ts` | Build orchestration |
| `scripts/vendor.ts` | Clones and pins Bun monorepo packages |
| `schemas/bun-debug.json` | Debug adapter JSON schema |

## Vendored Dependencies

`bun-debug-adapter-protocol` and `bun-inspector-protocol` are not published to npm.
They are extracted from the Bun monorepo at a pinned release tag.
See [`VENDOR.md`](VENDOR.md) for details and update instructions.

## Contributing

We welcome contributions! To set up a local development environment:

1. **Clone and build** (see [Dev Extension installation](#dev-extension-for-contributors) above).
2. **Make your changes** in `extension/` (Rust), `bridge/` (TypeScript), or `vendor/` (vendored packages).
3. **Run tests** before submitting:
   ```bash
   bun run scripts/build.ts
   bun test
   bun run tests/verify-build.ts
   ```
4. **Open a PR** against `main`. CI will run the full test suite on Ubuntu and macOS.

Please ensure your changes follow the existing code style and include tests where applicable.

## License

MIT — see [LICENSE](LICENSE).
