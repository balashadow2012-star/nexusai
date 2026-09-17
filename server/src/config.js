import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3001),
  jwtSecret: process.env.JWT_SECRET || 'development-secret',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  dbPath: process.env.DB_PATH || './data/nexusai.db',
  aiProvider: process.env.AI_PROVIDER || 'mock',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  searchProvider: process.env.SEARCH_PROVIDER || 'mock',
  serpApiKey: process.env.SERPAPI_KEY || '',
  braveApiKey: process.env.BRAVE_API_KEY || '',
  imageProvider: process.env.IMAGE_PROVIDER || 'mock',
  imageApiKey: process.env.IMAGE_API_KEY || '',
  uploadLimitMb: Number(process.env.UPLOAD_LIMIT_MB || 15),
  maxCodeExecutionMs: Number(process.env.MAX_CODE_EXECUTION_MS || 3000),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'nexusai_session'
};
