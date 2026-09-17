import fetch from 'node-fetch';
import { config } from '../config.js';

export const availableModels = {
  mock: ['mock-chat', 'mock-reasoner'],
  openai: ['gpt-4o-mini', 'gpt-4.1-mini'],
  anthropic: ['claude-3-5-sonnet', 'claude-3-haiku']
};

export async function generateResponse({ prompt, userId, conversationId, provider = config.aiProvider }) {
  if (provider === 'mock') {
    return {
      text: `NexusAI mock response for: ${prompt}\n\nThis is a safe local production-style fallback. Connect your AI provider in settings to enable live model responses.`,
      citations: [{ title: 'Local mock output', url: 'https://example.com/mock-output' }],
      provider,
      userId,
      conversationId
    };
  }

  if (provider === 'openai' && config.openAiApiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openAiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI request failed: ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || 'No output generated.';
    return { text, citations: [{ title: 'OpenAI response', url: 'https://platform.openai.com' }], provider };
  }

  if (provider === 'anthropic' && config.anthropicApiKey) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic request failed: ${errorText}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || 'No output generated.';
    return { text, citations: [{ title: 'Anthropic response', url: 'https://console.anthropic.com' }], provider };
  }

  return {
    text: `No live AI provider is configured. Use the mock provider or set the required environment variables.\n\nRequest: ${prompt}`,
    citations: [{ title: 'Configuration message', url: 'https://example.com/configuration' }],
    provider: 'configured-mock'
  };
}

export async function createTaskResponse({ kind, input }) {
  return {
    kind,
    output: `Generated ${kind} output for: ${input}`
  };
}
