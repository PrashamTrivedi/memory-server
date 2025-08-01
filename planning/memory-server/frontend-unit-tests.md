# Frontend Unit Test Specifications - Memory Server

## Overview
This document provides comprehensive unit test specifications for the Memory Server React frontend, covering all user interface requirements from the PRD and ensuring excellent user experience across all features, with specific focus on integration with the backend's MCP Server TypeScript SDK, MCP Inspector, and Cloudflare Browser Rendering for LLMs functionality.

## Test Environment Setup

### Test Framework: Vitest + React Testing Library
- **Testing Framework**: Vitest for fast, ESM-native testing
- **React Testing**: React Testing Library for component testing
- **DOM Testing**: @testing-library/jest-dom for DOM assertions
- **User Events**: @testing-library/user-event for interaction simulation
- **Mock Strategy**: MSW (Mock Service Worker) for API mocking with MCP integration support

### Resource-Specific Test Configuration
```typescript
// Test environment setup with resource integration awareness
interface TestEnvironment {
  renderOptions: {
    wrapper: React.ComponentType;     // Context providers wrapper
    queries: typeof queries;         // Custom queries
  };
  mockAPI: MockServiceWorker;        // API endpoint mocking with MCP support
  testUtils: TestingUtilities;       // Custom testing utilities
  resourceIntegration: {
    mcpTools: MCPToolMocks;          // Mock MCP tool responses
    browserRendering: BrowserMocks;   // Mock URL content responses
    inspector: InspectorMocks;        // Mock Inspector integration
  };
}

// MCP Integration Test Configuration
interface MCPFrontendTestConfig {
  mockMCPEndpoints: boolean;          // Enable MCP API endpoint mocking
  urlContentPreview: boolean;         // Test URL content display features
  realTimeSearch: boolean;            // Test search with FTS integration
  tagManagement: boolean;             // Test tag management functionality
}
```

---

## MCP Tool Integration Frontend Tests

### Test Suite: MCPToolIntegration.test.tsx
**Coverage Target**: 90%  
**Total Test Cases**: 25
**Resource Reference**: Backend MCP Server TypeScript SDK integration

#### MCP-FE-001: Memory Creation with MCP Tool Integration Tests

##### TC-MCP-FE-001-001: Memory Form with URL Content Fetching
- **Test ID**: TC-MCP-FE-001-001
- **Description**: Test memory creation form with URL that triggers backend Browser Rendering
- **Preconditions**: Mock API endpoints for add_memory MCP tool
- **Test Steps**:
  1. Render MemoryForm component
  2. Fill form with name, content, and URL
  3. Submit form
  4. Verify API call to add_memory MCP tool
  5. Verify loading state shows "Fetching URL content..."
  6. Verify success message includes URL content preview
- **Expected Results**:
  - Form submits to /api/mcp/add_memory endpoint
  - Loading indicator shows during URL content fetching
  - Success response includes cached_url_content
  - URL content preview displayed to user
  - Form resets after successful submission
- **Test Implementation**:
  ```typescript
  import { screen, waitFor } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { rest } from 'msw';
  
  test('should create memory with URL content fetching via MCP', async () => {
    const user = userEvent.setup();
    
    // Mock MCP add_memory tool response
    server.use(
      rest.post('/api/mcp/add_memory', (req, res, ctx) => {
        return res(ctx.json({
          id: 'test-memory-id',
          cached_url_content: 'React Hooks documentation content...',
          name: 'React Hooks Guide',
          url: 'https://react.dev/learn/hooks'
        }));
      })
    );
    
    renderWithProviders(<MemoryForm onSubmit={mockOnSubmit} />);
    
    // Fill form with URL
    await user.type(screen.getByLabelText(/name/i), 'React Hooks Guide');
    await user.type(screen.getByLabelText(/content/i), 'Comprehensive guide to React hooks');
    await user.type(screen.getByLabelText(/url/i), 'https://react.dev/learn/hooks');
    
    // Submit form
    await user.click(screen.getByRole('button', { name: /create memory/i }));
    
    // Verify loading state shows URL fetching
    expect(screen.getByText(/fetching url content/i)).toBeInTheDocument();
    
    // Wait for success
    await waitFor(() => {
      expect(screen.getByText(/memory created successfully/i)).toBeInTheDocument();
    });
    
    // Verify URL content preview is shown
    expect(screen.getByText(/url content preview/i)).toBeInTheDocument();
    expect(screen.getByText(/react hooks documentation content/i)).toBeInTheDocument();
  });
  ```

##### TC-MCP-FE-001-002: URL Content Preview Display
- **Test ID**: TC-MCP-FE-001-002
- **Description**: Test display of URL content fetched via Browser Rendering API
- **Test Steps**:
  1. Create memory with URL
  2. Verify URL content preview section appears
  3. Test content formatting (Markdown rendering)
  4. Test content truncation for long content
  5. Test expand/collapse functionality
- **Expected Results**:
  - URL content preview section visible
  - Markdown content rendered properly
  - Long content truncated with "Show more" option
  - Content source URL displayed
- **Test Implementation**:
  ```typescript
  test('should display URL content preview with proper formatting', async () => {
    const mockMemoryWithUrl = {
      id: 'test-id',
      name: 'React Guide',
      content: 'React guide',
      url: 'https://react.dev',
      url_content: {
        content: 'React Hooks useState and useEffect are fundamental...',
        markdown: '# React Hooks\n\n**useState** and **useEffect** are fundamental hooks...',
        title: 'React Documentation',
        cached_at: Date.now()
      }
    };
    
    renderWithProviders(<MemoryDetail memory={mockMemoryWithUrl} />);
    
    // Verify URL content section
    expect(screen.getByText(/url content preview/i)).toBeInTheDocument();
    expect(screen.getByText(/react documentation/i)).toBeInTheDocument();
    
    // Verify Markdown rendering
    expect(screen.getByRole('heading', { name: /react hooks/i })).toBeInTheDocument();
    expect(screen.getByText(/usestate/i)).toBeInTheDocument();
    
    // Verify source URL
    expect(screen.getByText('react.dev')).toBeInTheDocument();
  });
  ```

##### TC-MCP-FE-001-003: URL Content Refresh Functionality
- **Test ID**: TC-MCP-FE-001-003
- **Description**: Test manual URL content refresh via update_url_content MCP tool
- **Test Steps**:
  1. Display memory with existing URL content
  2. Click "Refresh URL Content" button
  3. Verify API call to update_url_content MCP tool
  4. Show loading state during refresh
  5. Update content preview with new content
- **Expected Results**:
  - Refresh button triggers update_url_content API call
  - Loading indicator shows during refresh
  - Content preview updates with new content
  - Success message confirms content refresh
- **Test Implementation**:
  ```typescript
  test('should refresh URL content via MCP update_url_content tool', async () => {
    const user = userEvent.setup();
    
    server.use(
      rest.post('/api/mcp/update_url_content', (req, res, ctx) => {
        return res(ctx.json({
          memory_id: 'test-id',
          content_updated: true,
          cached_at: Date.now(),
          url_content: 'Updated React Hooks documentation...'
        }));
      })
    );
    
    const mockMemory = createMockMemoryWithUrl();
    renderWithProviders(<MemoryDetail memory={mockMemory} />);
    
    // Click refresh button
    await user.click(screen.getByRole('button', { name: /refresh url content/i }));
    
    // Verify loading state
    expect(screen.getByText(/refreshing content/i)).toBeInTheDocument();
    
    // Wait for update
    await waitFor(() => {
      expect(screen.getByText(/content refreshed successfully/i)).toBeInTheDocument();
    });
    
    // Verify updated content
    expect(screen.getByText(/updated react hooks documentation/i)).toBeInTheDocument();
  });
  ```

#### MCP-FE-002: Search Integration with FTS Tests

##### TC-MCP-FE-002-001: Search with MCP find_memories Tool
- **Test ID**: TC-MCP-FE-002-001
- **Description**: Test search functionality integrated with backend find_memories MCP tool
- **Test Steps**:
  1. Render search interface
  2. Enter search query
  3. Verify API call to find_memories MCP tool
  4. Display search results with relevance ranking
  5. Test combined text and tag search
- **Expected Results**:
  - Search query triggers find_memories MCP tool
  - Results displayed with relevance scores
  - Search time shown to user
  - Combined search works correctly
- **Test Implementation**:
  ```typescript
  test('should search memories via MCP find_memories tool', async () => {
    const user = userEvent.setup();
    
    server.use(
      rest.post('/api/mcp/find_memories', (req, res, ctx) => {
        return res(ctx.json({
          memories: [
            { id: '1', name: 'React Hooks', content: 'useState and useEffect...' },
            { id: '2', name: 'JavaScript Arrays', content: 'map, filter, reduce...' }
          ],
          total: 2,
          search_time_ms: 45
        }));
      })
    );
    
    renderWithProviders(<SearchPage />);
    
    // Enter search query
    await user.type(screen.getByLabelText(/search/i), 'React hooks');
    await user.click(screen.getByRole('button', { name: /search/i }));
    
    // Verify loading state
    expect(screen.getByText(/searching/i)).toBeInTheDocument();
    
    // Wait for results
    await waitFor(() => {
      expect(screen.getByText(/2 results found/i)).toBeInTheDocument();
    });
    
    // Verify search results
    expect(screen.getByText(/react hooks/i)).toBeInTheDocument();
    expect(screen.getByText(/javascript arrays/i)).toBeInTheDocument();
    
    // Verify search time display
    expect(screen.getByText(/search completed in 45ms/i)).toBeInTheDocument();
  });
  ```

##### TC-MCP-FE-002-002: Real-time Search with Debouncing
- **Test ID**: TC-MCP-FE-002-002
- **Description**: Test real-time search with proper debouncing to prevent excessive MCP calls
- **Test Steps**:
  1. Type search query character by character
  2. Verify search is debounced (not called immediately)
  3. Verify search triggers after debounce delay
  4. Test search cancellation when typing continues
- **Expected Results**:
  - Search debounced to prevent excessive API calls
  - Search triggers after 300ms delay
  - Previous searches cancelled when new input provided
- **Test Implementation**:
  ```typescript
  test('should debounce search to optimize MCP tool calls', async () => {
    const user = userEvent.setup();
    const mockFindMemories = vi.fn();
    
    server.use(
      rest.post('/api/mcp/find_memories', mockFindMemories)
    );
    
    renderWithProviders(<SearchBar onSearch={mockOnSearch} />);
    
    const searchInput = screen.getByLabelText(/search/i);
    
    // Type quickly
    await user.type(searchInput, 'React');
    
    // Should not trigger immediately
    expect(mockFindMemories).not.toHaveBeenCalled();
    
    // Wait for debounce delay
    await waitFor(() => {
      expect(mockFindMemories).toHaveBeenCalledTimes(1);
    }, { timeout: 500 });
    
    // Type more - should cancel previous and start new debounce
    await user.type(searchInput, ' hooks');
    
    await waitFor(() => {
      expect(mockFindMemories).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'React hooks'
        })
      );
    }, { timeout: 500 });
  });
  ```

#### MCP-FE-003: Tag Management Integration Tests

##### TC-MCP-FE-003-001: Tag Addition via MCP add_tags Tool
- **Test ID**: TC-MCP-FE-003-001
- **Description**: Test adding tags to memories via add_tags MCP tool
- **Test Steps**:
  1. Display memory with existing tags
  2. Add new tags using tag input
  3. Verify API call to add_tags MCP tool
  4. Update tag display with new tags
  5. Test tag autocomplete functionality
- **Expected Results**:
  - New tags added via add_tags MCP tool
  - Tag display updates immediately
  - Autocomplete shows existing tags
  - Success feedback shown to user
- **Test Implementation**:
  ```typescript
  test('should add tags via MCP add_tags tool', async () => {
    const user = userEvent.setup();
    
    server.use(
      rest.post('/api/mcp/add_tags', (req, res, ctx) => {
        return res(ctx.json({
          memory_id: 'test-id',
          added_tags: ['typescript', 'frontend'],
          all_tags: ['react', 'hooks', 'typescript', 'frontend']
        }));
      })
    );
    
    const mockMemory = createMockMemory(['react', 'hooks']);
    renderWithProviders(<MemoryDetail memory={mockMemory} />);
    
    // Add new tags
    const tagInput = screen.getByLabelText(/add tags/i);
    await user.type(tagInput, 'typescript');
    await user.keyboard('{Enter}');
    await user.type(tagInput, 'frontend');
    await user.keyboard('{Enter}');
    
    // Click add button
    await user.click(screen.getByRole('button', { name: /add tags/i }));
    
    // Wait for update
    await waitFor(() => {
      expect(screen.getByText(/tags added successfully/i)).toBeInTheDocument();
    });
    
    // Verify new tags displayed
    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByText('frontend')).toBeInTheDocument();
  });
  ```

---

## Browser Rendering Integration Frontend Tests

### Test Suite: BrowserRenderingIntegration.test.tsx
**Coverage Target**: 85%  
**Total Test Cases**: 20
**Resource Reference**: Backend Cloudflare Browser Rendering for LLMs integration

#### BR-FE-001: URL Content Display Tests

##### TC-BR-FE-001-001: URL Content Preview with Markdown Rendering
- **Test ID**: TC-BR-FE-001-001
- **Description**: Test display of URL content fetched via Browser Rendering with Markdown support
- **Test Steps**:
  1. Display memory with URL content from Browser Rendering
  2. Verify Markdown content renders properly
  3. Test code syntax highlighting
  4. Test link handling and navigation
  5. Test image display (if supported)
- **Expected Results**:
  - Markdown content renders with proper formatting
  - Code blocks have syntax highlighting
  - Links are clickable and open in new tabs
  - Content structure preserved from Browser Rendering extraction
- **Test Implementation**:
  ```typescript
  test('should render URL content with Markdown formatting', () => {
    const mockMemoryWithUrlContent = {
      id: 'test-id',
      name: 'API Documentation',
      url: 'https://api.example.com/docs',
      url_content: {
        markdown: `# API Documentation

## Authentication
Use \`Bearer\` tokens for authentication:

\`\`\`javascript
fetch('/api/data', {
  headers: {
    'Authorization': 'Bearer your-token'
  }
});
\`\`\`

[View full docs](https://api.example.com/docs/full)`,
        title: 'API Documentation',
        cached_at: Date.now()
      }
    };
    
    renderWithProviders(<URLContentPreview memory={mockMemoryWithUrlContent} />);
    
    // Verify Markdown rendering
    expect(screen.getByRole('heading', { name: /api documentation/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /authentication/i })).toBeInTheDocument();
    
    // Verify code block rendering
    expect(screen.getByText(/bearer/i)).toBeInTheDocument();
    expect(screen.getByText(/fetch\('/api/data/i)).toBeInTheDocument();
    
    // Verify link rendering
    const fullDocsLink = screen.getByRole('link', { name: /view full docs/i });
    expect(fullDocsLink).toHaveAttribute('href', 'https://api.example.com/docs/full');
    expect(fullDocsLink).toHaveAttribute('target', '_blank');
  });
  ```

##### TC-BR-FE-001-002: URL Content Metadata Display
- **Test ID**: TC-BR-FE-001-002
- **Description**: Test display of URL content metadata from Browser Rendering
- **Test Steps**:
  1. Display URL content with metadata
  2. Show original URL and title
  3. Display cache timestamp
  4. Show content size and type
  5. Test refresh indicator
- **Expected Results**:
  - Original URL displayed as clickable link
  - Page title shown prominently
  - Cache timestamp in human-readable format
  - Content metadata (size, type) displayed
- **Test Implementation**:
  ```typescript
  test('should display URL content metadata', () => {
    const cacheTime = Date.now() - 3600000; // 1 hour ago
    const mockMemoryWithMetadata = {
      id: 'test-id',
      name: 'React Guide',
      url: 'https://react.dev/learn',
      url_content: {
        title: 'Learn React - Official Documentation',
        content: 'React is a JavaScript library...',
        contentType: 'text/html',
        size: 15420,
        cached_at: cacheTime
      }
    };
    
    renderWithProviders(<URLContentPreview memory={mockMemoryWithMetadata} />);
    
    // Verify URL display
    const originalUrl = screen.getByRole('link', { name: /react.dev\/learn/i });
    expect(originalUrl).toHaveAttribute('href', 'https://react.dev/learn');
    
    // Verify title
    expect(screen.getByText(/learn react - official documentation/i)).toBeInTheDocument();
    
    // Verify cache timestamp
    expect(screen.getByText(/cached 1 hour ago/i)).toBeInTheDocument();
    
    // Verify content metadata
    expect(screen.getByText(/15.4 kb/i)).toBeInTheDocument();
    expect(screen.getByText(/html/i)).toBeInTheDocument();
  });
  ```

##### TC-BR-FE-001-003: URL Content Error States
- **Test ID**: TC-BR-FE-001-003
- **Description**: Test error states for URL content fetching failures
- **Test Steps**:
  1. Display memory with failed URL content fetch
  2. Show appropriate error message
  3. Provide retry option
  4. Test different error types (404, timeout, etc.)
- **Expected Results**:
  - Clear error messages for different failure types
  - Retry button available for transient failures
  - Original URL still accessible
  - Memory content still displayed
- **Test Implementation**:
  ```typescript
  test('should handle URL content fetch errors gracefully', async () => {
    const user = userEvent.setup();
    
    const mockMemoryWithError = {
      id: 'test-id',
      name: 'Broken Link Example',
      url: 'https://example.com/broken',
      url_content_error: {
        type: 'FETCH_FAILED',
        message: 'Page not found (404)',
        timestamp: Date.now()
      }
    };
    
    renderWithProviders(<URLContentPreview memory={mockMemoryWithError} />);
    
    // Verify error message
    expect(screen.getByText(/failed to fetch url content/i)).toBeInTheDocument();
    expect(screen.getByText(/page not found \(404\)/i)).toBeInTheDocument();
    
    // Verify retry option
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
    
    // Verify original URL still accessible
    const originalUrl = screen.getByRole('link', { name: /example.com\/broken/i });
    expect(originalUrl).toHaveAttribute('href', 'https://example.com/broken');
  });
  ```

#### BR-FE-002: Content Processing Display Tests

##### TC-BR-FE-002-001: Content Area Detection Feedback
- **Test ID**: TC-BR-FE-002-001
- **Description**: Test display of content extraction feedback from Browser Rendering
- **Test Steps**:
  1. Display URL content with extraction metadata
  2. Show which content selector was used
  3. Display content confidence score
  4. Show extracted vs. full page content ratio
- **Expected Results**:
  - Content extraction method displayed
  - Confidence indicators shown
  - User understands content quality
- **Test Implementation**:
  ```typescript
  test('should display content extraction feedback', () => {
    const mockMemoryWithExtraction = {
      id: 'test-id',
      name: 'Article Example',
      url: 'https://blog.example.com/article',
      url_content: {
        content: 'Main article content...',
        extraction_metadata: {
          selector_used: 'article',
          confidence_score: 0.95,
          content_ratio: 0.78,
          total_page_size: 45000,
          extracted_size: 35000
        }
      }
    };
    
    renderWithProviders(<URLContentPreview memory={mockMemoryWithExtraction} />);
    
    // Verify extraction feedback
    expect(screen.getByText(/content extracted from main article/i)).toBeInTheDocument();
    expect(screen.getByText(/high confidence \(95%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/78% of page content/i)).toBeInTheDocument();
  });
  ```

---

## MCP Inspector Integration Frontend Tests

### Test Suite: MCPInspectorIntegration.test.tsx
**Coverage Target**: 75%  
**Total Test Cases**: 15
**Resource Reference**: Backend MCP Inspector integration for testing

#### INSP-FE-001: Development Tools Integration Tests

##### TC-INSP-FE-001-001: Inspector Integration Debug Panel
- **Test ID**: TC-INSP-FE-001-001
- **Description**: Test development debug panel that shows MCP Inspector integration
- **Preconditions**: Development mode enabled
- **Test Steps**:
  1. Enable development mode
  2. Verify debug panel appears
  3. Test MCP tool execution tracking
  4. Show recent API calls and responses
- **Expected Results**:
  - Debug panel visible in development mode
  - MCP tool calls tracked and displayed
  - Response times and success rates shown
  - Inspector connection status displayed
- **Test Implementation**:
  ```typescript
  test('should show MCP Inspector debug panel in development mode', () => {
    process.env.NODE_ENV = 'development';
    
    renderWithProviders(<App />, {
      initialState: {
        settings: { debugMode: true }
      }
    });
    
    // Verify debug panel
    expect(screen.getByText(/mcp debug panel/i)).toBeInTheDocument();
    expect(screen.getByText(/inspector status/i)).toBeInTheDocument();
    
    // Verify tool tracking
    expect(screen.getByText(/recent mcp tool calls/i)).toBeInTheDocument();
    expect(screen.getByText(/average response time/i)).toBeInTheDocument();
  });
  ```

##### TC-INSP-FE-001-002: API Call Inspection
- **Test ID**: TC-INSP-FE-001-002
- **Description**: Test inspection of MCP API calls for debugging
- **Test Steps**:
  1. Execute memory operations
  2. View API call details in debug panel
  3. Inspect request/response payloads
  4. Test error tracking and display
- **Expected Results**:
  - All MCP tool calls logged
  - Request/response details viewable
  - Error states clearly highlighted
  - Performance metrics displayed
- **Test Implementation**:
  ```typescript
  test('should track and display MCP API call details', async () => {
    const user = userEvent.setup();
    process.env.NODE_ENV = 'development';
    
    renderWithProviders(<App />, {
      initialState: {
        settings: { debugMode: true }
      }
    });
    
    // Create a memory to generate API call
    await user.click(screen.getByRole('button', { name: /create memory/i }));
    
    // Check debug panel for API call
    await waitFor(() => {
      expect(screen.getByText(/add_memory/i)).toBeInTheDocument();
    });
    
    // Expand call details
    await user.click(screen.getByText(/add_memory/i));
    
    // Verify details shown
    expect(screen.getByText(/request payload/i)).toBeInTheDocument();
    expect(screen.getByText(/response payload/i)).toBeInTheDocument();
    expect(screen.getByText(/execution time/i)).toBeInTheDocument();
  });
  ```

---

## Enhanced Component Tests with Resource Integration

### Memory Management Components (Enhanced)

#### Test Suite: MemoryForm.test.tsx (Enhanced)
**Coverage Target**: 95%  
**Total Test Cases**: 28 (increased from 22)

#### MF-001: Memory Creation Form Tests (Enhanced)

##### TC-MF-001-001: Render Memory Creation Form
- **Test ID**: TC-MF-001-001
- **Description**: Verify memory creation form renders correctly with resource integration awareness
- **Preconditions**: Clean component state
- **Test Steps**:
  1. Render MemoryForm component
  2. Verify all form fields are present
  3. Verify form labels and placeholders
  4. Verify submit button is disabled initially
  5. Verify URL content preview section placeholder
- **Expected Results**:
  - Name input field rendered
  - Content textarea rendered
  - URL input field rendered (optional) with Browser Rendering note
  - Tags input field rendered
  - Submit button present but disabled
  - URL content preview section visible
- **Component Structure**:
  ```typescript
  interface MemoryFormProps {
    onSubmit: (memory: CreateMemoryRequest) => void;
    initialData?: Partial<Memory>;
    isLoading?: boolean;
    error?: string;
    enableUrlContentPreview?: boolean; // New: Browser Rendering integration
  }
  ```

##### TC-MF-001-002: Form Input Validation with URL Security
- **Test ID**: TC-MF-001-002
- **Description**: Test real-time form validation including URL security checks
- **Test Steps**:
  1. Enter invalid name (empty, too long)
  2. Verify validation error displayed
  3. Enter valid name
  4. Verify error cleared and submit enabled
  5. Test content validation
  6. Test URL format validation with security checks
  7. Test unsafe URLs (localhost, private IPs)
- **Expected Results**:
  - Validation errors show immediately
  - Submit button disabled for invalid form
  - Error messages are descriptive
  - Valid input enables form submission
  - Unsafe URLs rejected with security warning
- **Test Implementation**:
  ```typescript
  test('should validate URLs with security checks', async () => {
    const user = userEvent.setup();
    
    renderWithProviders(<MemoryForm onSubmit={mockOnSubmit} />);
    
    const urlInput = screen.getByLabelText(/url/i);
    
    // Test unsafe URLs
    const unsafeUrls = [
      'http://localhost:3000',
      'http://192.168.1.1',
      'file:///etc/passwd'
    ];
    
    for (const unsafeUrl of unsafeUrls) {
      await user.clear(urlInput);
      await user.type(urlInput, unsafeUrl);
      
      await waitFor(() => {
        expect(screen.getByText(/unsafe url detected/i)).toBeInTheDocument();
      });
    }
    
    // Test safe URL
    await user.clear(urlInput);
    await user.type(urlInput, 'https://react.dev');
    
    await waitFor(() => {
      expect(screen.queryByText(/unsafe url detected/i)).not.toBeInTheDocument();
    });
  });
  ```

##### TC-MF-001-003: Memory Form Submission with URL Content Processing
- **Test ID**: TC-MF-001-003
- **Description**: Test successful memory creation with URL content fetching
- **Test Steps**:
  1. Fill out valid form data including URL
  2. Click submit button
  3. Verify onSubmit callback called with correct data
  4. Verify loading state shows "Processing URL content..."
  5. Verify URL content preview updates after submission
  6. Verify form reset after successful submission
- **Expected Results**:
  - Correct data passed to onSubmit
  - Loading spinner with URL processing message shown
  - URL content preview populated
  - Form cleared after success
- **Test Data**:
  ```typescript
  const validFormDataWithUrl = {
    name: "React Hooks Guide",
    content: "useState and useEffect are fundamental hooks",
    url: "https://react.dev/reference/react",
    tags: ["react", "hooks", "javascript"]
  };
  
  const expectedUrlContent = {
    title: "React Reference - Hooks",
    content: "React Hooks allow you to use state and other React features...",
    markdown: "# React Hooks\n\n**useState** allows you to add state...",
    cached_at: Date.now()
  };
  ```

##### TC-MF-001-004: Tag Input with Autocomplete Integration
- **Test ID**: TC-MF-001-004
- **Description**: Test tag input functionality with backend tag suggestions
- **Test Steps**:
  1. Type tag name and verify autocomplete suggestions
  2. Select tag from suggestions via MCP backend
  3. Verify tag added to tags list
  4. Click remove button on tag
  5. Verify tag removed from list
  6. Test tag validation (duplicate prevention)
- **Expected Results**:
  - Tags added/removed correctly
  - Duplicate tags prevented
  - Autocomplete shows existing tags from backend
  - Tag suggestions based on similar memories
- **Test Implementation**:
  ```typescript
  test('should provide tag autocomplete via backend integration', async () => {
    const user = userEvent.setup();
    
    // Mock tag suggestions API
    server.use(
      rest.get('/api/tags/suggestions', (req, res, ctx) => {
        const query = req.url.searchParams.get('q');
        const suggestions = ['react', 'javascript', 'hooks', 'frontend'];
        return res(ctx.json(
          suggestions.filter(tag => tag.includes(query))
        ));
      })
    );
    
    renderWithProviders(<MemoryForm onSubmit={mockOnSubmit} />);
    
    const tagInput = screen.getByLabelText(/tags/i);
    
    // Type partial tag name
    await user.type(tagInput, 'reac');
    
    // Wait for suggestions
    await waitFor(() => {
      expect(screen.getByText('react')).toBeInTheDocument();
    });
    
    // Select suggestion
    await user.click(screen.getByText('react'));
    
    // Verify tag added
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(tagInput).toHaveValue('');
  });
  ```

##### TC-MF-001-005: Memory Edit Mode with URL Content Preservation
- **Test ID**: TC-MF-001-005
- **Description**: Test editing existing memory while preserving URL content
- **Test Steps**:
  1. Render form with initialData including URL content
  2. Verify form pre-populated with existing data
  3. Verify URL content preview shows cached content
  4. Modify form fields (but not URL)
  5. Submit changes
  6. Verify update data sent correctly with preserved URL content
- **Expected Results**:
  - Form pre-populated with existing data
  - URL content preview shows cached data
  - Changes tracked correctly
  - URL content preserved during update
- **Test Implementation**:
  ```typescript
  test('should preserve URL content during memory edit', async () => {
    const user = userEvent.setup();
    
    const existingMemory = {
      id: 'test-id',
      name: 'React Guide',
      content: 'Original content',
      url: 'https://react.dev',
      tags: ['react'],
      url_content: {
        title: 'React Documentation',
        content: 'Cached content...',
        cached_at: Date.now() - 3600000 // 1 hour ago
      }
    };
    
    renderWithProviders(
      <MemoryForm 
        onSubmit={mockOnSubmit} 
        initialData={existingMemory}
        mode="edit"
      />
    );
    
    // Verify form pre-populated
    expect(screen.getByDisplayValue('React Guide')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Original content')).toBeInTheDocument();
    
    // Verify URL content preview
    expect(screen.getByText(/react documentation/i)).toBeInTheDocument();
    expect(screen.getByText(/cached 1 hour ago/i)).toBeInTheDocument();
    
    // Modify only the content
    const contentInput = screen.getByLabelText(/content/i);
    await user.clear(contentInput);
    await user.type(contentInput, 'Updated content');
    
    // Submit
    await user.click(screen.getByRole('button', { name: /update/i }));
    
    // Verify submission includes preserved URL content
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Updated content',
        url_content: existingMemory.url_content // Preserved
      })
    );
  });
  ```

### Search Components (Enhanced)

#### Test Suite: SearchBar.test.tsx (Enhanced)
**Coverage Target**: 95% (increased from 90%)  
**Total Test Cases**: 20 (increased from 15)

#### SB-001: Search Input Tests (Enhanced with MCP Integration)

##### TC-SB-001-001: Search Input Rendering with MCP Status
- **Test ID**: TC-SB-001-001
- **Description**: Test search bar component rendering with MCP backend status
- **Test Steps**:
  1. Render SearchBar component
  2. Verify search input field present
  3. Verify search icon displayed
  4. Verify placeholder text mentions FTS capability
  5. Verify MCP backend status indicator
- **Expected Results**:
  - Search input field rendered
  - Placeholder mentions "Search with full-text search"
  - Search icon visible
  - Backend status indicator shows connected/disconnected
- **Test Implementation**:
  ```typescript
  test('should render search bar with MCP status indicator', () => {
    renderWithProviders(<SearchBar onSearch={mockOnSearch} />);
    
    // Verify search input
    expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search with full-text search/i)).toBeInTheDocument();
    
    // Verify MCP status
    expect(screen.getByTitle(/mcp backend connected/i)).toBeInTheDocument();
    
    // Verify search capabilities note
    expect(screen.getByText(/supports content and tag search/i)).toBeInTheDocument();
  });
  ```

##### TC-SB-001-002: Search Query Input with FTS Preview
- **Test ID**: TC-SB-001-002
- **Description**: Test search query input with FTS query preview
- **Test Steps**:
  1. Type search query in input
  2. Verify input value updates
  3. Show FTS query preview/suggestions
  4. Press Enter key
  5. Verify search callback triggered with FTS-optimized query
  6. Test search button click
- **Expected Results**:
  - Input updates as user types
  - FTS query preview shown
  - Search triggered on Enter
  - Query optimized for FTS backend
- **Test Implementation**:
  ```typescript  
  test('should show FTS query preview and optimization', async () => {
    const user = userEvent.setup();
    
    renderWithProviders(<SearchBar onSearch={mockOnSearch} />);
    
    const searchInput = screen.getByLabelText(/search/i);
    
    // Type complex search query
    await user.type(searchInput, 'React hooks useState OR useEffect');
    
    // Verify FTS preview
    await waitFor(() => {
      expect(screen.getByText(/fts query preview/i)).toBeInTheDocument();
      expect(screen.getByText(/react AND hooks AND \(usestate OR useeffect\)/i)).toBeInTheDocument();
    });
    
    // Submit search
    await user.keyboard('{Enter}');
    
    // Verify optimized query sent
    expect(mockOnSearch).toHaveBeenCalledWith({
      query: 'React AND hooks AND (useState OR useEffect)',
      type: 'fts',
      original: 'React hooks useState OR useEffect'
    });
  });
  ```

##### TC-SB-001-003: Search Suggestions with Backend Integration
- **Test ID**: TC-SB-001-003
- **Description**: Test search autocomplete/suggestions from backend
- **Test Steps**:
  1. Type partial search query
  2. Verify suggestions dropdown appears from backend
  3. Test suggestion ranking and relevance
  4. Click on suggestion
  5. Verify suggestion selected and search triggered
- **Expected Results**:
  - Suggestions appear from backend search history
  - Suggestions ranked by relevance and frequency
  - Clicking suggestion triggers search
  - Dropdown dismissed after selection
- **Test Implementation**:
  ```typescript
  test('should fetch search suggestions from backend', async () => {
    const user = userEvent.setup();
    
    server.use(
      rest.get('/api/search/suggestions', (req, res, ctx) => {
        const query = req.url.searchParams.get('q');
        return res(ctx.json([
          { text: 'React hooks', frequency: 15, type: 'content' },
          { text: 'React components', frequency: 12, type: 'content' },
          { text: 'react', frequency: 25, type: 'tag' }
        ]));
      })
    );
    
    renderWithProviders(<SearchBar onSearch={mockOnSearch} />);
    
    const searchInput = screen.getByLabelText(/search/i);
    
    // Type partial query
    await user.type(searchInput, 'Reac');
    
    // Wait for suggestions
    await waitFor(() => {
      expect(screen.getByText('React hooks')).toBeInTheDocument();
      expect(screen.getByText('React components')).toBeInTheDocument();
    });
    
    // Verify suggestion metadata
    expect(screen.getByText('15 matches')).toBeInTheDocument();
    expect(screen.getByText('tag')).toBeInTheDocument();
    
    // Select suggestion
    await user.click(screen.getByText('React hooks'));
    
    // Verify search triggered
    expect(mockOnSearch).toHaveBeenCalledWith({
      query: 'React hooks',
      source: 'suggestion'
    });
  });
  ```

---

## Test Data Management (Enhanced)

### Mock Data Factory (Updated)

```typescript
class FrontendTestDataFactory {
  // Enhanced memory creation with resource integration
  static createMockMemory(): Memory {
    return {
      id: "test-memory-123",
      name: "Test Memory",
      content: "This is test content for the memory",
      url: "https://example.com",
      tags: ["test", "mock"],
      created_at: Date.now(),
      updated_at: Date.now()
    };
  }

  static createMockMemoryWithUrlContent(): Memory {
    return {
      ...this.createMockMemory(),
      url_content: {
        title: "Example Page Title",
        content: "Extracted content from Browser Rendering API...",
        markdown: "# Example Page\n\nExtracted content from Browser Rendering API...",
        contentType: "text/html",
        size: 2048,
        cached_at: Date.now() - 1800000, // 30 minutes ago
        expires_at: Date.now() + (5 * 24 * 60 * 60 * 1000), // 5 days from now
        extraction_metadata: {
          selector_used: "article",
          confidence_score: 0.92,
          content_ratio: 0.85
        }
      }
    };
  }

  static createMockMemories(count: number): Memory[] {
    return Array.from({ length: count }, (_, i) => ({
      ...this.createMockMemory(),
      id: `test-memory-${i}`,
      name: `Test Memory ${i}`,
      content: `Content for memory ${i}`,
      tags: [`tag${i % 3}`, "common"]
    }));
  }

  static createMockSearchResults(): SearchResult {
    return {
      memories: this.createMockMemories(10),
      total: 100,
      search_time_ms: 45,
      fts_query: "React AND hooks",
      tag_filters: ["react", "javascript"]
    };
  }

  // MCP Tool Response Mocks
  static createMockMCPToolResponse(toolName: string, data: any): MCPToolResponse {
    return {
      jsonrpc: "2.0",
      id: Math.random().toString(36).substr(2, 9),
      result: {
        tool: toolName,
        success: true,
        data,
        execution_time_ms: Math.floor(Math.random() * 100) + 20
      }
    };
  }

  // Browser Rendering Mock Response
  static createMockBrowserRenderingContent(): URLContent {
    return {
      url: "https://example.com/test",
      title: "Test Page Title",
      content: "Main content extracted by Browser Rendering API with LLM optimization",
      markdown: "# Test Page Title\n\nMain content extracted by Browser Rendering API with **LLM optimization**",
      contentType: "text/html",
      size: 3542,
      cached_at: Date.now(),
      expires_at: Date.now() + (5 * 24 * 60 * 60 * 1000),
      extraction_metadata: {
        selector_used: "main",
        confidence_score: 0.88,
        content_ratio: 0.72,
        processing_time_ms: 1250
      }
    };
  }
}
```

### API Mocking (Enhanced with Resource Integration)

```typescript
// Enhanced MSW API mocking setup with resource integration
const apiHandlers = [
  // Standard memory operations
  rest.get('/api/memories', (req, res, ctx) => {
    return res(ctx.json(FrontendTestDataFactory.createMockMemories(20)));
  }),
  
  rest.post('/api/memories', (req, res, ctx) => {
    const memory = FrontendTestDataFactory.createMockMemory();
    return res(ctx.json(memory));
  }),
  
  // MCP Tool endpoints
  rest.post('/api/mcp/add_memory', (req, res, ctx) => {
    const mockResponse = FrontendTestDataFactory.createMockMCPToolResponse(
      'add_memory',
      {
        id: generateUUID(),
        cached_url_content: req.body.url ? 
          FrontendTestDataFactory.createMockBrowserRenderingContent() : 
          null
      }
    );
    return res(ctx.json(mockResponse));
  }),

  rest.post('/api/mcp/find_memories', (req, res, ctx) => {
    const searchResult = FrontendTestDataFactory.createMockSearchResults();
    const mockResponse = FrontendTestDataFactory.createMockMCPToolResponse(
      'find_memories',
      searchResult
    );
    return res(ctx.json(mockResponse));
  }),

  rest.post('/api/mcp/update_url_content', (req, res, ctx) => {
    const updatedContent = FrontendTestDataFactory.createMockBrowserRenderingContent();
    const mockResponse = FrontendTestDataFactory.createMockMCPToolResponse(
      'update_url_content',
      {
        memory_id: req.body.id,
        content_updated: true,
        url_content: updatedContent
      }
    );
    return res(ctx.json(mockResponse));
  }),

  rest.post('/api/mcp/add_tags', (req, res, ctx) => {
    const mockResponse = FrontendTestDataFactory.createMockMCPToolResponse(
      'add_tags',
      {
        memory_id: req.body.id,
        added_tags: req.body.tags,
        all_tags: ['existing', 'tags', ...req.body.tags]
      }
    );
    return res(ctx.json(mockResponse));
  }),

  // Search suggestions
  rest.get('/api/search/suggestions', (req, res, ctx) => {
    const query = req.url.searchParams.get('q');
    const suggestions = [
      { text: `${query} hooks`, frequency: 15, type: 'content' },
      { text: `${query} components`, frequency: 12, type: 'content' },
      { text: query.toLowerCase(), frequency: 25, type: 'tag' }
    ];
    return res(ctx.json(suggestions));
  }),

  // Tag suggestions
  rest.get('/api/tags/suggestions', (req, res, ctx) => {
    const query = req.url.searchParams.get('q');
    const allTags = ['react', 'javascript', 'typescript', 'hooks', 'components', 'frontend'];
    const suggestions = allTags.filter(tag => tag.includes(query.toLowerCase()));
    return res(ctx.json(suggestions));
  })
];
```

---

## Coverage Requirements (Updated)

### Minimum Coverage Targets
- **Overall Frontend Coverage**: 85%
- **React Components**: 95% (increased due to resource integration)
- **Custom Hooks**: 95%
- **Utility Functions**: 90%
- **API Client**: 90% (increased due to MCP integration)
- **State Management**: 90%

### Resource-Specific Coverage Requirements
- **MCP Tool Integration**: 90% - Critical for backend communication
- **Browser Rendering Integration**: 85% - Essential for URL content features
- **Search Integration**: 90% - Core functionality with FTS backend

### Coverage Exclusions
- Type definitions
- Mock files
- Test utilities
- Configuration files
- Development-only components
- MCP Inspector UI components (external dependency)

---

## Test Execution Strategy (Enhanced)

### Test Categories
1. **Unit Tests**: Individual component and function tests
2. **Resource Integration Tests**: MCP, Browser Rendering, Inspector integration
3. **User Workflow Tests**: Complete user scenarios with resource integration
4. **Performance Tests**: UI performance with backend resource usage
5. **Accessibility Tests**: Screen reader and keyboard navigation

### Test Execution Order
1. Utility and helper function tests
2. Custom hook tests
3. Individual component tests
4. Resource integration tests (MCP, Browser Rendering)
5. Component interaction tests
6. User workflow tests with full resource integration
7. Performance and accessibility tests

### Resource Integration Testing Pipeline
```yaml
frontendResourceIntegrationTesting:
  mcpIntegration:
    - memory CRUD via MCP tools
    - search integration with find_memories
    - tag management via add_tags
    - real-time API status monitoring
    
  browserRenderingIntegration:
    - URL content preview display
    - Markdown content rendering
    - content metadata display
    - error state handling
    
  inspectorIntegration:
    - development debug panel
    - API call tracking and display
    - performance monitoring
    - error debugging tools
```

### Continuous Integration (Enhanced)
- Run unit tests on every commit
- Run resource integration tests on pull requests
- Run E2E tests with full resource stack nightly
- Run accessibility tests weekly
- Generate coverage reports with resource-specific breakdowns
- Performance regression testing with resource integration

This comprehensive frontend test specification ensures the Memory Server React application provides an excellent user experience with high reliability, accessibility, and performance standards while properly integrating with all three key backend resources: MCP Server TypeScript SDK, MCP Inspector, and Cloudflare Browser Rendering for LLMs.