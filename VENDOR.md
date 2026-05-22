# Vendored Dependencies

This project vendors two packages from the Bun monorepo:

| Package | Source Path | Pinned Tag |
|---------|-------------|------------|
| `bun-debug-adapter-protocol` | `packages/bun-debug-adapter-protocol` | `bun-v1.3.14` |
| `bun-inspector-protocol` | `packages/bun-inspector-protocol` | `bun-v1.3.14` |

## Why Vendor?

These packages are NOT published to npm (404 on registry). The only way to consume
them is to extract them from the Bun monorepo.

## How to Update

1. Edit `scripts/vendor.ts` and change `BUN_TAG` to the desired release.
2. Run `bun run scripts/vendor.ts`.
3. Verify the build still works: `bun run scripts/build.ts`.
4. Update this file with the new tag.

## Import Path Fixes

The vendored `bun-debug-adapter-protocol` contains relative imports that point
to `../../../../bun-inspector-protocol` (monorepo root level). In our layout
both packages sit side-by-side under `vendor/`, so the path is shortened to
`../../../bun-inspector-protocol`. This fix is applied automatically by the
vendor script and is also reflected in the committed source.
