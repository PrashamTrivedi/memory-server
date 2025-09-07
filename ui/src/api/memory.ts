import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {
  Memory,
  CreateMemoryRequest,
  UpdateMemoryRequest,
  MemoryListResponse,
  SearchMemoryRequest,
  SearchMemoryResponse,
  ApiResponse,
  MemoryStats
} from '../types/memory'

const API_BASE = '/api'

class MemoryApiClient {
  async getMemories(page: number = 1, limit: number = 20): Promise<MemoryListResponse> {
    const response = await fetch(`${API_BASE}/memories?offset=${page}&limit=${limit}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch memories: ${response.statusText}`)
    }
    const data: ApiResponse<MemoryListResponse> = await response.json()
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch memories')
    }
    return data.data
  }

  async getMemory(id: string): Promise<Memory> {
    const response = await fetch(`${API_BASE}/memories/${id}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch memory: ${response.statusText}`)
    }
    const data: ApiResponse<Memory> = await response.json()
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch memory')
    }
    return data.data
  }

  async createMemory(memory: CreateMemoryRequest): Promise<Memory> {
    const response = await fetch(`${API_BASE}/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(memory),
    })
    if (!response.ok) {
      throw new Error(`Failed to create memory: ${response.statusText}`)
    }
    const data: ApiResponse<Memory> = await response.json()
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to create memory')
    }
    return data.data
  }

  async updateMemory(id: string, memory: UpdateMemoryRequest): Promise<Memory> {
    const response = await fetch(`${API_BASE}/memories/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(memory),
    })
    if (!response.ok) {
      throw new Error(`Failed to update memory: ${response.statusText}`)
    }
    const data: ApiResponse<Memory> = await response.json()
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to update memory')
    }
    return data.data
  }

  async deleteMemory(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/memories/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error(`Failed to delete memory: ${response.statusText}`)
    }
    const data: ApiResponse<void> = await response.json()
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete memory')
    }
  }

  async searchMemories(request: SearchMemoryRequest): Promise<SearchMemoryResponse> {
    const params = new URLSearchParams()
    params.append('query', request.query)
    if (request.tags && request.tags.length > 0) {
      params.append('tags', request.tags.join(','))
    }
    if (request.limit) {
      params.append('limit', request.limit.toString())
    }
    if (request.offset) {
      params.append('offset', request.offset.toString())
    }

    const response = await fetch(`${API_BASE}/memories/search?${params}`)
    if (!response.ok) {
      throw new Error(`Failed to search memories: ${response.statusText}`)
    }
    const data: ApiResponse<SearchMemoryResponse> = await response.json()
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to search memories')
    }
    return data.data
  }

  async getMemoryStats(): Promise<MemoryStats> {
    const response = await fetch(`${API_BASE}/memories/stats`)
    if (!response.ok) {
      // If stats endpoint doesn't exist, return default stats
      return {total: 0, recent: 0, tagged: 0}
    }
    const data: ApiResponse<MemoryStats> = await response.json()
    if (!data.success || !data.data) {
      return {total: 0, recent: 0, tagged: 0}
    }
    return data.data
  }
}

export const memoryApi = new MemoryApiClient()

// React Query Hooks
export function useMemories(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ['memories', page, limit],
    queryFn: () => memoryApi.getMemories(page, limit),
  })
}

export function useMemory(id: string) {
  return useQuery({
    queryKey: ['memory', id],
    queryFn: () => memoryApi.getMemory(id),
    enabled: !!id,
  })
}

export function useSearchMemories(request: SearchMemoryRequest) {
  return useQuery({
    queryKey: ['memories', 'search', request],
    queryFn: () => memoryApi.searchMemories(request),
    enabled: !!request.query.trim(),
  })
}

export function useMemoryStats() {
  return useQuery({
    queryKey: ['memories', 'stats'],
    queryFn: () => memoryApi.getMemoryStats(),
  })
}

export function useCreateMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (memory: CreateMemoryRequest) => memoryApi.createMemory(memory),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['memories']})
    },
  })
}

export function useUpdateMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({id, memory}: {id: string; memory: UpdateMemoryRequest}) =>
      memoryApi.updateMemory(id, memory),
    onSuccess: (_, {id}) => {
      queryClient.invalidateQueries({queryKey: ['memories']})
      queryClient.invalidateQueries({queryKey: ['memory', id]})
    },
  })
}

export function useDeleteMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => memoryApi.deleteMemory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['memories']})
    },
  })
}