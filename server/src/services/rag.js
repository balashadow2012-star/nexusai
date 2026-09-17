import fetch from 'node-fetch';
import { config } from '../config.js';

export async function searchWeb({ query, provider = config.searchProvider, userId }) {
  if (provider === 'mock') {
    return {
      summary: `Mock research summary for "${query}". This result is generated locally to demonstrate the research workflow and citation structure without requiring live API keys.`,
      sources: [
        { title: 'NexusAI research placeholder', url: 'https://example.com/nexusai-research', snippet: 'Safe local research stub used in demo mode.' },
        { title: 'Knowledge base reference', url: 'https://example.com/knowledge-base', snippet: 'Example reference for citations and summaries.' }
      ],
      provider,
      userId
    };
  }

  if (provider === 'brave' && config.braveApiKey) {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'X-Subscription-Token': config.braveApiKey,
        Accept: 'application/json'
      }
    });

    if (!response.ok) throw new Error('Brave search failed');
    const data = await response.json();
    const results = data.web?.results || [];
    return {
      summary: results.map((item) => item.title).join(', ') || 'No results returned.',
      sources: results.slice(0, 5).map((item) => ({ title: item.title, url: item.url, snippet: item.description || 'No description available.' })),
      provider
    };
  }

  if (provider === 'serpapi' && config.serpApiKey) {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${config.serpApiKey}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('SerpAPI request failed');
    const data = await response.json();
    const results = data.organic_results || [];
    return {
      summary: `Search results for "${query}" retrieved from SerpAPI.`,
      sources: results.slice(0, 5).map((item) => ({ title: item.title, url: item.link, snippet: item.snippet || 'No snippet available.' })),
      provider
    };
  }

  throw new Error('No live search provider is configured. Set SEARCH_PROVIDER and the related API key, or use mock mode.');
}
