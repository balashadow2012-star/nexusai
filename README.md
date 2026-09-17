# NexusAI

NexusAI is a production-style AI workspace for research, document Q&A, coding, image generation, and secure defensive cybersecurity workflows.

## Features
- AI chat with streaming and citations
- Web research abstraction layer
- Uploaded document indexing and RAG
- Content creation studio
- Code Lab with sandbox execution
- Security Lab with defensive guidance
- User accounts and isolated per-user data
- Dark/light theme and responsive UI

## Prerequisites
- Node.js 20+
- npm 10+
- Optional API keys for OpenAI/Anthropic, Brave/SerpAPI, and image generation

## Install

```bash
npm install
```

## Configure environment

Copy `.env.example` to `.env` and adjust values:

```bash
cp .env.example .env
```

Supported providers:
- AI: `mock`, `openai`, `anthropic`
- Search: `mock`, `brave`, `serpapi`
- Image: `mock`, `openai`

## Run locally

```bash
npm run dev
```

Frontend:
- http://localhost:5173

Backend:
- http://localhost:3001

## Deployment

Use any Node hosting provider such as Render, Railway, Fly.io, or a VPS. Set the required environment variables in the deployment platform and run:

```bash
npm install
npm run build
npm run start
```

## Add another AI model
1. Add a provider entry in `server/src/services/ai.js`.
2. Implement model selection in the settings UI and backend config.
3. Map the provider to `AI_PROVIDER` and optional API key env vars.
4. Extend the model list in the backend `availableModels` object.

## Add another tool
1. Add a tool definition in `server/src/services/tools.js`.
2. Implement the execution logic in the matching service.
3. Expose it through the agent route in `server/src/index.js`.
4. Add UI controls in the frontend if needed.

## Configure search
- Set `SEARCH_PROVIDER=brave` with `BRAVE_API_KEY`
- Or `SEARCH_PROVIDER=serpapi` with `SERPAPI_KEY`
- Otherwise use `mock` mode for local demos and offline testing

## Configure image generation
- Set `IMAGE_PROVIDER=openai` with `IMAGE_API_KEY`
- Use `mock` mode when no image API is configured

## Safety
- This application enforces safe boundaries for security workflows.
- It does not provide unauthorized access, credential theft, malware creation, or bypass techniques.
- The Security Lab is limited to defensive guidance, secure coding, CTF/lab education, and vulnerability explanations.

## License
MIT
