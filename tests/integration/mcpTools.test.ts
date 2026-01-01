import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleUpdateMemory } from '../../src/mcp/tools/memory';
import { handleAddTags } from '../../src/mcp/tools/search';

// Mock TemporaryMemoryService
vi.mock('../../src/services/temporaryMemory', () => ({
  TemporaryMemoryService: {
    exists: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  }
}));

// Mock TagHierarchyService
vi.mock('../../src/services/tagHierarchy', () => ({
  TagHierarchyService: {
    createTagsWithRelationship: vi.fn(),
    getTagByName: vi.fn(),
  }
}));

import { TemporaryMemoryService } from '../../src/services/temporaryMemory';
import { TagHierarchyService } from '../../src/services/tagHierarchy';

// Mock D1 database
const createMockDB = () => {
  const mockPrepare = vi.fn();
  const mockBind = vi.fn();
  const mockRun = vi.fn();
  const mockFirst = vi.fn();
  const mockAll = vi.fn();

  mockPrepare.mockReturnValue({
    bind: mockBind,
  });
  mockBind.mockReturnValue({
    run: mockRun,
    first: mockFirst,
    all: mockAll,
  });

  return {
    prepare: mockPrepare,
    _mockBind: mockBind,
    _mockRun: mockRun,
    _mockFirst: mockFirst,
    _mockAll: mockAll,
  };
};

describe('MCP Tools', () => {
  let mockDB: ReturnType<typeof createMockDB>;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDB = createMockDB();
    mockEnv = {
      DB: mockDB,
      TEMP_MEMORIES_KV: {},
      CACHE_KV: {},
    };
  });

  describe('update_memory', () => {
    it('should require memory ID', async () => {
      await expect(handleUpdateMemory(mockEnv, {}))
        .rejects.toThrow('Memory ID is required');
    });

    it('should update temporary memory', async () => {
      const mockMemory = {
        id: 'temp-123',
        name: 'Test Memory',
        content: 'Original content',
        tags: ['tag1'],
        created_at: 1000,
        updated_at: 1000,
      };

      vi.mocked(TemporaryMemoryService.exists).mockResolvedValue(true);
      vi.mocked(TemporaryMemoryService.update).mockResolvedValue({
        ...mockMemory,
        content: 'Updated content',
        updated_at: 2000,
      });

      const result = await handleUpdateMemory(mockEnv, {
        id: 'temp-123',
        content: 'Updated content',
      });

      expect(TemporaryMemoryService.update).toHaveBeenCalledWith(
        mockEnv,
        'temp-123',
        { content: 'Updated content' }
      );
      expect(result.content[1].text).toContain('"updated": true');
      expect(result.content[1].text).toContain('"created": false');
    });

    it('should update permanent memory in D1', async () => {
      vi.mocked(TemporaryMemoryService.exists).mockResolvedValue(false);

      // Mock finding existing memory
      mockDB._mockFirst.mockResolvedValueOnce({
        id: 'perm-123',
        name: 'Permanent Memory',
        content: 'Original',
        url: null,
        created_at: 1000,
        updated_at: 1000,
      });

      // Mock getting tags
      mockDB._mockAll.mockResolvedValueOnce({ results: [{ name: 'existing-tag' }] });

      // Mock update run
      mockDB._mockRun.mockResolvedValueOnce({});

      // Mock fetching updated memory
      mockDB._mockFirst.mockResolvedValueOnce({
        id: 'perm-123',
        name: 'Permanent Memory',
        content: 'Updated content',
        url: null,
        created_at: 1000,
        updated_at: 2000,
      });
      mockDB._mockAll.mockResolvedValueOnce({ results: [{ name: 'existing-tag' }] });

      const result = await handleUpdateMemory(mockEnv, {
        id: 'perm-123',
        content: 'Updated content',
      });

      expect(result.content[1].text).toContain('"updated": true');
    });

    it('should create new memory when ID not found (upsert)', async () => {
      vi.mocked(TemporaryMemoryService.exists).mockResolvedValue(false);
      mockDB._mockFirst.mockResolvedValueOnce(null); // Memory not found
      mockDB._mockRun.mockResolvedValue({});

      // Mock fetching created memory
      mockDB._mockFirst.mockResolvedValueOnce({
        id: 'new-123',
        name: 'New Memory',
        content: 'New content',
        url: null,
        created_at: 2000,
        updated_at: 2000,
      });
      mockDB._mockAll.mockResolvedValue({ results: [] });

      const result = await handleUpdateMemory(mockEnv, {
        id: 'new-123',
        name: 'New Memory',
        content: 'New content',
      });

      expect(result.content[1].text).toContain('"created": true');
      expect(result.content[1].text).toContain('"updated": false');
    });

    it('should error on upsert without name and content', async () => {
      vi.mocked(TemporaryMemoryService.exists).mockResolvedValue(false);
      mockDB._mockFirst.mockResolvedValueOnce(null); // Memory not found

      await expect(handleUpdateMemory(mockEnv, {
        id: 'new-123',
        content: 'Only content, no name',
      })).rejects.toThrow('Memory not found. To create a new memory, provide both name and content.');
    });

    it('should create temporary memory on upsert when temporary flag set', async () => {
      vi.mocked(TemporaryMemoryService.exists).mockResolvedValue(false);
      mockDB._mockFirst.mockResolvedValueOnce(null); // Memory not found
      vi.mocked(TemporaryMemoryService.create).mockResolvedValue(undefined);

      const result = await handleUpdateMemory(mockEnv, {
        id: 'new-temp-123',
        name: 'New Temp Memory',
        content: 'Temporary content',
        temporary: true,
      });

      expect(TemporaryMemoryService.create).toHaveBeenCalled();
      expect(result.content[1].text).toContain('"created": true');
    });

    it('should error when no update fields provided for existing memory', async () => {
      vi.mocked(TemporaryMemoryService.exists).mockResolvedValue(true);

      await expect(handleUpdateMemory(mockEnv, {
        id: 'temp-123',
      })).rejects.toThrow('No update fields provided');
    });
  });

  describe('add_tags', () => {
    it('should require memory ID', async () => {
      await expect(handleAddTags(mockEnv, { tags: ['tag1'] }))
        .rejects.toThrow('Memory ID is required');
    });

    it('should require non-empty tags array', async () => {
      await expect(handleAddTags(mockEnv, { memory_id: '123', tags: [] }))
        .rejects.toThrow('Tags array is required and must not be empty');
    });

    it('should add tags to temporary memory', async () => {
      const mockMemory = {
        id: 'temp-123',
        name: 'Test',
        content: 'Content',
        tags: ['existing'],
        created_at: 1000,
        updated_at: 1000,
      };

      vi.mocked(TemporaryMemoryService.exists).mockResolvedValue(true);
      vi.mocked(TemporaryMemoryService.get).mockResolvedValue(mockMemory);
      vi.mocked(TemporaryMemoryService.update).mockResolvedValue({
        ...mockMemory,
        tags: ['existing', 'new-tag'],
      });

      const result = await handleAddTags(mockEnv, {
        memory_id: 'temp-123',
        tags: ['new-tag'],
      });

      expect(TemporaryMemoryService.update).toHaveBeenCalledWith(
        mockEnv,
        'temp-123',
        { tags: expect.arrayContaining(['existing', 'new-tag']) }
      );
    });

    it('should support camelCase memoryId parameter', async () => {
      vi.mocked(TemporaryMemoryService.exists).mockResolvedValue(true);
      vi.mocked(TemporaryMemoryService.get).mockResolvedValue({
        id: 'temp-123',
        name: 'Test',
        content: 'Content',
        tags: [],
        created_at: 1000,
        updated_at: 1000,
      });
      vi.mocked(TemporaryMemoryService.update).mockResolvedValue({
        id: 'temp-123',
        name: 'Test',
        content: 'Content',
        tags: ['tag1'],
        created_at: 1000,
        updated_at: 2000,
      });

      // Should work with memoryId (camelCase)
      await handleAddTags(mockEnv, {
        memoryId: 'temp-123',
        tags: ['tag1'],
      });

      expect(TemporaryMemoryService.get).toHaveBeenCalledWith(mockEnv, 'temp-123');
    });

    it('should handle hierarchical tags for temporary memories', async () => {
      const mockMemory = {
        id: 'temp-123',
        name: 'Test',
        content: 'Content',
        tags: [],
        created_at: 1000,
        updated_at: 1000,
      };

      vi.mocked(TemporaryMemoryService.exists).mockResolvedValue(true);
      vi.mocked(TemporaryMemoryService.get).mockResolvedValue(mockMemory);
      vi.mocked(TemporaryMemoryService.update).mockResolvedValue({
        ...mockMemory,
        tags: ['parent', 'child'],
      });

      await handleAddTags(mockEnv, {
        memory_id: 'temp-123',
        tags: ['parent>child'],
      });

      // Should extract both parent and child from hierarchical tag
      expect(TemporaryMemoryService.update).toHaveBeenCalledWith(
        mockEnv,
        'temp-123',
        { tags: expect.arrayContaining(['parent', 'child']) }
      );
    });

    it('should add tags to permanent memory with hierarchy', async () => {
      vi.mocked(TemporaryMemoryService.exists).mockResolvedValue(false);

      // Mock finding existing memory
      mockDB._mockFirst.mockResolvedValueOnce({
        id: 'perm-123',
        name: 'Permanent',
        content: 'Content',
        url: null,
        created_at: 1000,
        updated_at: 1000,
      });
      mockDB._mockAll.mockResolvedValue({ results: [] });
      mockDB._mockRun.mockResolvedValue({});

      // Mock TagHierarchyService for hierarchical tags
      vi.mocked(TagHierarchyService.createTagsWithRelationship).mockResolvedValue({
        child_tag: { id: 1, name: 'child' },
        parent_tag: { id: 2, name: 'parent' },
        hierarchy: { id: 1, child_tag_id: 1, parent_tag_id: 2, created_at: Date.now() },
        created_child: true,
        created_parent: true,
      });

      // Mock fetching updated memory
      mockDB._mockFirst.mockResolvedValueOnce({
        id: 'perm-123',
        name: 'Permanent',
        content: 'Content',
        url: null,
        created_at: 1000,
        updated_at: 2000,
      });

      await handleAddTags(mockEnv, {
        memory_id: 'perm-123',
        tags: ['parent>child'],
      });

      expect(TagHierarchyService.createTagsWithRelationship).toHaveBeenCalledWith(
        mockDB,
        'child',
        'parent'
      );
    });

    it('should error when memory not found', async () => {
      vi.mocked(TemporaryMemoryService.exists).mockResolvedValue(false);
      mockDB._mockFirst.mockResolvedValueOnce(null);

      await expect(handleAddTags(mockEnv, {
        memory_id: 'nonexistent',
        tags: ['tag1'],
      })).rejects.toThrow('Memory with ID nonexistent not found');
    });
  });
});
