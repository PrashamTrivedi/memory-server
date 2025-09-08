import {useState, useCallback} from 'react'
import {
  useInfiniteMemories,
  useSearchMemories,
  useCreateMemory,
  useUpdateMemory,
  useDeleteMemory,
  useMemoryStats
} from '../api/memory'
import {Memory, CreateMemoryRequest, UpdateMemoryRequest} from '../types/memory'
import {SearchBar} from '../components/SearchBar'
import {MemoryList} from '../components/MemoryList'
import {MemoryForm} from '../components/MemoryForm'
import {MemoryDetail} from '../components/MemoryDetail'
import {LoadingSpinner} from '../components/LoadingSpinner'
import './MemoryManagement.css'

type ViewMode = 'list' | 'create' | 'edit' | 'detail'

export function MemoryManagement() {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  // API hooks  
  const {data: memoriesData, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage} = useInfiniteMemories(3)
  const {data: searchResults, isLoading: isSearching} = useSearchMemories({
    query: searchQuery,
    limit: 20,
  })
  const {data: stats} = useMemoryStats()

  const createMemoryMutation = useCreateMemory()
  const updateMemoryMutation = useUpdateMemory()
  const deleteMemoryMutation = useDeleteMemory()

  // Determine which memories to show
  const isSearchMode = searchQuery.trim().length > 0
  const memories = isSearchMode 
    ? (searchResults?.memories || []) 
    : (memoriesData?.pages?.flatMap(page => page.memories) || [])
  const isLoadingMemories = isSearchMode ? isSearching : isLoading

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleCreateMemory = async (data: CreateMemoryRequest | UpdateMemoryRequest) => {
    await createMemoryMutation.mutateAsync(data as CreateMemoryRequest)
    setViewMode('list')
  }

  const handleUpdateMemory = async (data: CreateMemoryRequest | UpdateMemoryRequest) => {
    if (!selectedMemory) return
    await updateMemoryMutation.mutateAsync({id: selectedMemory.id, memory: data as UpdateMemoryRequest})
    setSelectedMemory(null)
    setViewMode('list')
  }

  const handleDeleteMemory = async (memory: Memory) => {
    await deleteMemoryMutation.mutateAsync(memory.id)
    if (selectedMemory?.id === memory.id) {
      setSelectedMemory(null)
      setViewMode('list')
    }
  }

  const handleMemoryClick = (memory: Memory) => {
    setSelectedMemory(memory)
    setViewMode('detail')
  }

  const handleMemoryEdit = (memory: Memory) => {
    setSelectedMemory(memory)
    setViewMode('edit')
  }

  const handleLoadMore = () => {
    if (!isSearchMode && hasNextPage) {
      fetchNextPage()
    }
  }

  const renderHeader = () => (
    <div className="memory-management-header">
      <div className="header-top">
        <h1>Memory Management</h1>
        <button
          onClick={() => setViewMode('create')}
          className="create-memory-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5V19M5 12H19"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Create New Memory
        </button>
      </div>

      {stats && (
        <div className="stats-container">
          <div className="stat-item">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Memories</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.recent}</span>
            <span className="stat-label">Recent</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.tagged}</span>
            <span className="stat-label">Tagged</span>
          </div>
        </div>
      )}

      <div className="search-container">
        <SearchBar
          onSearch={handleSearch}
          placeholder="Search memories by title, content or tags..."
        />
      </div>
    </div>
  )

  const renderContent = () => {
    switch (viewMode) {
      case 'create':
        return (
          <MemoryForm
            onSubmit={handleCreateMemory}
            onCancel={() => setViewMode('list')}
            isSubmitting={createMemoryMutation.isPending}
          />
        )

      case 'edit':
        return selectedMemory ? (
          <MemoryForm
            memory={selectedMemory}
            onSubmit={handleUpdateMemory}
            onCancel={() => {
              setSelectedMemory(null)
              setViewMode('list')
            }}
            isSubmitting={updateMemoryMutation.isPending}
          />
        ) : null

      case 'detail':
        return selectedMemory ? (
          <MemoryDetail
            memory={selectedMemory}
            onClose={() => {
              setSelectedMemory(null)
              setViewMode('list')
            }}
            onEdit={() => setViewMode('edit')}
            onDelete={() => handleDeleteMemory(selectedMemory)}
          />
        ) : null

      default:
        return (
          <div className="memory-list-section">
            {isSearchMode && searchQuery && (
              <div className="search-info">
                {isSearching ? (
                  <div className="search-loading">
                    <LoadingSpinner size="small" />
                    Searching...
                  </div>
                ) : (
                  <p>
                    {memories.length > 0
                      ? `Found ${memories.length} memories matching "${searchQuery}"`
                      : `No memories found for "${searchQuery}"`
                    }
                  </p>
                )}
              </div>
            )}

            <MemoryList
              memories={memories}
              loading={isLoadingMemories || isFetchingNextPage}
              error={error?.message || null}
              onMemoryClick={handleMemoryClick}
              onMemoryEdit={handleMemoryEdit}
              onMemoryDelete={handleDeleteMemory}
              onLoadMore={!isSearchMode ? handleLoadMore : undefined}
              hasMore={!isSearchMode && hasNextPage}
            />
          </div>
        )
    }
  }

  return (
    <div className="memory-management">
      {viewMode === 'list' && renderHeader()}
      {renderContent()}
    </div>
  )
}