# Backend Unit Test Specifications - Memory Server

## Overview
This document provides comprehensive unit test specifications for the Memory Server backend components, covering all business requirements from the PRD and technical specifications from the architecture document, with specific focus on the integration of key resources: MCP Server TypeScript SDK, MCP Inspector, and Cloudflare Browser Rendering for LLMs.

## Test Environment Setup

### Test Framework: Vitest
- **Rationale**: Fast, lightweight, and TypeScript-native testing framework
- **Configuration**: ESM modules, TypeScript support, coverage reporting
- **Mock Strategy**: In-memory D1 database, KV namespace mocks, Browser Rendering API mocks
- **MCP Testing**: Integration with MCP Inspector for local testing validation

### Resource-Specific Test Configuration
```typescript
// Test environment with resource integrations
interface TestEnvironment {
  database: D1Database;              // In-memory SQLite for testing
  kvNamespace: KVNamespace;         // Mock KV store
  browserClient: Fetcher;           // Mock Browser Rendering API
  mcpInspector: MCPInspector;       // Local MCP testing environment
}

// MCP SDK Testing Setup
interface MCPTestConfig {
  sdkVersion: string;               // "@modelcontextprotocol/sdk": "^1.0.0"
  transport: "http-streamable";     // HTTP Streamable transport for edge
  inspector: {
    enabled: boolean;               // Enable MCP Inspector integration
    port: number;                   // Local inspector port (default: 3000)
    timeout: number;                // Tool execution timeout
  };
}
```

---

## MCP Server TypeScript SDK Integration Tests

### Test Suite: MCPSDKIntegration.test.ts
**Coverage Target**: 95%  
**Total Test Cases**: 42
**Resource Reference**: https://github.com/modelcontextprotocol/typescript-sdk

#### MCP-SDK-001: SDK Server Setup Tests

##### TC-MCP-SDK-001-001: MCP Server Initialization with TypeScript SDK
- **Test ID**: TC-MCP-SDK-001-001
- **Description**: Test proper MCP server initialization using official TypeScript SDK
- **Preconditions**: MCP SDK installed and imported correctly
- **Test Steps**:
  1. Import Server from "@modelcontextprotocol/sdk/server/index.js"
  2. Create server instance with name, version, and capabilities
  3. Verify server properties are set correctly
  4. Verify capabilities object includes tools and resources
- **Expected Results**:
  - Server instance created successfully
  - Server name: "memory-server"
  - Server version matches package.json
  - Capabilities include tools and resources objects
- **Test Implementation**:
  ```typescript
  import { Server } from "@modelcontextprotocol/sdk/server/index.js";
  
  test('should initialize MCP server with correct configuration', () => {
    const server = new Server({
      name: "memory-server",
      version: "1.0.0",
      description: "Developer memory storage with URL content caching"
    }, {
      capabilities: {
        tools: {},
        resources: {}
      }
    });
    
    expect(server).toBeDefined();
    expect(server.getServerInfo().name).toBe("memory-server");
    expect(server.getServerInfo().version).toBe("1.0.0");
  });
  ```

##### TC-MCP-SDK-001-002: Tool Registration using server.registerTool
- **Test ID**: TC-MCP-SDK-001-002
- **Description**: Test tool registration using official SDK method
- **Test Steps**:
  1. Create MCP server instance
  2. Call server.registerTool for each of the 7 required tools
  3. Verify tool registration with proper schema validation
  4. Test tool discovery functionality
- **Expected Results**:
  - All 7 tools registered successfully: add_memory, get_memory, list_memories, delete_memory, add_tags, find_memories, update_url_content
  - Input schemas validate correctly
  - Tools discoverable via list_tools call
- **Test Implementation**:
  ```typescript
  test('should register all MCP tools using server.registerTool', () => {
    const server = createMCPServer();
    
    // Register add_memory tool
    server.registerTool("add_memory", {
      description: "Create a new memory with optional URL content fetching",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Human-readable name" },
          content: { type: "string", description: "Memory content" },
          url: { type: "string", format: "uri", description: "Optional URL" },
          tags: { type: "array", items: { type: "string" } }
        },
        required: ["name", "content"]
      }
    });
    
    // Verify tool registration
    const tools = server.listTools();
    expect(tools).toContainEqual(
      expect.objectContaining({
        name: "add_memory",
        description: expect.stringContaining("Create a new memory")
      })
    );
  });
  ```

##### TC-MCP-SDK-001-003: Resource Registration using server.registerResource
- **Test ID**: TC-MCP-SDK-001-003
- **Description**: Test resource registration using official SDK method
- **Test Steps**:
  1. Call server.registerResource for memory resources
  2. Verify resource registration with proper URI pattern
  3. Test resource discovery functionality
  4. Validate resource metadata
- **Expected Results**:
  - Memory resources registered with URI pattern "memory://*"
  - Resource discoverable via list_resources call
  - Proper MIME type and description set
- **Test Implementation**:
  ```typescript
  test('should register memory resources using server.registerResource', () => {
    const server = createMCPServer();
    
    server.registerResource("memory://*", {
      description: "Developer memories with searchable content",
      mimeType: "application/json"
    });
    
    const resources = server.listResources();
    expect(resources).toContainEqual(
      expect.objectContaining({
        uri: "memory://*",
        description: "Developer memories with searchable content",
        mimeType: "application/json"
      })
    );
  });
  ```

#### MCP-SDK-002: HTTP Streamable Transport Tests

##### TC-MCP-SDK-002-001: HTTP Streamable MCP Server Setup
- **Test ID**: TC-MCP-SDK-002-001
- **Description**: Test HTTP Streamable transport configuration for Cloudflare Workers
- **Test Steps**:
  1. Set up HTTP transport for edge deployment
  2. Configure streaming request/response handling
  3. Test request parsing and response streaming
  4. Verify Cloudflare Workers compatibility
- **Expected Results**:
  - HTTP transport configured correctly
  - Streaming works with ReadableStream/WritableStream
  - Compatible with Cloudflare Workers runtime
  - Proper CORS headers set
- **Test Implementation**:
  ```typescript
  test('should handle HTTP streamable transport', async () => {
    const server = createMCPServer();
    const request = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      })
    });
    
    const response = await server.handleRequest(request);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
  ```

#### MCP-SDK-003: Tool Implementation Validation Tests

##### TC-MCP-SDK-003-001: Complete Tool Implementation Coverage
- **Test ID**: TC-MCP-SDK-003-001
- **Description**: Validate all 7 MCP tools are implemented according to SDK patterns
- **Test Steps**:
  1. Test each tool implementation with SDK request handlers
  2. Verify input schema validation
  3. Test proper error handling and responses
  4. Validate output format compliance
- **Expected Results**:
  - All tools handle requests correctly
  - Input validation follows JSON Schema
  - Error responses follow MCP protocol
  - Output matches declared schemas
- **Required Tools**:
  - add_memory: Create memory with URL content fetching
  - get_memory: Retrieve by ID with optional URL content
  - list_memories: Paginated listing with tag filtering
  - delete_memory: Safe deletion with cascade cleanup
  - add_tags: Tag management for existing memories
  - find_memories: Full-text search with tag filtering
  - update_url_content: URL content refresh functionality

---

## MCP Inspector Integration Tests

### Test Suite: MCPInspectorIntegration.test.ts
**Coverage Target**: 90%  
**Total Test Cases**: 28
**Resource Reference**: https://github.com/modelcontextprotocol/inspector

#### MCP-INSP-001: Local Testing Environment Setup

##### TC-MCP-INSP-001-001: MCP Inspector Initialization
- **Test ID**: TC-MCP-INSP-001-001
- **Description**: Set up MCP Inspector for local server testing
- **Preconditions**: MCP Inspector installed and configured
- **Test Steps**:
  1. Initialize MCP Inspector with server configuration
  2. Start inspector server on localhost
  3. Verify inspector UI accessibility
  4. Test server connection and discovery
- **Expected Results**:
  - Inspector starts successfully on configured port
  - UI accessible at http://localhost:3000
  - Server connection established
  - Tools and resources discovered
- **Test Implementation**:
  ```typescript
  import { MCPInspector } from '@modelcontextprotocol/inspector';
  
  class MCPTestEnvironment {
    private inspector: MCPInspector;
    
    async setupInspector(): Promise<void> {
      this.inspector = new MCPInspector({
        serverCommand: ['node', 'dist/mcp-server.js'],
        serverArgs: ['--test-mode'],
        timeout: 30000,
        port: 3000
      });
      
      await this.inspector.start();
      expect(this.inspector.isRunning()).toBe(true);
    }
  }
  ```

##### TC-MCP-INSP-001-002: Tool Discovery via Inspector
- **Test ID**: TC-MCP-INSP-001-002
- **Description**: Test tool discovery and listing through MCP Inspector
- **Test Steps**:
  1. Connect inspector to MCP server
  2. Execute list_tools command
  3. Verify all 7 tools are discovered
  4. Validate tool schemas and descriptions
- **Expected Results**:
  - All required tools discovered: add_memory, get_memory, list_memories, delete_memory, add_tags, find_memories, update_url_content
  - Tool schemas validated
  - Descriptions and input requirements accurate
- **Test Implementation**:
  ```typescript
  test('should discover all tools via MCP Inspector', async () => {
    const tools = await inspector.listTools();
    
    const expectedTools = [
      'add_memory', 'get_memory', 'list_memories', 
      'delete_memory', 'add_tags', 'find_memories', 
      'update_url_content'
    ];
    
    expectedTools.forEach(toolName => {
      expect(tools.find(t => t.name === toolName)).toBeDefined();
    });
  });
  ```

##### TC-MCP-INSP-001-003: Resource Discovery via Inspector
- **Test ID**: TC-MCP-INSP-001-003
- **Description**: Test resource discovery through MCP Inspector
- **Test Steps**:
  1. Execute list_resources command via inspector
  2. Verify memory resources are discoverable
  3. Test resource URI pattern matching
  4. Validate resource metadata
- **Expected Results**:
  - Memory resources discovered with URI "memory://*"
  - Proper MIME type: "application/json"
  - Resource description accurate
- **Test Implementation**:
  ```typescript
  test('should discover memory resources via MCP Inspector', async () => {
    const resources = await inspector.listResources();
    
    expect(resources).toContainEqual(
      expect.objectContaining({
        uri: 'memory://*',
        name: 'Memory Resources',
        description: 'Developer memories with searchable content',
        mimeType: 'application/json'
      })
    );
  });
  ```

#### MCP-INSP-002: Tool Execution Validation Tests

##### TC-MCP-INSP-002-001: Tool Execution via Inspector
- **Test ID**: TC-MCP-INSP-002-001
- **Description**: Test MCP tool execution through inspector interface
- **Test Steps**:
  1. Execute add_memory tool with test data
  2. Verify memory creation and URL content fetching
  3. Execute find_memories to locate created memory
  4. Test all CRUD operations through inspector
- **Expected Results**:
  - Tools execute successfully via inspector
  - Responses match expected schemas
  - Side effects (database, cache) work correctly
  - Error handling functions properly
- **Test Implementation**:
  ```typescript
  test('should execute tools correctly via MCP Inspector', async () => {
    // Test memory creation
    const createResult = await inspector.callTool('add_memory', {
      name: 'inspector-test-memory',
      content: 'Test content via MCP Inspector',
      url: 'https://example.com',
      tags: ['test', 'inspector']
    });
    
    expect(createResult.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(createResult.cached_url_content).toBeDefined();
    
    // Test memory retrieval
    const getResult = await inspector.callTool('get_memory', {
      id: createResult.id,
      include_url_content: true
    });
    
    expect(getResult.name).toBe('inspector-test-memory');
    expect(getResult.url_content).toBeDefined();
  });
  ```

##### TC-MCP-INSP-002-002: Error Handling via Inspector
- **Test ID**: TC-MCP-INSP-002-002
- **Description**: Test error handling and validation through inspector
- **Test Steps**:
  1. Execute tools with invalid inputs
  2. Test missing required parameters
  3. Test constraint violations
  4. Verify error responses follow MCP protocol
- **Expected Results**:
  - Invalid inputs return proper error responses
  - Error messages are descriptive
  - HTTP status codes are appropriate
  - Server remains stable after errors
- **Test Implementation**:
  ```typescript
  test('should handle errors correctly via MCP Inspector', async () => {
    // Test invalid input
    try {
      await inspector.callTool('add_memory', {
        name: '', // Invalid empty name
        content: 'test'
      });
      fail('Should have thrown validation error');
    } catch (error) {
      expect(error.code).toBe('INVALID_PARAMS');
      expect(error.message).toContain('name');
    }
  });
  ```

#### MCP-INSP-003: Integration Workflow Testing

##### TC-MCP-INSP-003-001: Complete Workflow via Inspector
- **Test ID**: TC-MCP-INSP-003-001
- **Description**: Test complete memory management workflow through inspector
- **Test Steps**:
  1. Create memory with URL using add_memory
  2. Search for memory using find_memories
  3. Add tags using add_tags
  4. Update URL content using update_url_content
  5. Retrieve final state using get_memory
  6. Clean up using delete_memory
- **Expected Results**:
  - Complete workflow executes successfully
  - State changes persist correctly
  - URL content caching works properly
  - Search functionality works correctly
- **Test Implementation**:
  ```typescript
  test('should execute complete workflow via MCP Inspector', async () => {
    // Create memory with URL
    const memory = await inspector.callTool('add_memory', {
      name: 'workflow-test',
      content: 'Workflow test memory',
      url: 'https://react.dev',
      tags: ['react', 'docs']
    });
    
    // Search for memory
    const searchResult = await inspector.callTool('find_memories', {
      query: 'workflow test',
      tags: ['react']
    });
    expect(searchResult.memories).toHaveLength(1);
    
    // Add more tags
    await inspector.callTool('add_tags', {
      id: memory.id,
      tags: ['javascript', 'frontend']
    });
    
    // Refresh URL content
    const refreshResult = await inspector.callTool('update_url_content', {
      id: memory.id,
      force_refresh: true
    });
    expect(refreshResult.content_updated).toBe(true);
    
    // Verify final state
    const finalMemory = await inspector.callTool('get_memory', {
      id: memory.id,
      include_url_content: true
    });
    expect(finalMemory.tags).toContain('javascript');
    expect(finalMemory.url_content).toBeDefined();
    
    // Clean up
    const deleteResult = await inspector.callTool('delete_memory', {
      id: memory.id
    });
    expect(deleteResult.deleted).toBe(true);
  });
  ```

---

## Cloudflare Browser Rendering Integration Tests

### Test Suite: BrowserRenderingIntegration.test.ts
**Coverage Target**: 88%  
**Total Test Cases**: 35
**Resource Reference**: https://developers.cloudflare.com/browser-rendering/llms-full.txt

#### BR-001: LLM-Optimized Content Extraction Tests

##### TC-BR-001-001: Browser Rendering Client Initialization
- **Test ID**: TC-BR-001-001
- **Description**: Test Browser Rendering client setup following LLM documentation
- **Preconditions**: Browser Rendering binding available in test environment
- **Test Steps**:
  1. Initialize Browser Rendering client with env.BROWSER binding
  2. Test session creation and management
  3. Verify LLM-optimized settings configuration
  4. Test session cleanup and resource management
- **Expected Results**:
  - Client initializes with proper browser binding
  - Sessions created and managed correctly
  - LLM-optimized settings applied
  - Resource cleanup functions properly
- **Test Implementation**:
  ```typescript
  import { BrowserRenderingClient } from '../src/services/url-content-service';
  
  test('should initialize Browser Rendering client for LLM usage', async () => {
    const client = new BrowserRenderingClient(mockEnv.BROWSER);
    
    const session = await client.createSession();
    expect(session).toBeDefined();
    
    // Test LLM-optimized navigation settings
    await session.navigate('https://example.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    await session.close();
  });
  ```

##### TC-BR-001-002: Content Area Detection and Extraction
- **Test ID**: TC-BR-001-002
- **Description**: Test intelligent content area detection following LLM documentation patterns
- **Test Steps**:
  1. Navigate to test webpage with Browser Rendering
  2. Execute content extraction logic
  3. Test main content area detection using selectors
  4. Verify fallback to body content when needed
  5. Test content cleaning and normalization
- **Expected Results**:
  - Main content areas detected correctly using priority selectors
  - Content extracted without scripts, styles, ads
  - Text normalized with proper whitespace handling
  - Fallback mechanism works for various page structures
- **Test Implementation**:
  ```typescript
  test('should extract main content areas using LLM-optimized selectors', async () => {
    const client = new BrowserRenderingClient(mockEnv.BROWSER);
    const session = await client.createSession();
    
    await session.navigate('https://example.com/article');
    
    const result = await session.evaluate(() => {
      // Priority selectors for main content (from LLM documentation)
      const contentSelectors = [
        'article', 'main', '[role="main"]', '.content',
        '.post', '.entry', '.article', '#content'
      ];
      
      let mainContent = '';
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.length > 100) {
          mainContent = element.textContent;
          break;
        }
      }
      
      return {
        content: mainContent || document.body.textContent || '',
        contentLength: mainContent.length,
        selectorUsed: selector || 'body-fallback'
      };
    });
    
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.contentLength).toBeGreaterThan(50);
    
    await session.close();
  });
  ```

##### TC-BR-001-003: HTML to Markdown Conversion for LLMs
- **Test ID**: TC-BR-001-003
- **Description**: Test HTML to Markdown conversion optimized for LLM consumption
- **Test Steps**:
  1. Extract HTML content from test page
  2. Apply HTML to Markdown conversion
  3. Test preservation of semantic structure
  4. Verify link extraction and formatting
  5. Test code block and formatting preservation
- **Expected Results**:
  - HTML converted to clean Markdown
  - Headers converted to # syntax
  - Links preserved with [text](url) format
  - Code blocks properly formatted
  - Excessive whitespace cleaned up
- **Test Implementation**:
  ```typescript
  test('should convert HTML to Markdown for LLM consumption', async () => {
    const htmlContent = `
      <h1>Main Title</h1>
      <p>This is a <strong>paragraph</strong> with <em>emphasis</em>.</p>
      <a href="https://example.com">Example Link</a>
      <code>inline code</code>
      <pre><code>code block</code></pre>
    `;
    
    const client = new BrowserRenderingClient(mockEnv.BROWSER);
    const markdown = client.htmlToMarkdown(htmlContent);
    
    expect(markdown).toContain('# Main Title');
    expect(markdown).toContain('**paragraph**');
    expect(markdown).toContain('*emphasis*');
    expect(markdown).toContain('[Example Link](https://example.com)');
    expect(markdown).toContain('`inline code`');
    expect(markdown).toContain('```\ncode block\n```');
  });
  ```

#### BR-002: Session Management and Cleanup Tests

##### TC-BR-002-001: Session Lifecycle Management
- **Test ID**: TC-BR-002-001
- **Description**: Test proper session creation, usage, and cleanup
- **Test Steps**:
  1. Create browser session
  2. Navigate to multiple URLs
  3. Perform content extraction
  4. Test session timeout handling
  5. Verify proper session cleanup
- **Expected Results**:
  - Sessions created without resource leaks
  - Multiple navigation operations work correctly
  - Timeouts handled gracefully
  - Sessions closed properly to free resources
- **Test Implementation**:
  ```typescript
  test('should manage browser sessions with proper cleanup', async () => {
    const client = new BrowserRenderingClient(mockEnv.BROWSER);
    const session = await client.createSession();
    
    try {
      // Test multiple operations in same session
      await session.navigate('https://example.com');
      await session.navigate('https://react.dev');
      
      const content = await session.evaluate(() => {
        return document.title;
      });
      
      expect(content).toBeDefined();
    } finally {
      // Verify cleanup happens even with errors
      await session.close();
    }
    
    // Verify session is properly closed
    expect(session.isClosed()).toBe(true);
  });
  ```

##### TC-BR-002-002: Concurrent Session Handling
- **Test ID**: TC-BR-002-002
- **Description**: Test handling of multiple concurrent browser sessions
- **Test Steps**:
  1. Create multiple browser sessions simultaneously
  2. Navigate to different URLs in parallel
  3. Extract content from all sessions
  4. Test resource management under load
  5. Verify all sessions clean up properly
- **Expected Results**:
  - Multiple sessions work concurrently
  - No resource conflicts or memory leaks
  - All content extracted successfully
  - All sessions closed properly
- **Test Implementation**:
  ```typescript
  test('should handle multiple concurrent sessions', async () => {
    const client = new BrowserRenderingClient(mockEnv.BROWSER);
    const urls = [
      'https://example.com',
      'https://httpbin.org/html',
      'https://react.dev'
    ];
    
    const sessions = await Promise.all(
      urls.map(() => client.createSession())
    );
    
    try {
      const results = await Promise.all(
        sessions.map(async (session, index) => {
          await session.navigate(urls[index]);
          return session.evaluate(() => document.title);
        })
      );
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      });
    } finally {
      await Promise.all(sessions.map(session => session.close()));
    }
  });
  ```

#### BR-003: Performance and Error Handling Tests

##### TC-BR-003-001: Browser Rendering Performance Testing
- **Test ID**: TC-BR-003-001
- **Description**: Test Browser Rendering performance for various content types
- **Test Steps**:
  1. Measure content extraction time for different page sizes
  2. Test timeout handling for slow-loading pages
  3. Measure memory usage during content processing
  4. Test performance with concurrent requests
- **Expected Results**:
  - Content extraction completes within 30 seconds
  - Timeouts handled gracefully without crashes
  - Memory usage remains within acceptable limits
  - Concurrent requests don't degrade performance significantly
- **Test Implementation**:
  ```typescript
  test('should meet performance requirements for content extraction', async () => {
    const client = new BrowserRenderingClient(mockEnv.BROWSER);
    const session = await client.createSession();
    
    const startTime = performance.now();
    
    await session.navigate('https://example.com/large-page', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    const content = await session.evaluate(() => {
      return {
        title: document.title,
        contentLength: document.body.textContent.length,
        loadTime: performance.now()
      };
    });
    
    const totalTime = performance.now() - startTime;
    
    expect(totalTime).toBeLessThan(30000); // 30 second limit
    expect(content.contentLength).toBeGreaterThan(0);
    
    await session.close();
  });
  ```

##### TC-BR-003-002: Error Handling and Recovery
- **Test ID**: TC-BR-003-002
- **Description**: Test error handling for various Browser Rendering failure scenarios
- **Test Steps**:
  1. Test navigation to non-existent URLs (404)
  2. Test network timeout scenarios
  3. Test malformed URL handling
  4. Test server error responses (500)
  5. Verify graceful degradation
- **Expected Results**:
  - 404 errors handled without crashing
  - Network timeouts handled gracefully
  - Invalid URLs rejected with proper errors
  - Server errors logged but don't break application
  - Fallback to cached content when available
- **Test Implementation**:
  ```typescript
  test('should handle Browser Rendering errors gracefully', async () => {
    const client = new BrowserRenderingClient(mockEnv.BROWSER);
    
    // Test 404 handling
    const session404 = await client.createSession();
    try {
      await session404.navigate('https://example.com/nonexistent');
      // Should not throw, but may return empty content
    } catch (error) {
      expect(error.message).toContain('navigation failed');
    } finally {
      await session404.close();
    }
    
    // Test timeout handling
    const sessionTimeout = await client.createSession();
    try {
      await sessionTimeout.navigate('https://httpbin.org/delay/35', {
        timeout: 5000 // Short timeout for testing
      });
      fail('Should have timed out');
    } catch (error) {
      expect(error.message).toContain('timeout');
    } finally {
      await sessionTimeout.close();
    }
  });
  ```

##### TC-BR-003-003: Content Size and Security Validation
- **Test ID**: TC-BR-003-003
- **Description**: Test content size limits and security validations
- **Test Steps**:
  1. Test content size limiting (1MB max as per requirements)
  2. Test URL security validation (no localhost, private IPs)
  3. Test content type restrictions
  4. Test malicious content detection
- **Expected Results**:
  - Content over 1MB is truncated or rejected
  - Unsafe URLs blocked (localhost, private IPs, file://)
  - Only allowed protocols accepted (HTTP/HTTPS)
  - Malicious content patterns detected and handled
- **Test Implementation**:
  ```typescript
  test('should enforce content size and security limits', async () => {
    const client = new BrowserRenderingClient(mockEnv.BROWSER);
    
    // Test URL security validation
    const unsafeUrls = [
      'http://localhost:3000',
      'http://192.168.1.1',
      'file:///etc/passwd',
      'ftp://example.com'
    ];
    
    for (const url of unsafeUrls) {
      expect(() => client.validateURL(url)).toThrow();
    }
    
    // Test content size limiting
    const session = await client.createSession();
    try {
      const result = await client.fetchContent('https://example.com');
      expect(result.size).toBeLessThanOrEqual(1048576); // 1MB limit
    } finally {
      await session.close();
    }
  });
  ```

---

## Core Domain Tests (Updated with Resource Integration)

### Memory Domain Service Tests

#### Test Suite: MemoryService.test.ts
**Coverage Target**: 95%  
**Total Test Cases**: 32 (updated from 28)

#### MD-001: Memory Creation Tests (Enhanced with Browser Rendering)

##### TC-MD-001-001: Create Valid Memory
- **Test ID**: TC-MD-001-001
- **Description**: Create a memory with all valid required fields
- **Preconditions**: Clean database state
- **Test Steps**:
  1. Prepare valid CreateMemoryRequest with name, content
  2. Call createMemory() with valid data
  3. Verify memory is created with generated UUID
  4. Verify timestamps are set correctly
- **Expected Results**:
  - Memory created successfully
  - UUID generated in correct format (v4)
  - created_at and updated_at timestamps are equal
  - Name is unique constraint enforced
- **Test Data**:
  ```typescript
  const validMemory = {
    name: "JavaScript Array Methods",
    content: "map(), filter(), reduce() are essential array methods",
    tags: ["javascript", "arrays"]
  }
  ```

##### TC-MD-001-002: Create Memory with URL and Browser Rendering Integration
- **Test ID**: TC-MD-001-002
- **Description**: Create memory with URL for content fetching using Browser Rendering API
- **Preconditions**: Mock Browser Rendering API available
- **Test Steps**:
  1. Prepare CreateMemoryRequest with valid URL
  2. Mock successful Browser Rendering API response with LLM-optimized content
  3. Call createMemory() 
  4. Verify URL content is fetched and cached using Browser Rendering
  5. Verify content is processed for LLM consumption (Markdown conversion)
- **Expected Results**:
  - Memory created with URL field populated
  - Browser Rendering API called with correct parameters
  - Content extracted using LLM-optimized selectors
  - Content cached in KV store with 5-day TTL
  - Markdown conversion applied for better LLM processing
- **Test Data**:
  ```typescript
  const memoryWithUrl = {
    name: "React Documentation",
    content: "Official React docs reference",
    url: "https://react.dev/learn"
  }
  
  const mockBrowserRenderingResponse = {
    content: "React Hooks useState and useEffect are fundamental...",
    title: "React Documentation - Hooks",
    contentType: "text/html",
    markdown: "# React Documentation\n\n**useState** and **useEffect** are fundamental hooks...",
    extractedText: "React Hooks useState and useEffect are fundamental..."
  };
  ```

##### TC-MD-001-003: Invalid Memory Creation
- **Test ID**: TC-MD-001-003
- **Description**: Reject memory creation with invalid data
- **Test Steps**:
  1. Test empty name field
  2. Test duplicate name
  3. Test content exceeding 1MB limit
  4. Test invalid URL format
  5. Test unsafe URLs (localhost, private IPs)
- **Expected Results**:
  - ValidationError thrown for each invalid case
  - No database records created
  - Error messages are descriptive
  - URL security validation prevents unsafe URLs

##### TC-MD-001-004: Memory Creation with MCP Tool Integration
- **Test ID**: TC-MD-001-004
- **Description**: Create memory via MCP add_memory tool with full integration
- **Test Steps**:
  1. Call add_memory MCP tool with valid parameters
  2. Verify MCP request validation using SDK schemas
  3. Test URL content fetching via Browser Rendering
  4. Verify response format matches MCP specifications
- **Expected Results**:
  - Memory created via MCP tool successfully
  - URL content fetched and cached
  - Response includes memory ID and cached URL content
  - MCP response format compliant with SDK specifications

#### MD-002: Memory Retrieval Tests (Enhanced)

##### TC-MD-002-001: Get Memory by Valid ID with URL Content
- **Test ID**: TC-MD-002-001
- **Description**: Retrieve existing memory by UUID with cached URL content
- **Preconditions**: Memory exists in database with cached URL content
- **Test Steps**:
  1. Create test memory with URL
  2. Call getMemoryById() with valid UUID
  3. Test include_url_content parameter
  4. Verify complete memory object returned with URL content
- **Expected Results**:
  - Memory object with all fields populated
  - Tags array properly populated
  - Timestamps preserved
  - URL content included when requested
  - Cache hit/miss tracking works correctly

##### TC-MD-002-002: Get Non-existent Memory
- **Test ID**: TC-MD-002-002
- **Description**: Handle retrieval of non-existent memory
- **Test Steps**:
  1. Call getMemoryById() with non-existent UUID
  2. Verify null returned (not error)
- **Expected Results**: Returns null without throwing error

##### TC-MD-002-003: Get Memory by Name
- **Test ID**: TC-MD-002-003
- **Description**: Retrieve memory using unique name
- **Test Steps**:
  1. Create memory with unique name
  2. Call getMemoryByName() with exact name
  3. Verify correct memory returned
- **Expected Results**: Memory retrieved successfully

#### MD-003: Memory Update Tests (Enhanced)

##### TC-MD-003-001: Update Memory Content
- **Test ID**: TC-MD-003-001
- **Description**: Update existing memory content and metadata
- **Test Steps**:
  1. Create initial memory
  2. Prepare UpdateMemoryRequest with new content
  3. Call updateMemory()
  4. Verify updated_at timestamp changed
- **Expected Results**:
  - Content updated successfully
  - updated_at timestamp incremented
  - created_at timestamp unchanged

##### TC-MD-003-002: Update Memory URL with Browser Rendering Refresh
- **Test ID**: TC-MD-003-002
- **Description**: Update memory URL and trigger content refresh via Browser Rendering
- **Test Steps**:
  1. Create memory with initial URL
  2. Update with new URL
  3. Verify new URL content fetched via Browser Rendering API
  4. Verify old cache invalidated
- **Expected Results**:
  - New URL content fetched using Browser Rendering
  - Content processed with LLM-optimized extraction
  - New content cached with 5-day TTL
  - Old cache entry removed

#### MD-004: Memory Deletion Tests

##### TC-MD-004-001: Delete Existing Memory
- **Test ID**: TC-MD-004-001
- **Description**: Delete memory and all associated data
- **Test Steps**:
  1. Create memory with tags
  2. Call deleteMemory() with memory ID
  3. Verify memory removed from database
  4. Verify tags relationships removed
  5. Verify FTS index updated
- **Expected Results**:
  - Memory completely removed
  - Tag relationships cascade deleted
  - FTS index updated

##### TC-MD-004-002: Delete Non-existent Memory
- **Test ID**: TC-MD-004-002
- **Description**: Handle deletion of non-existent memory
- **Test Steps**:
  1. Call deleteMemory() with non-existent ID
  2. Verify appropriate response
- **Expected Results**: Returns false without error

---

## URL Content Service Tests (Enhanced with Browser Rendering)

### URL Content Fetching Tests

#### Test Suite: URLContentService.test.ts
**Coverage Target**: 90% (increased from 88%)  
**Total Test Cases**: 38 (increased from 24)

#### URL-001: Browser Rendering Content Fetching Tests

##### TC-URL-001-001: Successful URL Fetch with LLM Optimization
- **Test ID**: TC-URL-001-001
- **Description**: Test successful URL content fetching using Browser Rendering with LLM optimization
- **Test Steps**:
  1. Mock Browser Rendering API success response
  2. Call fetchURLContent() with valid URL
  3. Verify content extracted using LLM-optimized selectors
  4. Verify HTML to Markdown conversion applied
  5. Verify content cached in KV with 5-day TTL
- **Expected Results**:
  - Content fetched successfully using Browser Rendering API
  - Main content areas detected correctly
  - HTML converted to Markdown for LLM consumption
  - Content cached with proper TTL (5 days = 432,000 seconds)
  - Session properly closed after extraction

##### TC-URL-001-002: Content Area Detection Priority
- **Test ID**: TC-URL-001-002
- **Description**: Test priority-based content area detection
- **Test Steps**:
  1. Mock HTML with various content selectors
  2. Test priority order: article > main > [role="main"] > .content
  3. Verify fallback to body content when no main content found
  4. Test content length threshold (>100 characters)
- **Expected Results**:
  - Higher priority selectors preferred
  - Content with sufficient length selected
  - Fallback mechanism works correctly
  - Script and style tags removed

##### TC-URL-001-003: HTML to Markdown Conversion
- **Test ID**: TC-URL-001-003
- **Description**: Test HTML to Markdown conversion for LLM consumption
- **Test Steps**:
  1. Test header conversion (h1-h6 to #)
  2. Test paragraph and formatting preservation
  3. Test link extraction and formatting
  4. Test code block preservation
  5. Test excessive whitespace cleanup
- **Expected Results**:
  - Headers converted to proper Markdown syntax
  - Strong/em tags converted to **bold** and *italic*
  - Links formatted as [text](url)
  - Code blocks properly formatted with ```
  - Clean, readable Markdown output

##### TC-URL-001-004: Session Management and Cleanup
- **Test ID**: TC-URL-001-004
- **Description**: Test proper Browser Rendering session management
- **Test Steps**:
  1. Verify session creation before content fetching
  2. Test navigation with LLM-optimized settings
  3. Verify session cleanup after content extraction
  4. Test error handling with session cleanup
- **Expected Results**:
  - Sessions created and closed properly
  - No resource leaks or hanging sessions
  - Error scenarios still clean up sessions
  - Timeout handling works correctly

##### TC-URL-001-005: URL Security Validation
- **Test ID**: TC-URL-001-005
- **Description**: Test URL security validation before Browser Rendering
- **Test Steps**:
  1. Test blocked protocols: file://, localhost, private IPs
  2. Test allowed protocols: HTTP, HTTPS
  3. Test malformed URL handling
  4. Verify security errors are logged
- **Expected Results**:
  - Unsafe URLs rejected before Browser Rendering call
  - Only HTTP/HTTPS protocols allowed
  - Clear security error messages
  - No Browser Rendering resources wasted on unsafe URLs

#### URL-002: Cache Management Tests (Enhanced)

##### TC-URL-002-001: Cache Hit Scenario with 5-Day TTL
- **Test ID**: TC-URL-002-001
- **Description**: Test cache hit behavior with 5-day TTL requirement
- **Test Steps**:
  1. Fetch URL content (populates cache with 5-day TTL)
  2. Fetch same URL again within TTL period
  3. Verify cache hit detected
  4. Verify no duplicate Browser Rendering API call
  5. Verify TTL calculation correct (432,000 seconds)
- **Expected Results**:
  - Cache hit returns cached content
  - No additional Browser Rendering API calls made
  - TTL set to exactly 5 days (432,000 seconds)
  - Cache metadata includes expiration timestamp

##### TC-URL-002-002: Cache Miss and Browser Rendering Refresh
- **Test ID**: TC-URL-002-002
- **Description**: Test cache miss and refresh via Browser Rendering
- **Test Steps**:
  1. Clear cache for URL
  2. Fetch URL content
  3. Verify fresh fetch triggered via Browser Rendering API
  4. Verify cache populated with new content and 5-day TTL
- **Expected Results**:
  - Fresh content fetched using Browser Rendering
  - Cache updated with new content
  - New TTL set to 5 days from current time
  - Content processed with LLM optimization

##### TC-URL-002-003: Cache Expiration and Auto-Refresh
- **Test ID**: TC-URL-002-003
- **Description**: Test cache TTL expiration handling
- **Test Steps**:
  1. Cache URL content with expired TTL (simulate time passage)
  2. Fetch URL again
  3. Verify fresh fetch triggered
  4. Verify new cache entry with fresh TTL
- **Expected Results**: Expired cache triggers Browser Rendering refresh

##### TC-URL-002-004: Force Refresh Bypass Cache
- **Test ID**: TC-URL-002-004
- **Description**: Test force refresh functionality bypassing cache
- **Test Steps**:
  1. Cache URL content
  2. Call updateURLContent with force_refresh=true
  3. Verify cache bypassed
  4. Verify Browser Rendering API called despite valid cache
- **Expected Results**:
  - Cache bypassed when force_refresh=true
  - Fresh content fetched via Browser Rendering
  - Cache updated with new content and TTL

---

## Test Data Management (Enhanced)

### Test Data Factory (Updated)

```typescript
class TestDataFactory {
  // Backend data generation with Browser Rendering support
  static createValidMemory(): CreateMemoryRequest {
    return {
      name: `Test Memory ${Date.now()}`,
      content: "Test content for memory",
      tags: ["test", "unit-test"]
    };
  }

  static createMemoryWithURL(): CreateMemoryRequest {
    return {
      ...this.createValidMemory(),
      url: "https://example.com/test-page"
    };
  }

  static createMemoryWithLLMOptimizedURL(): CreateMemoryRequest {
    return {
      ...this.createValidMemory(),
      url: "https://react.dev/learn/hooks"
    };
  }

  static createMultipleMemories(count: number): CreateMemoryRequest[] {
    return Array.from({ length: count }, (_, i) => ({
      name: `Test Memory ${i}`,
      content: `Test content ${i}`,
      tags: [`tag${i % 3}`, "common-tag"]
    }));
  }

  // Mock Browser Rendering responses
  static createMockBrowserRenderingResponse(): BrowserRenderingResponse {
    return {
      content: "Main content extracted from webpage",
      title: "Test Page Title",
      contentType: "text/html",
      size: 1024,
      markdown: "# Test Page Title\n\nMain content extracted from webpage",
      extractedText: "Main content extracted from webpage"
    };
  }

  // Mock MCP Inspector responses
  static createMockMCPToolResponse(toolName: string): MCPToolResponse {
    return {
      id: generateUUID(),
      result: {
        success: true,
        data: `Mock response for ${toolName}`,
        timestamp: Date.now()
      }
    };
  }
}
```

### Mock Services (Enhanced)

```typescript
class MockServices {
  static createMockD1Database(): D1Database {
    // In-memory SQLite database for testing
  }

  static createMockKVNamespace(): KVNamespace {
    // In-memory KV store implementation with TTL support
  }

  static createMockBrowserRenderingClient(): BrowserRenderingClient {
    return {
      createSession: vi.fn().mockResolvedValue({
        navigate: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue({
          content: "Mock extracted content",
          title: "Mock Title"
        }),
        close: vi.fn().mockResolvedValue(undefined)
      }),
      fetchContent: vi.fn().mockResolvedValue({
        content: "Mock webpage content",
        title: "Mock Page Title",
        contentType: "text/html",
        size: 1024,
        markdown: "# Mock Page Title\n\nMock webpage content",
        extractedText: "Mock webpage content"
      }),
      htmlToMarkdown: vi.fn().mockImplementation((html) => {
        // Simple mock conversion
        return html.replace(/<[^>]*>/g, '');
      })
    };
  }

  static createMockMCPInspector(): MCPInspector {
    return {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue([
        { name: 'add_memory', description: 'Create memory' },
        { name: 'get_memory', description: 'Retrieve memory' },
        // ... other tools
      ]),
      listResources: vi.fn().mockResolvedValue([
        { uri: 'memory://*', name: 'Memory Resources' }
      ]),
      callTool: vi.fn().mockResolvedValue({
        id: generateUUID(),
        success: true
      })
    };
  }
}
```

---

## Coverage Requirements (Updated)

### Minimum Coverage Targets
- **Overall Backend Coverage**: 85%
- **Core Domain Services**: 95%
- **MCP Tools**: 95% (increased due to MCP SDK integration)
- **Browser Rendering Integration**: 90%
- **Database Layer**: 95%
- **API Handlers**: 85%
- **Utility Functions**: 90%

### Resource-Specific Coverage Requirements
- **MCP SDK Integration**: 95% - Critical for AI agent functionality
- **Browser Rendering Integration**: 90% - Essential for URL content processing
- **MCP Inspector Integration**: 85% - Important for development workflow

### Coverage Exclusions
- Type definitions and interfaces
- Configuration files
- Mock implementations
- Development-only code
- MCP Inspector UI components (external dependency)

---

## Test Execution Strategy (Enhanced)

### Test Categories
1. **Unit Tests**: Fast, isolated component tests
2. **MCP Integration Tests**: MCP SDK and Inspector integration
3. **Browser Rendering Tests**: URL content fetching and processing
4. **Performance Tests**: Response time and load tests
5. **Security Tests**: Vulnerability and attack prevention tests

### Test Execution Order
1. Domain model and utility tests
2. Database and repository tests
3. MCP SDK integration tests
4. Browser Rendering integration tests
5. Service layer tests
6. MCP tool tests with Inspector validation
7. API integration tests
8. Performance and security tests

### Resource Integration Testing Pipeline
```yaml
resourceIntegrationTesting:
  mcpSdkTests:
    - server initialization with TypeScript SDK
    - tool registration validation
    - resource registration validation
    - HTTP streamable transport testing
    
  mcpInspectorTests:
    - local inspector setup
    - tool discovery and execution
    - resource discovery validation
    - workflow testing via inspector
    
  browserRenderingTests:
    - LLM-optimized content extraction
    - session management and cleanup
    - HTML to Markdown conversion
    - performance and error handling
```

### Continuous Integration (Enhanced)
- Run unit tests on every commit
- Run MCP SDK integration tests on pull requests
- Run Browser Rendering integration tests on pull requests
- Run MCP Inspector tests nightly (due to external dependency)
- Run performance tests nightly
- Run security tests weekly

This comprehensive test specification ensures the Memory Server backend meets all requirements with high reliability, performance, and security standards while properly integrating the three key resources: MCP Server TypeScript SDK, MCP Inspector, and Cloudflare Browser Rendering for LLMs.