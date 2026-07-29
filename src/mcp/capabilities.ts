/**
 * Client-aware surface selection.
 *
 * Not every MCP host consumes every primitive. Cursor and Gemini CLI, for
 * example, expose tools to the model but ignore resources and prompts
 * entirely; Claude.ai renders MCP Apps but Claude Code does not. Serving one
 * fixed surface to all of them either hides functionality from tools-only
 * hosts or advertises UI that the host cannot render.
 *
 * Two different mechanisms are needed, because the protocol only gives us one
 * of them:
 *
 * - **MCP Apps is negotiable.** Clients that render `ui://` resources declare
 *   the `io.modelcontextprotocol/ui` extension in their capabilities, so the
 *   server can detect support and omit UI metadata when it is absent. The MCP
 *   Apps spec explicitly asks servers to do this ("Servers SHOULD check client
 *   capabilities before registering UI-enabled tools").
 *
 * - **Resources and prompts are NOT negotiable.** `ClientCapabilities`
 *   describes what the client *offers the server* (roots, sampling,
 *   elicitation) — it has never carried a "will consume resources/prompts"
 *   flag, in any revision through 2026-07-28. There is no protocol signal to
 *   branch on, and the spec explicitly warns against branching on the
 *   self-reported `clientInfo.name`. So the resources/prompts fallback is an
 *   operator choice, selected per endpoint, not something we can sniff.
 */

import type { ClientCapabilities } from '@modelcontextprotocol/server'

/** MCP Apps extension identifier (SEP-1865). */
export const UI_EXTENSION_ID = 'io.modelcontextprotocol/ui'

/** MIME type identifying an MCP Apps HTML resource. */
export const UI_RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app'

/**
 * `_meta` key carrying a tool's associated UI resource.
 *
 * MCP Apps accepts both the nested (`ui.resourceUri`) and flat
 * (`ui/resourceUri`) spellings; we emit both, matching what the ext-apps
 * server helper does.
 */
export const UI_RESOURCE_URI_META_KEY = 'ui/resourceUri'

/**
 * Which primitives this connection should be served.
 */
export interface ClientProfile {
  /** Attach `ui://` app metadata to tools and expose the app resources. */
  apps: boolean
  /** Expose `memory://` resources natively. */
  resources: boolean
  /** Expose workflow prompts natively. */
  prompts: boolean
}

/** Everything on — the default for hosts that speak the full protocol. */
export const FULL_PROFILE: ClientProfile = {
  apps: true,
  resources: true,
  prompts: true,
}

/**
 * Tools only. Resources and prompts are reprojected as tools by
 * {@link registerFallbackTools}, so a tools-only host loses no functionality.
 */
export const TOOLS_ONLY_PROFILE: ClientProfile = {
  apps: false,
  resources: false,
  prompts: false,
}

/**
 * Read the MCP Apps capability a client declared, if any.
 *
 * Mirrors `getUiCapability` from `@modelcontextprotocol/ext-apps/server`,
 * inlined so the server does not depend on that package's SDK-v1 typings.
 */
export function getUiCapability(
  capabilities: (ClientCapabilities & { extensions?: Record<string, unknown> }) | null | undefined
): { mimeTypes?: string[] } | undefined {
  return capabilities?.extensions?.[UI_EXTENSION_ID] as { mimeTypes?: string[] } | undefined
}

/**
 * Whether a client can render MCP Apps.
 *
 * A client that declares the extension without naming MIME types is treated as
 * supporting the default app type — the capability's presence is the signal,
 * and `mimeTypes` narrows it only when explicitly provided.
 */
export function supportsApps(
  capabilities: (ClientCapabilities & { extensions?: Record<string, unknown> }) | null | undefined
): boolean {
  const ui = getUiCapability(capabilities)
  if (!ui) return false
  if (!ui.mimeTypes || ui.mimeTypes.length === 0) return true
  return ui.mimeTypes.includes(UI_RESOURCE_MIME_TYPE)
}

/**
 * Build the `_meta` block linking a tool to its UI resource, or `undefined`
 * when the client cannot render it.
 */
export function uiMeta(
  resourceUri: string,
  profile: ClientProfile
): Record<string, unknown> | undefined {
  if (!profile.apps) return undefined
  return {
    ui: { resourceUri },
    [UI_RESOURCE_URI_META_KEY]: resourceUri,
  }
}
