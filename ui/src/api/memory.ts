import {useQuery, useMutation, useQueryClient, useInfiniteQuery} from '@tanstack/react-query'
import {
  Memory,
  CreateMemoryRequest,
  UpdateMemoryRequest,
  MemoryListResponse,
  SearchMemoryRequest,
  SearchMemoryResponse,
  MemoryStats,
  TemporaryMemoryListResponse
} from '../types/memory'
import { api } from './client'

class MemoryApiClient {
  async getMemories(page: number = 0, limit: number = 20): Promise<MemoryListResponse> {
    const response = await api.get<MemoryListResponse>(`/memories?offset=${page * limit}&limit=${limit}`)
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch memories')
    }
    return response.data
  }

  async getMemory(id: string): Promise<Memory> {
    const response = await api.get<Memory>(`/memories/${id}`)
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch memory')
    }
    return response.data
  }

  async createMemory(memory: CreateMemoryRequest): Promise<Memory> {
    const response = await api.post<Memory>('/memories', memory)
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create memory')
    }
    return response.data
  }

  async updateMemory(id: string, memory: UpdateMemoryRequest): Promise<Memory> {
    const response = await api.put<Memory>(`/memories/${id}`, memory)
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update memory')
    }
    return response.data
  }

  async deleteMemory(id: string): Promise<void> {
    const response = await api.delete<void>(`/memories/${id}`)
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete memory')
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

    const response = await api.get<SearchMemoryResponse>(`/memories/search?${params}`)
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to search memories')
    }
    return response.data
  }

  async getMemoryStats(): Promise<MemoryStats> {
    try {
      const response = await api.get<MemoryStats>('/memories/stats')
      if (!response.success || !response.data) {
        return {total: 0, recent: 0, tagged: 0}
      }
      return response.data
    } catch {
      // If stats endpoint doesn't exist, return default stats
      return {total: 0, recent: 0, tagged: 0}
    }
  }

  async getTemporaryMemories(limit: number = 50, offset: number = 0): Promise<TemporaryMemoryListResponse> {
    const response = await api.get<TemporaryMemoryListResponse>(`/memories/temporary?limit=${limit}&offset=${offset}`)
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch temporary memories')
    }
    return response.data
  }

  async promoteMemory(id: string): Promise<Memory> {
    const response = await api.post<{promoted: boolean; id: string; memory: Memory}>(`/memories/${id}/promote`, {})
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to promote memory')
    }
    return response.data.memory
  }
}

export const memoryApi = new MemoryApiClient()

// React Query Hooks
export function useMemories(page: number = 0, limit: number = 20) {
  return useQuery({
    queryKey: ['memories', page, limit],
    queryFn: () => memoryApi.getMemories(page, limit),
  })
}

export function useInfiniteMemories(limit: number = 20) {
  return useInfiniteQuery({
    queryKey: ['memories', 'infinite', limit],
    queryFn: ({ pageParam = 0 }) => memoryApi.getMemories(pageParam, limit),
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.has_more ? (lastPage.pagination.offset / limit) + 1 : undefined
    },
    initialPageParam: 0,
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

export function useTemporaryMemories(limit: number = 50, offset: number = 0) {
  return useQuery({
    queryKey: ['memories', 'temporary', limit, offset],
    queryFn: () => memoryApi.getTemporaryMemories(limit, offset),
  })
}

export function usePromoteMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => memoryApi.promoteMemory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['memories']})
    },
  })
}
