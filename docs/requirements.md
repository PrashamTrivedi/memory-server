# Purpose

This is a developer memory server hosted on cloudflare. This is going to be used to store long term development notes, and useful information. This is exposed as HTTP Streamable MCP Server so that it can be used by LLM agents.

## Requirements

- This is a personal development server, so it should not use any login.
- The server should be hosted on Cloudflare.
- Tech stack:
    - Hono for the HTTP server.
    - SQLite for the database. D1 is preferred.
    - Cloudflare KV to cache URLs for 5 days.
    - React Page to manage the UI, only for adding and managing memories.

- Data requirements
    - Memory:
        - Identifiable name: Unique identifier for the memory.
        - Content
        - (Optional) URL: A link to a related resource.
        - Tags: A list of tags for categorization.
        - Created at: Timestamp of when the memory was created.
        - Updated at: Timestamp of when the memory was last updated.
        - ID: Unique identifier for the memory (UUID).


- MCP Specification

    - Tools:
        - `add_memory`: Add a new memory to the server. Have a 
        - `get_memory`: Retrieve a memory by its ID.
        - `list_memories`: List all memories with pagination.
        - `delete_memory`: Delete a memory by its ID.
        - `add_tags`: Add tags to a memory.
        - `find_memories`: Find memories by tags or content.
        - `update_url_content`: Update the content of a memory by its URL.

    - Flow: 
        - When the memory has the URL. Use cloudflare browser to fetch the content of the URL and store it in the KV.
        - When the memory is accessed and has the URL, and there is a cache miss, fetch the content from the URL and store it in the KV before returning it.
        - Use both the data and cache to respond to the requests.
        - find_memories should use FTS for searching the memories by tags or content.

    - MCP Resources:
        - Memory: Represents a memory with its content, tags, and metadata.

