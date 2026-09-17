export const toolCatalog = [
  {
    name: 'web_search',
    description: 'Search the web for current or factual information and return citations.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    outputSchema: { type: 'object', properties: { answer: { type: 'string' }, sources: { type: 'array' } } },
    permissionLevel: 'read',
    timeout: 15000
  },
  {
    name: 'document_rag',
    description: 'Answer questions from user-uploaded documents using retrieval-augmented generation.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, documentId: { type: 'string' } }, required: ['query'] },
    outputSchema: { type: 'object', properties: { answer: { type: 'string' }, sources: { type: 'array' } } },
    permissionLevel: 'read',
    timeout: 10000
  },
  {
    name: 'calculator',
    description: 'Compute simple numeric values and analyses.',
    inputSchema: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] },
    outputSchema: { type: 'object', properties: { result: { type: 'number' } } },
    permissionLevel: 'read',
    timeout: 5000
  },
  {
    name: 'code_execution',
    description: 'Run JavaScript code in a constrained sandbox with time limits.',
    inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] },
    outputSchema: { type: 'object', properties: { output: { type: 'string' } } },
    permissionLevel: 'execute',
    timeout: 3000
  },
  {
    name: 'image_generation',
    description: 'Generate an image through the configured image provider.',
    inputSchema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] },
    outputSchema: { type: 'object', properties: { imageUrl: { type: 'string' } } },
    permissionLevel: 'write',
    timeout: 20000
  },
  {
    name: 'security_lab',
    description: 'Provide defensive security, secure coding, and local-lab guidance only.',
    inputSchema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] },
    outputSchema: { type: 'object', properties: { output: { type: 'string' } } },
    permissionLevel: 'read',
    timeout: 10000
  }
];

export async function runTool({ toolName, input, userId }) {
  if (toolName === 'calculator') {
    const sanitized = String(input.expression).replace(/[^0-9+\-*/().%\s]/g, '');
    const result = Function(`'use strict'; return (${sanitized})`)();
    return { result };
  }

  if (toolName === 'security_lab') {
    const text = String(input.prompt || '').toLowerCase();
    if (text.includes('bypass') || text.includes('steal') || text.includes('malware') || text.includes('phishing')) {
      throw new Error('This tool only supports defensive, authorized security guidance.');
    }
    return { output: 'Defensive review: validate trust boundaries, apply least privilege, and test in isolated lab environments only.' };
  }

  return { ok: true, message: `Tool ${toolName} executed for user ${userId}.` };
}
