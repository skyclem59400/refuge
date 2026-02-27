import "dotenv/config";
import { cli, WorkerOptions } from "@livekit/agents";
import { entrypoint } from "./agent.js";

/**
 * Entry point for the LiveKit Agents worker.
 *
 * Loads environment variables via dotenv, then starts the agent worker
 * that listens for incoming calls/rooms from LiveKit Cloud or self-hosted.
 *
 * Usage:
 *   npm run dev     — development mode with hot-reload (tsx watch)
 *   npm run build   — compile TypeScript to dist/
 *   npm run start   — run compiled JS in production
 *
 * TODO: Verify cli.runApp and WorkerOptions API match the installed
 * @livekit/agents SDK version.
 */
cli.runApp(
  new WorkerOptions({
    agent: entrypoint,
  })
);
