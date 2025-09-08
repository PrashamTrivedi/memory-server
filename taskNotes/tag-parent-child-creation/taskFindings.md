# Purpose

Add functionality to mention tags as parent/child with automatic creation and validation

## Original Ask
We need a functionality of mentioning tags as parent/child. Validation: if both exists, block the operation (we do not want to disrupt existing operations), if none of the tag exist, create the tag and assign direct parent child relationship.

**Additional Requirements:**
- Enable this functionality during memory creation/update as well
- This functionality affects the MCP server tools

## Complexity and the reason behind it
**Complexity Score: 3/5**

**Reasoning:**
- The project already has tag hierarchy functionality (parent/child relationships)
- Tags creation logic exists (getOrCreateTag function)
- Need to combine existing functionality into a new endpoint
- Validation logic is straightforward
- Frontend needs a new component/form for this functionality
- **Increased complexity due to:**
  - Memory creation/update needs to support hierarchical tags
  - MCP server tools need to be updated with new tag format
  - Multiple integration points (API, frontend, MCP)

## Architectural changes required

None required - we're extending existing tag hierarchy system

## Backend changes required

1. **New Service Method** in `TagHierarchyService`:
   - `createTagsWithRelationship(db, childTagName, parentTagName)`
   - Validates both tags doesn't exists. It's ok if one of them exists
   - Creates tags if needed and establishes parent-child relationship

2. **New Handler** in `tagHierarchy.ts`:
   - `POST /api/tags/create-with-parent`
   - Accepts { child_tag_name, parent_tag_name }
   - Returns created tags with hierarchy or error

3. **Memory Handlers Enhancement**:
   - Update `assignTagsToMemory` to support parent/child tag format
   - Support tag format like "parent>child" or structured objects
   - Integrate with new service method for hierarchical creation

4. **MCP Tools Enhancement**:
   - Update `addMemoryTool` schema to support hierarchical tags
   - Update `handleAddMemory` to process hierarchical tags
   - Update tool descriptions and examples

5. **Helper Function Updates**:
   - Add `getTagByName` helper to check tag existence
   - Update `assignTagsToMemory` to handle hierarchical format
   - Reuse existing `getOrCreateTag` logic

## Frontend changes required

1. **New API Method** in `tagHierarchy.ts`:
   - `createTagsWithParent(childName, parentName)` method

2. **Tag Management UI Update**:
   - Add form/modal to create parent-child tag pairs
   - Show validation messages for existing tags
   - Update tag tree display after creation

3. **Memory Form Enhancement**:
   - Support for hierarchical tag input (e.g., "parent>child" format)
   - Validation and error handling for hierarchical tag creation
   - Visual indicators for parent/child relationships

## Acceptance Criteria

1. New endpoint accepts child and parent tag names
2. If both tags exist, return error with clear message
3. If only one tag exists, create the missing tag and establish relationship  
4. If neither tag exists, create both and establish relationship
5. Proper error handling for circular references
6. Memory creation/update supports hierarchical tag format
7. MCP tools updated to support hierarchical tags
8. Frontend form validates input before submission
9. UI updates tag tree after successful creation
10. Memory forms handle hierarchical tag input correctly

## Validation

**Backend Testing:**
- API call with both tags existing → Should return 409 conflict
- API call with one tag existing → Should create missing tag and return 201
- API call with no tags existing → Should create both and return 201
- API call with same tag name for both → Should return 400 (self-reference)
- Memory creation with "parent>child" format → Should create hierarchy
- Memory update with hierarchical tags → Should handle correctly
- MCP add_memory with hierarchical tags → Should work correctly
- Verify tags are created in database
- Verify hierarchy relationship is established

**Frontend Testing:**
- Navigate to Tag Management page
- Click "Create Tag Hierarchy" button
- Enter parent and child tag names
- Submit form → Verify success message
- Check tag tree updates with new hierarchy
- Try creating with existing tags → Verify error message
- Try creating with one existing tag → Should create missing tag and establish relationship
- Memory form with "parent>child" tags → Should create hierarchy
- Memory form shows validation errors appropriately

**MCP Testing:**
- Use MCP add_memory tool with hierarchical tags
- Verify tags are created with proper hierarchy
- Test error scenarios through MCP interface