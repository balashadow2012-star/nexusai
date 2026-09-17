import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bot,
  BrainCircuit,
  Code2,
  FileText,
  Globe,
  ImageIcon,
  Lock,
  LogOut,
  MessageSquareText,
  Moon,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  SunMedium,
  Trash2,
  Upload,
  Wand2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

const navItems = [
  { id: 'chat', label: 'Chat', icon: MessageSquareText },
  { id: 'research', label: 'Research', icon: Search },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'create', label: 'Create', icon: Wand2 },
  { id: 'code', label: 'Code Lab', icon: Code2 },
  { id: 'security', label: 'Security Lab', icon: Shield },
  { id: 'settings', label: 'Settings', icon: Settings }
];

const quickActions = [
  'Research',
  'Analyze File',
  'Write',
  'Code',
  'Create Image',
  'Security Lab'
];

const defaultConversation = { id: 'default', title: 'New chat' };

function App() {
  const [theme, setTheme] = useState('dark');
  const [section, setSection] = useState('chat');
  const [auth, setAuth] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: 'demo@nexus.ai', password: 'demo123' });
  const [draft, setDraft] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [researchQuery, setResearchQuery] = useState('');
  const [researchResult, setResearchResult] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [documentQuery, setDocumentQuery] = useState('');
  const [documentAnswer, setDocumentAnswer] = useState(null);
  const [toolOutput, setToolOutput] = useState('');
  const [securityOutput, setSecurityOutput] = useState('');
  const [codeInput, setCodeInput] = useState('console.log("Hello from NexusAI!")');
  const [codeResult, setCodeResult] = useState('');
  const [settings, setSettings] = useState({ aiProvider: 'mock', searchProvider: 'mock', imageProvider: 'mock', model: 'gpt-4o-mini' });
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Welcome to NexusAI. Ask anything. Research anything. Create anything.' }
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  useEffect(() => {
    document.body.dataset.theme = theme;
    const token = localStorage.getItem('nexusai_token');
    if (token) {
      fetchAuthMe(token);
    }
    loadSettings();
  }, []);

  const fetchAuthMe = async (token) => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Not authenticated');
      const data = await res.json();
      setAuth(data.user);
    } catch (error) {
      localStorage.removeItem('nexusai_token');
    }
  };

  const loadSettings = async () => {
    const token = localStorage.getItem('nexusai_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/settings`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
      }
    } catch (error) {
      // ignore background load failures
    }
  };

  const apiRequest = async (path, options = {}, token = localStorage.getItem('nexusai_token')) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Request failed');
    }
    return res.json ? res.json() : res;
  };

  const handleAuth = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const path = authMode === 'login' ? '/auth/login' : '/auth/signup';
      const payload = authMode === 'signup' ? { name: form.name, email: form.email, password: form.password } : { email: form.email, password: form.password };
      const result = await apiRequest(path, { method: 'POST', body: JSON.stringify(payload) });
      localStorage.setItem('nexusai_token', result.token);
      setAuth(result.user);
      fetchAuthMe(result.token);
      loadSettings();
      loadDocs();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('nexusai_token');
    setAuth(null);
    setMessages([{ role: 'assistant', content: 'Welcome to NexusAI. Ask anything. Research anything. Create anything.' }]);
  };

  const handleStreamChat = async () => {
    if (!chatInput.trim()) return;
    const message = chatInput.trim();
    setChatInput('');
    setMessages((prev) => [...prev, { role: 'user', content: message }, { role: 'assistant', content: '' }]);
    setIsStreaming(true);
    setError('');

    const token = localStorage.getItem('nexusai_token');
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ message, conversationId: defaultConversation.id })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Chat request failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assistantText = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.replace(/^data: /, '');
        if (!payload) continue;
        try {
          const parsed = JSON.parse(payload);
          if (parsed.type === 'chunk') {
            assistantText += parsed.text || '';
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === 'assistant') {
                last.content = assistantText;
              }
              return next;
            });
          }
        } catch (error) {
          // ignore invalid partial SSE payloads
        }
      }
    }

    setIsStreaming(false);
  };

  const handleResearch = async () => {
    if (!researchQuery.trim()) return;
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('nexusai_token');
      const res = await fetch(`${API_BASE}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ query: researchQuery })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Research failed');
      setResearchResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const token = localStorage.getItem('nexusai_token');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      await loadDocs();
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDocs = async () => {
    const token = localStorage.getItem('nexusai_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/documents`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (error) {
      // ignore
    }
  };

  const askDocument = async () => {
    if (!documentQuery.trim() || !documents[0]) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('nexusai_token');
      const res = await fetch(`${API_BASE}/documents/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ documentId: documents[0].id, query: documentQuery })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Document query failed');
      setDocumentAnswer(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToolGenerate = async (kind) => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('nexusai_token');
      const payload = {
        kind,
        input: draft || 'Generate a polished response for a general-purpose AI assistant.'
      };
      const res = await fetch(`${API_BASE}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setToolOutput(data.output || data.content || 'No output generated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeExecute = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('nexusai_token');
      const res = await fetch(`${API_BASE}/code/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ language: 'javascript', code: codeInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Execution failed');
      setCodeResult(data.output || 'No output');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityLab = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('nexusai_token');
      const res = await fetch(`${API_BASE}/security-lab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompt: 'Provide defensive recommendations for a local lab environment.' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Security analysis failed');
      setSecurityOutput(data.output || 'No guidance generated');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    const token = localStorage.getItem('nexusai_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Could not save settings');
    } catch (err) {
      setError(err.message);
    }
  };

  const renderMessageContent = (content) => {
    if (!content) return '...';
    return content
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/\*(.+?)\*/g, '<strong>$1</strong>');
  };

  const content = useMemo(() => {
    if (!auth) {
      return (
        <div className="auth-shell">
          <div className="auth-card">
            <div className="brand-row">
              <div className="brand-mark">N</div>
              <div>
                <div className="eyebrow">AI WORKSPACE</div>
                <h1>NexusAI</h1>
              </div>
            </div>

            <div className="auth-toggle">
              <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Login</button>
              <button className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')}>Sign up</button>
            </div>

            <form onSubmit={handleAuth} className="stack-form">
              {authMode === 'signup' && (
                <label>
                  Name
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </label>
              )}
              <label>
                Email
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label>
                Password
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </label>
              {error && <div className="error-box">{error}</div>}
              <button className="primary" type="submit" disabled={loading}>{loading ? 'Working…' : authMode === 'login' ? 'Login' : 'Create account'}</button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="workspace-shell">
        <aside className="sidebar">
          <div className="brand-row padded">
            <div className="brand-mark">N</div>
            <div>
              <div className="eyebrow">AI WORKSPACE</div>
              <strong>NexusAI</strong>
            </div>
          </div>

          <div className="sidebar-section">
            <button className="new-chat" onClick={() => setSection('chat')}><Plus size={16} /> New chat</button>
          </div>

          <nav className="nav-list">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} className={section === id ? 'nav-item active' : 'nav-item'} onClick={() => setSection(id)}>
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="profile-card">
              <div className="avatar">{auth.name?.[0]?.toUpperCase() || 'U'}</div>
              <div>
                <strong>{auth.name || 'User'}</strong>
                <small>{auth.email}</small>
              </div>
            </div>
            <button className="ghost wide" onClick={handleLogout}><LogOut size={16} /> Logout</button>
          </div>
        </aside>

        <main className="main-panel">
          <header className="topbar">
            <div>
              <div className="eyebrow">Ask anything.</div>
              <h2>Research anything. Create anything.</h2>
            </div>
            <div className="topbar-actions">
              <button className="icon-button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <SunMedium size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </header>

          {error && <div className="error-box">{error}</div>}

          {section === 'chat' && (
            <section className="pane chat-pane">
              <div className="chat-window">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'message user' : 'message assistant'}>
                    <div className="bubble" dangerouslySetInnerHTML={{ __html: renderMessageContent(message.content) }} />
                  </div>
                ))}
              </div>

              <div className="composer">
                <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask NexusAI to research, explain, write, code, plan, or analyze..." rows={3} />
                <div className="composer-actions">
                  <button className="ghost" onClick={() => setMessages([{ role: 'assistant', content: 'Welcome to NexusAI. Ask anything. Research anything. Create anything.' }])}>New Chat</button>
                  <button className="primary" onClick={handleStreamChat} disabled={isStreaming || loading}>
                    {isStreaming ? 'Streaming…' : 'Send'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {section === 'research' && (
            <section className="pane">
              <div className="hero-card">
                <div className="icon-badge"><Globe size={18} /></div>
                <div>
                  <h3>Research Engine</h3>
                  <p>Search multiple sources and summarize findings with citations.</p>
                </div>
              </div>
              <div className="toolbar-row">
                <input value={researchQuery} onChange={(e) => setResearchQuery(e.target.value)} placeholder="Research current events, products, science, or technology" />
                <button className="primary" onClick={handleResearch}>Research</button>
              </div>
              {researchResult && (
                <div className="result-card">
                  <h4>{researchResult.answer}</h4>
                  <ul>
                    {researchResult.sources?.map((source, index) => (
                      <li key={`${source.title}-${index}`}>
                        <strong>{source.title}</strong> — <a href={source.url} target="_blank" rel="noreferrer">{source.url}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {section === 'documents' && (
            <section className="pane">
              <div className="upload-panel">
                <label className="upload-box">
                  <Upload size={18} />
                  Upload PDF, TXT, DOCX, CSV, or image
                  <input type="file" onChange={handleUpload} hidden />
                </label>
              </div>
              <div className="toolbar-row">
                <input value={documentQuery} onChange={(e) => setDocumentQuery(e.target.value)} placeholder="Ask a question about the document" />
                <button className="primary" onClick={askDocument}>Ask</button>
              </div>
              {documents.length > 0 && (
                <div className="document-list">
                  {documents.map((item) => (
                    <div key={item.id} className="mini-card">
                      <strong>{item.filename}</strong>
                      <span>{item.status}</span>
                    </div>
                  ))}
                </div>
              )}
              {documentAnswer && (
                <div className="result-card">
                  <h4>{documentAnswer.answer}</h4>
                  <ul>
                    {documentAnswer.sources?.map((source, index) => (
                      <li key={`${source.filename}-${index}`}>{source.filename} — page {source.page}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {section === 'create' && (
            <section className="pane">
              <div className="tool-grid">
                <button onClick={() => handleToolGenerate('text')}>Text generation</button>
                <button onClick={() => handleToolGenerate('summary')}>Summarize</button>
                <button onClick={() => handleToolGenerate('rewrite')}>Rewrite</button>
                <button onClick={() => handleToolGenerate('brainstorm')}>Brainstorm</button>
                <button onClick={() => handleToolGenerate('json')}>JSON</button>
                <button onClick={() => handleToolGenerate('analysis')}>Data analysis</button>
              </div>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Input for your creation workflow" rows={6} />
              <div className="result-card">
                <pre>{toolOutput || 'No output yet.'}</pre>
              </div>
            </section>
          )}

          {section === 'code' && (
            <section className="pane code-pane">
              <div className="hero-card">
                <div className="icon-badge"><Code2 size={18} /></div>
                <div>
                  <h3>Code Lab</h3>
                  <p>Safe sandboxed execution for JavaScript and secure debugging.</p>
                </div>
              </div>
              <textarea value={codeInput} onChange={(e) => setCodeInput(e.target.value)} rows={12} />
              <button className="primary" onClick={handleCodeExecute}>Run</button>
              <div className="result-card">
                <pre>{codeResult || 'No code output yet.'}</pre>
              </div>
            </section>
          )}

          {section === 'security' && (
            <section className="pane">
              <div className="hero-card">
                <div className="icon-badge"><Lock size={18} /></div>
                <div>
                  <h3>Defensive Security Lab</h3>
                  <p>Safe analysis, secure coding guidance, and defensive security recommendations only.</p>
                </div>
              </div>
              <button className="primary" onClick={handleSecurityLab}>Run security review</button>
              <div className="result-card">
                <pre>{securityOutput || 'No security output yet.'}</pre>
              </div>
            </section>
          )}

          {section === 'settings' && (
            <section className="pane settings-pane">
              <div className="setting-row">
                <label>AI Provider</label>
                <select value={settings.aiProvider} onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value })}>
                  <option value="mock">Mock</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              <div className="setting-row">
                <label>Model</label>
                <select value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value })}>
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="claude-3-5-sonnet">claude-3.5-sonnet</option>
                </select>
              </div>
              <div className="setting-row">
                <label>Search Provider</label>
                <select value={settings.searchProvider} onChange={(e) => setSettings({ ...settings, searchProvider: e.target.value })}>
                  <option value="mock">Mock</option>
                  <option value="brave">Brave</option>
                  <option value="serpapi">SerpAPI</option>
                </select>
              </div>
              <div className="setting-row">
                <label>Image Provider</label>
                <select value={settings.imageProvider} onChange={(e) => setSettings({ ...settings, imageProvider: e.target.value })}>
                  <option value="mock">Mock</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <button className="primary" onClick={saveSettings}>Save settings</button>
            </section>
          )}
        </main>
      </div>
    );
  }, [auth, section, theme, messages, chatInput, loading, error, researchQuery, researchResult, documentQuery, documentAnswer, documents, draft, toolOutput, codeInput, codeResult, securityOutput, settings]);

  return <div className="app-shell">{content}</div>;
}

export default App;
