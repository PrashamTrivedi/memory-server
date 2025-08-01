// Memory data types
export interface Memory {
  id: string;
  name: string;
  content: string;
  url?: string;
  tags: string[];
  created_at: number;
  updated_at: number;
}

export interface CreateMemoryRequest {
  name: string;
  content: string;
  url?: string;
  tags?: string[];
}

export interface UpdateMemoryRequest {
  name?: string;
  content?: string;
  url?: string;
  tags?: string[];
}

export interface FindMemoriesRequest {
  query?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// MCP Tool definitions
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

// Database row types
export interface MemoryRow {
  id: string;
  name: string;
  content: string;
  url: string | null;
  created_at: number;
  updated_at: number;
}

export interface TagRow {
  id: number;
  name: string;
}

export interface MemoryTagRow {
  memory_id: string;
  tag_id: number;
}