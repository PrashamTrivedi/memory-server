export class MemoryError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    this.name = 'MemoryError';
  }
}

export class MemoryNotFoundError extends MemoryError {
  constructor(memoryId: string) {
    super(404, `Memory with id ${memoryId} not found`);
    this.name = 'MemoryNotFoundError';
  }
}

export class DuplicateMemoryNameError extends MemoryError {
  constructor(name: string) {
    super(409, `Memory with name '${name}' already exists`);
    this.name = 'DuplicateMemoryNameError';
  }
}

export class InvalidMemoryDataError extends MemoryError {
  constructor(details: string) {
    super(400, `Invalid memory data: ${details}`);
    this.name = 'InvalidMemoryDataError';
  }
}

export class MemoryDatabaseError extends MemoryError {
  constructor(operation: string, details?: string) {
    const message = details 
      ? `Database operation failed: ${operation}. Details: ${details}`
      : `Database operation failed: ${operation}`;
    super(500, message);
    this.name = 'MemoryDatabaseError';
  }
}

export class UrlFetchError extends MemoryError {
  constructor(url: string, details?: string) {
    const message = details 
      ? `Failed to fetch URL content for ${url}: ${details}`
      : `Failed to fetch URL content for ${url}`;
    super(500, message);
    this.name = 'UrlFetchError';
  }
}