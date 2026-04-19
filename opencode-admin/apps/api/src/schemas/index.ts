// Agent schemas
export const agentConfigSchema = {
  type: 'object',
  required: ['name', 'type', 'enabled'],
  properties: {
    name: { type: 'string' },
    type: { 
      type: 'string', 
      enum: ['orchestrator', 'architect', 'code', 'test', 'debug', 'fixer'] 
    },
    description: { type: 'string' },
    model: { type: 'string' },
    systemPrompt: { type: 'string' },
    tools: { type: 'array', items: { type: 'string' } },
    enabled: { type: 'boolean' },
  },
};

export const routingConfigSchema = {
  type: 'object',
  properties: {
    defaultAgent: { 
      type: 'string', 
      enum: ['orchestrator', 'architect', 'code', 'test', 'debug', 'fixer'] 
    },
    rules: {
      type: 'array',
      items: {
        type: 'object',
        required: ['pattern', 'agent'],
        properties: {
          pattern: { type: 'string' },
          agent: { 
            type: 'string', 
            enum: ['orchestrator', 'architect', 'code', 'test', 'debug', 'fixer'] 
          },
          priority: { type: 'number' },
        },
      },
    },
  },
};

// Plugin schema
export const pluginConfigSchema = {
  type: 'object',
  required: ['name', 'enabled'],
  properties: {
    name: { type: 'string' },
    version: { type: 'string' },
    enabled: { type: 'boolean' },
    config: { type: 'object' },
  },
};

// Provider schema
export const providerConfigSchema = {
  type: 'object',
  required: ['name', 'type', 'enabled'],
  properties: {
    name: { type: 'string' },
    type: { type: 'string' },
    apiKey: { type: 'string' }, // Never returned in responses
    baseUrl: { type: 'string' },
    models: { type: 'array', items: { type: 'string' } },
    enabled: { type: 'boolean' },
  },
};

// MCP schema
export const mcpServerConfigSchema = {
  type: 'object',
  required: ['name', 'transport', 'enabled'],
  properties: {
    name: { type: 'string' },
    transport: { 
      type: 'string', 
      enum: ['stdio', 'http', 'ws'] 
    },
    command: { type: 'string' },
    args: { type: 'array', items: { type: 'string' } },
    url: { type: 'string' },
    enabled: { type: 'boolean' },
  },
};

// Common response schemas
export const successResponseSchema = {
  type: 'object',
  required: ['success'],
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object' },
    error: { type: 'string' },
  },
};

export const validationErrorSchema = {
  type: 'object',
  properties: {
    path: { type: 'string' },
    message: { type: 'string' },
  },
};

export const validationResultSchema = {
  type: 'object',
  required: ['valid', 'errors', 'warnings'],
  properties: {
    valid: { type: 'boolean' },
    errors: { type: 'array', items: validationErrorSchema },
    warnings: { type: 'array', items: validationErrorSchema },
  },
};

export const releaseInfoSchema = {
  type: 'object',
  required: ['id', 'timestamp', 'files'],
  properties: {
    id: { type: 'string' },
    timestamp: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    previousReleaseId: { type: 'string' },
  },
};
