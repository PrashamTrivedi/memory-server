import { useState, useEffect, useCallback } from 'preact/hooks';
import { App } from '@modelcontextprotocol/ext-apps';

interface UseAppResult {
  app: App | null;
  connected: boolean;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

/**
 * Hook to initialize and manage MCP App connection
 */
export function useApp(name: string): UseAppResult {
  const [app, setApp] = useState<App | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const mcpApp = new App({ name, version: '1.0.0' });
    mcpApp.connect();
    setApp(mcpApp);
    setConnected(true);

    return () => {
      // Cleanup if needed
    };
  }, [name]);

  return { app, connected, loading, setLoading };
}

/**
 * Parse MCP tool result to extract data
 */
export function parseToolResult<T>(result: unknown): T | null {
  if (!result || typeof result !== 'object') return null;

  const typedResult = result as { content?: Array<{ type: string; text?: string }> };
  const textContent = typedResult.content?.find((c) => c.type === 'text');
  if (!textContent?.text) return null;

  try {
    const data = JSON.parse(textContent.text);
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

/**
 * Hook to call MCP tools with loading state management
 */
export function useToolCall(app: App | null) {
  const [loading, setLoading] = useState(false);

  const callTool = useCallback(
    async <T>(
      name: string,
      args: Record<string, unknown>
    ): Promise<T | null> => {
      if (!app) return null;

      setLoading(true);
      try {
        const result = await app.callServerTool({ name, arguments: args });
        return parseToolResult<T>(result);
      } catch (error) {
        console.error(`Tool ${name} failed:`, error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [app]
  );

  return { callTool, loading };
}
