/**
 * Adapter loader that wraps the vendored Bun WebSocketDebugAdapter.
 * Handles lifecycle: launch, attach, event forwarding, and cleanup.
 */

import { WebSocketDebugAdapter, type DAP } from "../../vendor/bun-debug-adapter-protocol/index.ts";
import type { DAPEvent, DAPRequest, DAPResponse } from "./types.ts";

export type AdapterEventHandler = (event: DAPEvent) => void;
export type AdapterResponseHandler = (response: DAPResponse) => void;

export class AdapterLoader {
  private adapter: WebSocketDebugAdapter;
  private onEvent: AdapterEventHandler;
  private onResponse: AdapterResponseHandler;
  private initialized = false;
  private pendingLaunches: Array<{ request: DAPRequest; resolve: () => void; reject: (err: Error) => void }> = [];

  constructor(onEvent: AdapterEventHandler, onResponse: AdapterResponseHandler) {
    this.adapter = new WebSocketDebugAdapter();
    this.onEvent = onEvent;
    this.onResponse = onResponse;

    // Forward adapter responses
    this.adapter.on("Adapter.response", (response: DAP.Response) => {
      const dapResponse: DAPResponse = {
        type: "response",
        seq: 0,
        request_seq: response.request_seq,
        command: response.command,
        success: response.success,
        body: response.body as unknown,
        message: response.message,
      };
      this.onResponse(dapResponse);
    });

    // Forward adapter events
    this.adapter.on("Adapter.event", (event: DAP.Event) => {
      const dapEvent: DAPEvent = {
        type: "event",
        seq: 0,
        event: event.event,
        body: event.body as unknown,
      };
      this.onEvent(dapEvent);
    });

    // Handle process exit
    this.adapter.on("Process.exited", (code: number | Error | null, signal: string | null) => {
      this.onEvent({
        type: "event",
        seq: 0,
        event: "exited",
        body: { exitCode: typeof code === "number" ? code : -1 },
      });
      this.onEvent({
        type: "event",
        seq: 0,
        event: "terminated",
        body: {},
      });
    });

    // Log inspector connection
    this.adapter.on("Inspector.connected", () => {
      this.onEvent({
        type: "event",
        seq: 0,
        event: "output",
        body: { category: "debug console", output: "Inspector connected.\n" },
      });
    });

    this.adapter.on("Inspector.disconnected", (err?: Error) => {
      this.onEvent({
        type: "event",
        seq: 0,
        event: "output",
        body: { category: "debug console", output: err ? `Inspector disconnected: ${err.message}\n` : "Inspector disconnected.\n" },
      });
    });
  }

  async handleRequest(request: DAPRequest): Promise<void> {
    // Special handling for launch: we need to start the adapter process first
    if (request.command === "launch") {
      await this.handleLaunch(request);
      return;
    }

    // Special handling for disconnect
    if (request.command === "disconnect") {
      this.adapter.disconnect((request.arguments ?? {}) as DAP.DisconnectRequest);
      // Send success response immediately
      this.onResponse({
        type: "response",
        seq: 0,
        request_seq: request.seq,
        command: "disconnect",
        success: true,
      });
      return;
    }

    // Forward everything else directly to the adapter
    this.adapter.emit("Adapter.request", request as unknown as DAP.Request);
  }

  private async handleLaunch(request: DAPRequest): Promise<void> {
    const args = (request.arguments ?? {}) as Record<string, unknown>;

    try {
      // Validate required program field
      if (!args.program || typeof args.program !== "string") {
        throw new Error("Missing required 'program' field in launch configuration");
      }

      // Build launch request for the adapter
      const launchArgs: DAP.LaunchRequest & { type: "launch"; program: string } = {
        type: "launch",
        program: args.program,
        args: Array.isArray(args.args) ? args.args.map(String) : [],
        cwd: typeof args.cwd === "string" ? args.cwd : undefined,
        env: args.env && typeof args.env === "object" ? Object.fromEntries(
          Object.entries(args.env).map(([k, v]) => [k, String(v)])
        ) : {},
        stopOnEntry: !!args.stopOnEntry,
        noDebug: !!args.noDebug,
        runtime: typeof args.runtime === "string" ? args.runtime : "bun",
      };

      // Launch the adapter (this spawns bun --inspect internally)
      await this.adapter.launch(launchArgs);

      // Send success response
      this.onResponse({
        type: "response",
        seq: 0,
        request_seq: request.seq,
        command: "launch",
        success: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.onResponse({
        type: "response",
        seq: 0,
        request_seq: request.seq,
        command: "launch",
        success: false,
        message,
      });
    }
  }

  dispose(): void {
    try {
      this.adapter.close();
    } catch {
      // ignore
    }
  }
}
