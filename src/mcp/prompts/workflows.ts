// Prompt type definition
interface Prompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

/**
 * Workflow Prompt: Memory Capture
 * A comprehensive workflow for capturing and organizing web content
 */
export const memoryCaptureWorkflow: Prompt = {
  name: 'memory_capture_workflow',
  description: 'Complete workflow for capturing web content: URL analysis → content fetch → intelligent tagging → storage',
  arguments: [
    {
      name: 'url',
      description: 'URL to capture and analyze',
      required: true
    },
    {
      name: 'custom_title',
      description: 'Optional custom title for the memory (if not provided, will be extracted from content)',
      required: false
    },
    {
      name: 'additional_context',
      description: 'Additional context or notes about why this content is being saved',
      required: false
    },
    {
      name: 'suggested_tags',
      description: 'Comma-separated list of suggested tags (will be combined with auto-generated tags)',
      required: false
    }
  ]
};

export function generateMemoryCaptureWorkflowPrompt(args: Record<string, any>): string {
  const { url, custom_title, additional_context, suggested_tags } = args;

  return `# Memory Capture Workflow

You are helping to capture and organize web content into a structured memory system. Follow this workflow:

## 1. URL Analysis & Content Extraction
- URL to process: ${url}
- Use the \`add_memory\` tool to fetch and store the content
${custom_title ? `- Use custom title: "${custom_title}"` : '- Extract an appropriate title from the content'}

## 2. Content Analysis
After fetching the content, analyze it to:
- Identify the main topic and key concepts
- Determine the content type (article, tutorial, documentation, etc.)
- Extract key entities, technologies, or subjects mentioned
${additional_context ? `- Consider this additional context: "${additional_context}"` : ''}

## 3. Intelligent Tagging
Generate relevant tags based on:
- Content analysis results
- URL domain and structure
- Main topics and subtopics
- Content type and format
${suggested_tags ? `- Include these suggested tags: ${suggested_tags}` : ''}

## 4. Memory Storage
Use the tools in this sequence:
1. \`add_memory\` - Create the memory with URL, title, and initial content
2. \`add_tags\` - Add the generated tags to organize the memory
3. \`get_memory\` - Verify the memory was created successfully

## 5. Verification & Summary
After completion, provide:
- Memory ID and title
- List of assigned tags
- Brief summary of captured content
- Suggestions for related memories that might be useful

Execute this workflow step by step using the available MCP tools.`;
}

/**
 * Workflow Prompt: Knowledge Discovery
 * Multi-step workflow for discovering and aggregating related information
 */
export const knowledgeDiscoveryWorkflow: Prompt = {
  name: 'knowledge_discovery_workflow',
  description: 'Intelligent knowledge discovery: query expansion → multi-source search → result aggregation → insights',
  arguments: [
    {
      name: 'initial_query',
      description: 'Starting query or topic to explore',
      required: true
    },
    {
      name: 'search_depth',
      description: 'Search depth level (shallow, medium, deep)',
      required: false
    },
    {
      name: 'focus_areas',
      description: 'Specific areas to focus on (comma-separated)',
      required: false
    },
    {
      name: 'exclude_tags',
      description: 'Tags to exclude from results (comma-separated)',
      required: false
    }
  ]
};

export function generateKnowledgeDiscoveryWorkflowPrompt(args: Record<string, any>): string {
  const { initial_query, search_depth = 'medium', focus_areas, exclude_tags } = args;

  return `# Knowledge Discovery Workflow

You are conducting intelligent knowledge discovery to find and aggregate related information. Follow this systematic approach:

## 1. Query Analysis & Expansion
- Initial query: "${initial_query}"
- Search depth: ${search_depth}
${focus_areas ? `- Focus areas: ${focus_areas}` : ''}
${exclude_tags ? `- Exclude content tagged with: ${exclude_tags}` : ''}

Expand the query by:
- Identifying synonyms and related terms
- Breaking down complex queries into components
- Generating variations for comprehensive search

## 2. Multi-Source Search Strategy
Execute searches in this order:

### Phase 1: Direct Search
- Use \`find_memories\` with the original query
- Analyze initial results for relevant patterns

### Phase 2: Expanded Search
- Search for related terms and concepts identified
- Use \`find_memories\` with expanded query variations
- Search by relevant tags discovered in Phase 1

### Phase 3: Deep Discovery
${search_depth === 'deep' ? `- Perform additional searches on related topics found
- Explore tag hierarchies and connections
- Look for cross-references and related content` : `- Skip deep discovery for ${search_depth} search depth`}

## 3. Result Analysis & Filtering
For each search result:
- Assess relevance to the original query
- Identify key themes and patterns
- Note important tags and categorizations
- Extract key insights and connections

## 4. Knowledge Aggregation
Combine results to:
- Create a comprehensive overview
- Identify knowledge gaps
- Highlight key relationships
- Suggest areas for further exploration

## 5. Insight Generation
Provide:
- Summary of discovered knowledge
- Key themes and patterns found
- Recommended memories for deeper study
- Suggestions for new content to capture
- Tags that could improve future searches

Use the \`find_memories\`, \`get_memory\`, and \`list_memories\` tools systematically to execute this workflow.`;
}

/**
 * Workflow Prompt: Content Maintenance
 * Workflow for maintaining and refreshing memory content
 */
export const contentMaintenanceWorkflow: Prompt = {
  name: 'content_maintenance_workflow',
  description: 'Content maintenance workflow: stale detection → batch refresh → change analysis → notifications',
  arguments: [
    {
      name: 'maintenance_type',
      description: 'Type of maintenance (refresh_all, check_stale, update_specific)',
      required: true
    },
    {
      name: 'max_age_days',
      description: 'Maximum age in days for content to be considered fresh (default: 30)',
      required: false
    },
    {
      name: 'specific_tags',
      description: 'Only maintain memories with these tags (comma-separated)',
      required: false
    },
    {
      name: 'specific_memory_id',
      description: 'Specific memory ID to update (for update_specific type)',
      required: false
    }
  ]
};

export function generateContentMaintenanceWorkflowPrompt(args: Record<string, any>): string {
  const { maintenance_type, max_age_days = 30, specific_tags, specific_memory_id } = args;

  return `# Content Maintenance Workflow

You are performing content maintenance to keep the memory system up-to-date. Execute the appropriate maintenance workflow:

## Maintenance Type: ${maintenance_type}

${maintenance_type === 'refresh_all' ? `
### Refresh All Content Workflow
1. **Discovery Phase**
   - Use \`list_memories\` to get all memories with URLs
   - Filter memories that have URLs to refresh

2. **Refresh Phase**
   - For each memory with URL:
     - Use \`update_url_content\` with force=true
     - Check for successful updates
     - Note any failures or changes

3. **Analysis Phase**
   - Compare old vs new content
   - Identify significant changes
   - Update tags if content has shifted focus

4. **Reporting Phase**
   - List successfully updated memories
   - Report failed updates and reasons
   - Suggest manual review for significant changes
` : ''}

${maintenance_type === 'check_stale' ? `
### Stale Content Detection Workflow
1. **Age Analysis**
   - Use \`list_memories\` to get all memories
   - Calculate age of each memory (current time - updated_at)
   - Identify memories older than ${max_age_days} days

2. **URL Content Check**
   - For stale memories with URLs:
     - Use \`get_memory\` to check current content
     - Note which ones need URL content refresh

3. **Prioritization**
   - Rank memories by importance (tags, access patterns)
   - Identify critical content that should be updated first

4. **Recommendations**
   - List memories that should be refreshed
   - Suggest batch update strategies
   - Identify memories that might be archived
` : ''}

${maintenance_type === 'update_specific' ? `
### Specific Content Update Workflow
${specific_memory_id ? `- Target memory ID: ${specific_memory_id}` : ''}
${specific_tags ? `- Target memories with tags: ${specific_tags}` : ''}

1. **Target Identification**
   ${specific_memory_id ? `- Use \`get_memory\` for the specific memory` : ''}
   ${specific_tags ? `- Use \`find_memories\` with tags: ${specific_tags}` : ''}

2. **Content Update**
   - For each target memory:
     - Check if it has a URL to refresh
     - Use \`update_url_content\` if applicable
     - Verify successful update with \`get_memory\`

3. **Change Analysis**
   - Compare before and after content
   - Note significant changes or additions
   - Update tags if content focus has changed

4. **Verification**
   - Confirm all updates completed successfully
   - Test that refreshed content is accessible
   - Update memory metadata if needed
` : ''}

## General Guidelines
- Always use \`get_memory\` to verify current state before updates
- Use \`update_url_content\` with appropriate force flag
- Handle errors gracefully and report issues
- Provide detailed summary of all maintenance actions

Execute the workflow systematically using the available MCP tools.`;
}

/**
 * Workflow Prompt: Research Session
 * Guided workflow for comprehensive research sessions
 */
export const researchSessionWorkflow: Prompt = {
  name: 'research_session_workflow',
  description: 'Complete research session workflow: topic setup → systematic exploration → knowledge synthesis',
  arguments: [
    {
      name: 'research_topic',
      description: 'Main research topic or question',
      required: true
    },
    {
      name: 'research_goals',
      description: 'Specific goals or questions to answer',
      required: false
    },
    {
      name: 'prior_knowledge_tags',
      description: 'Tags representing prior knowledge or related memories (comma-separated)',
      required: false
    },
    {
      name: 'session_duration',
      description: 'Expected session duration (short, medium, long)',
      required: false
    }
  ]
};

export function generateResearchSessionWorkflowPrompt(args: Record<string, any>): string {
  const { research_topic, research_goals, prior_knowledge_tags, session_duration = 'medium' } = args;

  return `# Research Session Workflow

You are conducting a systematic research session. Follow this structured approach:

## Research Topic: "${research_topic}"
${research_goals ? `## Research Goals:\n${research_goals}` : ''}
${prior_knowledge_tags ? `## Prior Knowledge Tags: ${prior_knowledge_tags}` : ''}
## Session Duration: ${session_duration}

## 1. Foundation Building
${prior_knowledge_tags ? `
- Use \`find_memories\` with prior knowledge tags: ${prior_knowledge_tags}
- Review existing knowledge to identify gaps
- Create baseline understanding` : `
- Use \`find_memories\` to search for existing knowledge about "${research_topic}"
- Assess current knowledge state`}

## 2. Knowledge Gap Analysis
- Identify what information is missing
- Determine priority areas for new research
- Plan information gathering strategy

## 3. Systematic Exploration
### Phase A: Core Concepts
- Search for fundamental concepts related to the topic
- Use \`find_memories\` with core topic terms
- Build conceptual foundation

### Phase B: Related Areas
- Expand search to related and adjacent topics
- Use \`find_memories\` with broader search terms
- Identify connections and relationships

### Phase C: Deep Dive
${session_duration === 'long' ? `- Conduct detailed exploration of specific areas
- Use \`get_memory\` to study relevant memories in depth
- Look for advanced or specialized information` : `- Brief exploration of key specific areas (due to ${session_duration} session)`}

## 4. Information Integration
- Synthesize findings from all search phases
- Identify key insights and patterns
- Note areas requiring additional research

## 5. Knowledge Capture Planning
Based on research gaps identified:
- Suggest URLs or sources to capture with \`add_memory\`
- Recommend tags for organizing new information
- Plan follow-up research sessions if needed

## 6. Research Summary
Provide:
- Key findings and insights
- Gaps in current knowledge base
- Recommended actions for memory expansion
- Tags that would improve future research
- Summary of most relevant existing memories

Use all available MCP tools (\`find_memories\`, \`get_memory\`, \`list_memories\`) to execute this research workflow systematically.`;
}

/**
 * Get workflow prompt by name and arguments
 */
export function getWorkflowPrompt(name: string, args: Record<string, any>): string {
  switch (name) {
    case 'memory_capture_workflow':
      return generateMemoryCaptureWorkflowPrompt(args);
    case 'knowledge_discovery_workflow':
      return generateKnowledgeDiscoveryWorkflowPrompt(args);
    case 'content_maintenance_workflow':
      return generateContentMaintenanceWorkflowPrompt(args);
    case 'research_session_workflow':
      return generateResearchSessionWorkflowPrompt(args);
    default:
      throw new Error(`Unknown workflow prompt: ${name}`);
  }
}

/**
 * List all available workflow prompts
 */
export const availableWorkflowPrompts: Prompt[] = [
  memoryCaptureWorkflow,
  knowledgeDiscoveryWorkflow,
  contentMaintenanceWorkflow,
  researchSessionWorkflow
];