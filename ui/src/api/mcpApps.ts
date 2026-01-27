import { api } from './client';

export interface McpAppInfo {
  name: string;
  deployed: boolean;
  size?: number;
  updatedAt?: string;
}

export interface UploadResult {
  size: number;
  updatedAt: string;
}

/**
 * List all MCP apps with deployment status
 */
export async function listMcpApps(): Promise<McpAppInfo[]> {
  const response = await api.get<{ apps: McpAppInfo[] }>('/admin/mcp-apps');
  return response.data?.apps || [];
}

/**
 * Upload/replace an MCP app bundle
 */
export async function uploadMcpApp(appName: string, htmlContent: string): Promise<UploadResult> {
  const response = await fetch(`/api/admin/mcp-apps/${appName}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/html',
      'Authorization': `Bearer ${api.getApiKey()}`
    },
    body: htmlContent
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText })) as { error?: string };
    throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
  }

  const result = await response.json() as { success: boolean; data?: UploadResult; error?: string };
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Upload failed');
  }

  return result.data;
}

/**
 * Delete an MCP app bundle
 */
export async function deleteMcpApp(appName: string): Promise<void> {
  await api.delete(`/admin/mcp-apps/${appName}`);
}
