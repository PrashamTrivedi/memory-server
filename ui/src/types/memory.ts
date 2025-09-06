export interface Memory {
  id: string;
  name: string;
  content: string;
  url?: string;
  created_at: number;
  updated_at: number;
  tags?: string[];
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

export interface MemoryListResponse {
  memories: Memory[];
  total: number;
  page: number;
  limit: number;
}

export interface SearchMemoryRequest {
  query: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface MemoryStats {
  total: number;
  recent: number;
  tagged: number;
}