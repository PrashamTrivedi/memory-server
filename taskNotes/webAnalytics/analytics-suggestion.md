# Web Analytics Tracking Points

## Workers Analytics Engine (Backend)

### Memory API Endpoints
- **POST /api/memories** - Track memory creation
  - Blobs: operation_type, has_url, tag_count, content_length_bucket
  - Doubles: processing_time_ms, content_size_bytes
  - Index: user_session_id

- **GET /api/memories** - Track memory list requests
  - Blobs: pagination_params, has_filters
  - Doubles: result_count, query_time_ms
  - Index: user_session_id

- **GET /api/memories/{id}** - Track memory retrieval
  - Blobs: memory_id, has_url, response_format
  - Doubles: fetch_time_ms
  - Index: user_session_id

- **PUT /api/memories/{id}** - Track memory updates
  - Blobs: updated_fields, tag_changes
  - Doubles: processing_time_ms
  - Index: user_session_id

- **DELETE /api/memories/{id}** - Track memory deletion
  - Blobs: memory_id, had_tags
  - Doubles: deletion_time_ms
  - Index: user_session_id

- **GET /api/memories/search** - Track search operations
  - Blobs: search_type, has_tags_filter, query_length_bucket
  - Doubles: result_count, search_time_ms
  - Index: user_session_id

- **GET /api/memories/stats** - Track stats requests
  - Blobs: request_source
  - Doubles: response_time_ms
  - Index: user_session_id

### Tag Hierarchy API Endpoints
- **POST /api/tags/create-with-parent** - Track hierarchical tag creation
  - Blobs: creation_scenario, hierarchy_depth
  - Doubles: processing_time_ms
  - Index: user_session_id

- **POST /api/tags/{id}/parent** - Track parent relationship additions
  - Blobs: tag_id, parent_id
  - Doubles: processing_time_ms
  - Index: user_session_id

- **DELETE /api/tags/{id}/parent/{parentId}** - Track relationship removals
  - Blobs: tag_id, parent_id
  - Doubles: processing_time_ms
  - Index: user_session_id

- **GET /api/tags/{id}/ancestors** - Track ancestor queries
  - Blobs: tag_id
  - Doubles: ancestor_count, query_time_ms
  - Index: user_session_id

- **GET /api/tags/{id}/descendants** - Track descendant queries
  - Blobs: tag_id
  - Doubles: descendant_count, query_time_ms
  - Index: user_session_id

- **GET /api/tags/tree** - Track full tree requests
  - Blobs: tree_depth_category
  - Doubles: total_tags, processing_time_ms
  - Index: user_session_id

### MCP Server Endpoints
- **POST /mcp** - Track MCP tool invocations
  - Blobs: tool_name, response_format, success_status
  - Doubles: processing_time_ms, response_size_bytes
  - Index: mcp_session_id

- **GET /mcp/health** - Track health checks
  - Blobs: status
  - Doubles: response_time_ms
  - Index: monitoring_source

### MCP Tools (src/mcp/tools/)
- **add_memory** - Track memory additions via MCP
  - Blobs: has_url, tag_count, source
  - Doubles: processing_time_ms, content_length
  - Index: mcp_session_id

- **get_memory** - Track memory retrieval via MCP
  - Blobs: memory_id, format_type
  - Doubles: fetch_time_ms
  - Index: mcp_session_id

- **list_memories** - Track memory listing via MCP
  - Blobs: has_pagination, filter_applied
  - Doubles: result_count, query_time_ms
  - Index: mcp_session_id

- **delete_memory** - Track deletion via MCP
  - Blobs: memory_id
  - Doubles: deletion_time_ms
  - Index: mcp_session_id

- **find_memories** - Track search via MCP
  - Blobs: search_type, has_tags
  - Doubles: result_count, search_time_ms
  - Index: mcp_session_id

- **update_url_content** - Track URL content refresh
  - Blobs: update_scope, stale_content_found
  - Doubles: urls_updated, total_time_ms
  - Index: mcp_session_id

- **add_tags** - Track tag additions via MCP
  - Blobs: memory_id, tag_count
  - Doubles: processing_time_ms
  - Index: mcp_session_id

### MCP Workflows (src/mcp/prompts/workflows.ts)
- **memory_capture_workflow** - Track workflow execution
  - Blobs: workflow_name, completion_status
  - Doubles: execution_time_ms, steps_completed
  - Index: mcp_session_id

- **knowledge_discovery_workflow** - Track workflow execution
  - Blobs: workflow_name, search_depth
  - Doubles: memories_found, execution_time_ms
  - Index: mcp_session_id

- **content_maintenance_workflow** - Track workflow execution
  - Blobs: maintenance_type, scope
  - Doubles: items_processed, execution_time_ms
  - Index: mcp_session_id

- **research_session_workflow** - Track workflow execution
  - Blobs: workflow_name, research_topic
  - Doubles: memories_created, execution_time_ms
  - Index: mcp_session_id

### URL Content Fetching (src/handlers/memory.ts)
- **URL Fetch Operation** - Track external URL fetches
  - Blobs: url_domain, fetch_status, content_type
  - Doubles: fetch_time_ms, content_size_bytes
  - Index: user_session_id

- **URL Fetch Failure** - Track fetch failures
  - Blobs: url_domain, error_type, status_code
  - Doubles: retry_count
  - Index: user_session_id

### Database Operations
- **D1 Query Execution** - Track database queries
  - Blobs: query_type, table_name, operation
  - Doubles: execution_time_ms, rows_affected
  - Index: query_batch_id

- **Full-Text Search** - Track FTS operations
  - Blobs: search_terms_count, has_results
  - Doubles: search_time_ms, result_count
  - Index: user_session_id

### Error Tracking
- **API Errors** - Track all error responses
  - Blobs: endpoint, error_type, status_code
  - Doubles: error_count
  - Index: user_session_id

- **Database Errors** - Track database failures
  - Blobs: error_type, constraint_violation, table
  - Doubles: retry_count
  - Index: error_batch_id

- **MCP Errors** - Track MCP operation failures
  - Blobs: tool_name, error_type, error_category
  - Doubles: error_count
  - Index: mcp_session_id

### Response Format Tracking (src/utils/responseFormatter.ts)
- **Content Negotiation** - Track response format selection
  - Blobs: requested_format, served_format, endpoint
  - Doubles: serialization_time_ms
  - Index: user_session_id

## Web Analytics (Frontend)

### Page Views
- **Home Page** (/) - Auto-tracked by beacon
- **Memory Management Page** (/memories) - Auto-tracked by beacon
- **Tag Management Page** (/tags) - Auto-tracked by beacon
- **Memory Detail View** - Track route changes

### User Interactions
- **Memory Creation** (MemoryForm.tsx) - Track form submission
  - Custom event: memory_create_initiated
  - Properties: has_url, tag_count

- **Memory Edit** (MemoryDetail.tsx) - Track edit action
  - Custom event: memory_edit_started
  - Properties: memory_id

- **Memory Delete** (MemoryDetail.tsx) - Track deletion
  - Custom event: memory_deleted
  - Properties: memory_id

- **Search Usage** (SearchBar.tsx) - Track search interactions
  - Custom event: search_performed
  - Properties: query_length, has_results

- **Tag Selection** (TagSelector.tsx) - Track tag interactions
  - Custom event: tag_selected
  - Properties: tag_id, selection_method

- **Tag Tree Interaction** (TagTree.tsx) - Track tree navigation
  - Custom event: tag_tree_expanded
  - Properties: node_id, depth_level

- **Tag Relationship Creation** (CreateTagForm.tsx) - Track relationship creation
  - Custom event: tag_relationship_created
  - Properties: relationship_type

- **Theme Toggle** (ThemeContext.tsx) - Track theme changes
  - Custom event: theme_changed
  - Properties: new_theme

- **View Switching** (App.tsx) - Track navigation
  - Custom event: view_changed
  - Properties: from_view, to_view

### Performance Metrics
- **API Response Time** - Track frontend API call duration
  - Custom metric: api_response_time
  - Tag with: endpoint, method

- **Infinite Scroll Loading** (MemoryManagement.tsx) - Track pagination
  - Custom event: pagination_triggered
  - Properties: page_number, items_loaded

- **Component Load Time** - Track major component renders
  - Custom metric: component_render_time
  - Tag with: component_name

### Error Events
- **API Call Failures** - Track failed requests
  - Custom event: api_error
  - Properties: endpoint, status_code, error_message

- **Form Validation Errors** - Track validation failures
  - Custom event: validation_error
  - Properties: form_type, field_name

## Session Analytics

### Backend Session Tracking
- **Session Start** - Track new user sessions
  - Blobs: session_source, referrer
  - Doubles: timestamp
  - Index: user_session_id

- **Session Duration** - Track session end
  - Blobs: session_id
  - Doubles: duration_seconds, actions_count
  - Index: user_session_id

### MCP Session Tracking
- **MCP Connection** - Track MCP client connections
  - Blobs: client_type, protocol_version
  - Doubles: connection_duration_ms
  - Index: mcp_session_id

- **MCP Disconnection** - Track disconnections
  - Blobs: disconnect_reason, mcp_session_id
  - Doubles: session_duration_seconds, total_operations
  - Index: mcp_session_id

## Usage Analytics

### Feature Usage
- **Tag Hierarchy Depth** - Track hierarchy complexity
  - Blobs: tag_id
  - Doubles: max_depth, total_descendants
  - Index: analytics_batch_id

- **Memory Tags Distribution** - Track tagging patterns
  - Blobs: memory_id
  - Doubles: tag_count
  - Index: analytics_batch_id

- **URL vs Non-URL Memories** - Track content types
  - Blobs: has_url, content_source
  - Doubles: count
  - Index: analytics_batch_id

### Daily Aggregates
- **Daily Active Operations** - Track daily activity
  - Blobs: operation_type, date
  - Doubles: operation_count
  - Index: daily_batch_id

- **Daily Search Volume** - Track search activity
  - Blobs: date, search_type
  - Doubles: search_count, avg_results
  - Index: daily_batch_id

## Implementation Points

### Backend (src/index.ts)
- Add Analytics Engine binding in wrangler.jsonc
- Add middleware for automatic request/response tracking
- Add error handling middleware with analytics

### Backend Handlers (src/handlers/)
- Add writeDataPoint calls at start and end of each handler function
- Track both successful and failed operations
- Include timing measurements

### MCP Server (src/mcp/server.ts)
- Add analytics for tool invocations in tool execution wrapper
- Track workflow executions with step-by-step metrics
- Monitor resource access patterns

### Frontend (ui/src/App.tsx)
- Add Cloudflare Web Analytics beacon script in index.html
- Configure SPA mode for route tracking
- Add custom event tracking wrapper functions

### Frontend API Hooks (ui/src/api/)
- Add analytics tracking in React Query mutation callbacks
- Track API call performance metrics
- Monitor error rates

### Frontend Components
- Add event tracking in user interaction handlers
- Track component-specific actions
- Monitor user engagement metrics
