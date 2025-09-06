export class TagHierarchyError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    this.name = 'TagHierarchyError';
  }
}

export class TagNotFoundError extends TagHierarchyError {
  constructor(tagId: number) {
    super(404, `Tag with id ${tagId} not found`);
    this.name = 'TagNotFoundError';
  }
}

export class CircularReferenceError extends TagHierarchyError {
  constructor(childId: number, parentId: number) {
    super(400, `Circular reference detected: Cannot make tag ${parentId} a parent of tag ${childId} as it would create a cycle`);
    this.name = 'CircularReferenceError';
  }
}

export class RelationshipExistsError extends TagHierarchyError {
  constructor(childId: number, parentId: number) {
    super(409, `Parent relationship already exists between child tag ${childId} and parent tag ${parentId}`);
    this.name = 'RelationshipExistsError';
  }
}

export class RelationshipNotFoundError extends TagHierarchyError {
  constructor(childId: number, parentId: number) {
    super(404, `Parent relationship not found between child tag ${childId} and parent tag ${parentId}`);
    this.name = 'RelationshipNotFoundError';
  }
}

export class DatabaseOperationError extends TagHierarchyError {
  constructor(operation: string, details?: string) {
    const message = details 
      ? `Database operation failed: ${operation}. Details: ${details}`
      : `Database operation failed: ${operation}`;
    super(500, message);
    this.name = 'DatabaseOperationError';
  }
}