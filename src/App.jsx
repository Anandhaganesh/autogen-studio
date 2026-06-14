import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  MapPin, 
  Settings, 
  Key, 
  Globe, 
  Phone, 
  Star, 
  Check, 
  X, 
  ArrowRight, 
  Sparkles, 
  Mail, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  RefreshCw, 
  Play, 
  Database, 
  Eye, 
  ExternalLink,
  Info,
  Terminal,
  FileText,
  Copy,
  ChevronRight,
  TrendingUp,
  Server,
  Zap,
  Cpu,
  Download,
  BookOpen,
  UserCheck
} from 'lucide-react';

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (e) {
    return dateStr;
  }
}

export default function App() {
  const [agents, setAgents] = useState([]);
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedRun, setSelectedRun] = useState(null);
  
  // Simulation trigger state
  const [topic, setTopic] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeRunId, setActiveRunId] = useState(null);
  
  // Settings & Status
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ geminiApiKey: '', geminiModel: 'gemini-2.0-flash' });
  const [apiStatus, setApiStatus] = useState({ envKeyConfigured: false, hasKey: false, agentsCount: 0, runsCount: 0 });
  const [customApiKey, setCustomApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
  
  // Tab selector for workspace: 'chat' (Agent dialogue) or 'report' (Final Report)
  const [workspaceTab, setWorkspaceTab] = useState('chat');
  
  // Clipboard and download indicators
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const chatEndRef = useRef(null);

  // Initial load
  useEffect(() => {
    fetchStatus();
    fetchAgents();
    fetchRuns();
  }, []);

  // Poll active run logs and updates
  useEffect(() => {
    let interval;
    if (activeRunId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/runs/${activeRunId}`);
          if (res.ok) {
            const data = await res.json();
            
            // Update selected run if it is the currently viewed one
            if (selectedRunId === activeRunId) {
              setSelectedRun(data);
            }
            
            // Check if status finished
            if (data.status === 'completed' || data.status === 'failed') {
              setIsSimulating(false);
              setActiveRunId(null);
              fetchRuns(); // refresh runs sidebar
              if (data.status === 'completed') {
                setWorkspaceTab('report'); // swap tab to display compiled report
              }
            }
          }
        } catch (err) {
          console.error("Error polling run details:", err);
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [activeRunId, selectedRunId]);

  // Fetch runs list if we change the active state
  useEffect(() => {
    if (selectedRunId) {
      fetchRunDetails(selectedRunId);
    } else {
      setSelectedRun(null);
    }
  }, [selectedRunId]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedRun?.messages, isSimulating]);

  // Fetch server status & API keys
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setApiStatus(data);
        setSettings(data.settings || { geminiApiKey: '', geminiModel: 'gemini-2.0-flash' });
        setCustomApiKey(data.settings?.geminiApiKey || '');
        setSelectedModel(data.settings?.geminiModel || 'gemini-2.0-flash');
      }
    } catch (err) {
      console.error("Failed to fetch backend status:", err);
    }
  };

  // Fetch agents
  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    }
  };

  // Fetch simulation runs
  const fetchRuns = async () => {
    try {
      const res = await fetch('/api/runs');
      if (res.ok) {
        const data = await res.json();
        setRuns(data);
        
        // Auto select first run if none selected
        if (data.length > 0 && !selectedRunId) {
          setSelectedRunId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch runs list:", err);
    }
  };

  // Fetch single run details
  const fetchRunDetails = async (id) => {
    try {
      const res = await fetch(`/api/runs/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedRun(data);
      }
    } catch (err) {
      console.error("Error fetching run details:", err);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: customApiKey, geminiModel: selectedModel })
      });
      if (res.ok) {
        fetchStatus();
        setShowSettings(false);
      }
    } catch (err) {
      console.error("Error saving settings:", err);
    }
  };

  // Launch compilation run
  const handleStartSimulation = async (e) => {
    e.preventDefault();
    if (!topic.trim() || isSimulating) return;

    setIsSimulating(true);
    setWorkspaceTab('chat');
    
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      const data = await res.json();
      if (res.ok) {
        const newRunId = data.run.id;
        setActiveRunId(newRunId);
        setSelectedRunId(newRunId);
        setTopic('');
        fetchRuns();
      } else {
        alert(data.error || 'Failed to initialize agent simulation');
        setIsSimulating(false);
      }
    } catch (err) {
      console.error(err);
      alert('Network error starting agent simulation');
      setIsSimulating(false);
    }
  };

  // Delete Run
  const handleDeleteRun = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this research project and its compiled report?')) return;
    
    try {
      const res = await fetch(`/api/runs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedRunId === id) {
          setSelectedRunId('');
          setSelectedRun(null);
        }
        if (activeRunId === id) {
          setIsSimulating(false);
          setActiveRunId(null);
        }
        fetchRuns();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Copy report to clipboard
  const handleCopyReport = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download report as markdown file
  const handleDownloadReport = (title, text) => {
    if (!text) return;
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    
    // Normalize filename
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_report.md`;
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  // Simple Markdown to HTML parser
  const renderMarkdown = (md) => {
    if (!md) return '';
    
    // Convert headers: # Header -> h1, ## -> h2, etc.
    let parsed = md;
    
    // Escaping html characters first
    parsed = parsed
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
      
    // Convert bold
    parsed = parsed.replace(/\*\*(.*?)\*\"/g, '<strong>$1</strong>');
    
    // Convert bullet lists
    parsed = parsed.replace(/^\s*-\s+(.*?)$/gm, '<li>$1</li>');
    // Group adjacent lists into ul (simple regex replacement)
    parsed = parsed.replace(/(<li>.*?<\/li>)+/g, '<ul class="markdown-list">$&</ul>');
    
    // Convert blockquotes
    parsed = parsed.replace(/^\s*&gt;\s+(.*?)$/gm, '<blockquote class="markdown-quote">$1</blockquote>');
    
    // Code blocks
    parsed = parsed.replace(/```([\s\S]*?)```/g, '<pre class="markdown-code-block"><code>$1</code></pre>');
    parsed = parsed.replace(/`(.*?)`/g, '<code class="markdown-inline-code">$1</code>');

    // Headers
    parsed = parsed.replace(/^# (.*?)$/gm, '<h1 class="markdown-h1">$1</h1>');
    parsed = parsed.replace(/^## (.*?)$/gm, '<h2 class="markdown-h2">$1</h2>');
    parsed = parsed.replace(/^### (.*?)$/gm, '<h3 class="markdown-h3">$1</h3>');

    // Paragraph breaks
    const paragraphs = parsed.split('\n\n');
    return paragraphs.map((p, idx) => {
      if (!p.trim()) return null;
      // Skip wrapping block elements in paragraph tags
      if (p.trim().startsWith('<h') || p.trim().startsWith('<ul') || p.trim().startsWith('<pre') || p.trim().startsWith('<blockquote')) {
        return <div key={idx} dangerouslySetInnerHTML={{ __html: p }} />;
      }
      return <p key={idx} className="markdown-paragraph" dangerouslySetInnerHTML={{ __html: p }} />;
    });
  };

  // Check which agent is currently active based on message count
  const getActiveAgentId = () => {
    if (!selectedRun || selectedRun.status !== 'running') return null;
    const msgCount = selectedRun.messages ? selectedRun.messages.length : 0;
    switch (msgCount) {
      case 0: return 'researcher';
      case 1: return 'synthesizer';
      case 2: return 'writer';
      case 3: return 'critic';
      case 4: return 'writer'; // writer does final revision
      default: return null;
    }
  };

  const activeAgentId = getActiveAgentId();

  return (
    <div className="app-container">
      
      {/* HEADER */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <Cpu style={{ width: '22px', height: '22px', color: '#02050a' }} />
          </div>
          <div>
            <h1 className="brand-title">
              AutoGen<span className="text-gradient-cyan-blue">.Studio</span>
            </h1>
            <p style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Multi-Agent Collaborative Web Search & Report Compiler
            </p>
          </div>
        </div>

        {/* Header Status */}
        <div className="header-status-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border-light)', fontSize: '11px' }}>
            <Server style={{ width: '14px', height: '14px', color: 'var(--neon-cyan)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Model status:</span>
            <span style={{ fontWeight: '800', color: 'var(--neon-cyan)' }}>{settings.geminiModel || 'gemini-2.5-flash'}</span>
          </div>

          {apiStatus.hasKey ? (
            <span className="badge badge-ready" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 style={{ width: '12px', height: '12px' }} /> Grounding Connected
            </span>
          ) : (
            <span className="badge badge-contacted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', animation: 'pulseGlow 2.3s infinite' }}>
              <AlertCircle style={{ width: '12px', height: '12px' }} /> Configure Key
            </span>
          )}

          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className="btn btn-secondary"
            style={{ padding: '8px 10px', borderRadius: '10px' }}
            title="Configure settings"
          >
            <Settings style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      </header>

      {/* SETTINGS MODULE */}
      {showSettings && (
        <div style={{ background: 'rgba(9, 14, 26, 0.95)', borderBottom: '1px solid var(--border-light)', padding: '24px', zIndex: '99' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto' }}>
            <div className="flex-row justify-between align-center" style={{ marginBottom: '14px' }}>
              <h3 className="text-gradient-cyan-blue" style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key style={{ width: '16px', height: '16px', color: 'var(--neon-cyan)' }} /> AI Studio Setup
              </h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
            
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
              Paste your Google AI Studio API Key and select your preferred LLM model. Keys are stored securely in your dashboard configurations.
            </p>

            <form onSubmit={handleSaveSettings} className="flex-col gap-3">
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Gemini API Key:</label>
                <input 
                  type="password" 
                  placeholder="AI Studio API Key (AIzaSy...)" 
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className="custom-input"
                  required
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Gemini Model Selection:</label>
                <select 
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="custom-input"
                  style={{ background: 'var(--bg-input)', cursor: 'pointer', appearance: 'auto' }}
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Default - strict 20/day quota)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Advanced - strict 50/day quota)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast & responsive - recommended)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Highest daily free-tier quota)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Alternative Pro)</option>
                </select>
              </div>
              
              <div className="flex-row justify-between align-center" style={{ marginTop: '5px' }}>
                <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', color: 'var(--neon-cyan)', textDecoration: 'underline' }}>
                  Get free key here (30 seconds)
                </a>
                <button type="submit" className="btn btn-primary">Save Settings</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DASHBOARD GRID */}
      <div className="dashboard-layout">
        
        {/* SIDEBAR: AGENT TEAM & ARCHIVES */}
        <aside className="sidebar">
          
          {/* RESEARCH AGENTS LIST */}
          <div className="flex-col">
            <h4 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.05em' }}>
              <UserCheck style={{ width: '13px', height: '13px', color: 'var(--neon-cyan)' }} /> Active Research Team
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {agents.map((agent) => {
                const isActive = activeAgentId === agent.id;
                
                return (
                  <div 
                    key={agent.id}
                    className="glass-panel"
                    style={{ 
                      padding: '12px 14px', 
                      background: 'rgba(255,255,255,0.01)',
                      border: isActive ? `1.5px solid ${agent.avatarColor}` : '1px solid var(--border-light)',
                      boxShadow: isActive ? `0 0 15px ${agent.avatarColor}35` : 'none',
                      borderRadius: '12px',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div className="flex-row align-center gap-2" style={{ marginBottom: '6px' }}>
                      <div 
                        style={{ 
                          width: '18px', 
                          height: '18px', 
                          borderRadius: '4px', 
                          background: agent.avatarColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: `0 0 10px ${agent.avatarColor}60`
                        }}
                      >
                        {isActive && <RefreshCw className="animate-spin" style={{ width: '10px', height: '10px', color: '#000' }} />}
                      </div>
                      <div>
                        <h5 style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
                          {agent.name} {isActive && <span style={{ fontSize: '8px', color: agent.avatarColor, fontStyle: 'italic', fontWeight: 'normal' }}>(thinking...)</span>}
                        </h5>
                        <span style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block' }}>{agent.role}</span>
                      </div>
                    </div>
                    
                    <p className="line-clamp-2" style={{ fontSize: '9px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      {agent.prompt}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PREVIOUS COMPILATIONS */}
          <div className="flex-col" style={{ flex: 1, minHeight: 0 }}>
            <h4 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.05em' }}>
              <BookOpen style={{ width: '13px', height: '13px', color: 'var(--neon-cyan)' }} /> Compiled Reports ({runs.length})
            </h4>
            
            {runs.length === 0 ? (
              <div style={{ flex: 1, border: '1px dashed var(--border-light)', borderRadius: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <BookOpen style={{ width: '20px', height: '20px', marginBottom: '8px' }} />
                <span style={{ fontSize: '10px' }}>No research files compiled yet.</span>
              </div>
            ) : (
              <div className="campaign-list">
                {runs.map((r) => {
                  const isActive = selectedRunId === r.id;
                  const isRunningThis = activeRunId === r.id;
                  
                  return (
                    <div 
                      key={r.id} 
                      onClick={() => {
                        setSelectedRunId(r.id);
                        if (r.status === 'completed') setWorkspaceTab('report');
                      }}
                      className={`campaign-card ${isActive ? 'campaign-card-active' : ''}`}
                    >
                      <div className="flex-row justify-between align-center" style={{ marginBottom: '6px' }}>
                        <h5 className="line-clamp-1" style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)', maxWidth: '180px' }} title={r.topic}>
                          {r.topic}
                        </h5>
                        {isRunningThis ? (
                          <span className="badge badge-auditing animate-pulse" style={{ fontSize: '7px' }}>Running</span>
                        ) : r.status === 'failed' ? (
                          <span className="badge badge-contacted" style={{ fontSize: '7px' }}>Failed</span>
                        ) : (
                          <span className="badge badge-ready" style={{ fontSize: '7px' }}>Ready</span>
                        )}
                      </div>
                      
                      <div className="flex-row justify-between align-center" style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                        <span>{formatDate(r.createdAt)}</span>
                        <span>{(r.messages || []).length} steps</span>
                      </div>

                      <button 
                        onClick={(e) => handleDeleteRun(r.id, e)}
                        style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        title="Delete record"
                      >
                        <Trash2 style={{ width: '12px', height: '12px' }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* WORKSPACE AREA */}
        <main className="main-content">
          
          {/* SEARCH PROMPTER HEADER */}
          <div className="pipeline-header" style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'stretch' }}>
            <div className="flex-row justify-between align-center">
              <div>
                <h2 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap style={{ width: '16px', height: '16px', color: 'var(--neon-cyan)', fill: 'var(--neon-cyan)' }} />
                  <span>Agent Research Console</span>
                </h2>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Enter any topic. The agents will search Google, construct an outline, write content, fact-check the draft, and format a markdown report.
                </p>
              </div>

              {selectedRun && (
                <div className="flex-row gap-2" style={{ background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <button 
                    onClick={() => setWorkspaceTab('chat')} 
                    className="btn" 
                    style={{ 
                      padding: '5px 12px', 
                      background: workspaceTab === 'chat' ? 'rgba(0,242,254,0.1)' : 'transparent',
                      color: workspaceTab === 'chat' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                      borderColor: workspaceTab === 'chat' ? 'rgba(0,242,254,0.3)' : 'transparent'
                    }}
                  >
                    Agent Dialogue
                  </button>
                  <button 
                    onClick={() => setWorkspaceTab('report')} 
                    disabled={!selectedRun.finalReport}
                    className="btn" 
                    style={{ 
                      padding: '5px 12px', 
                      background: workspaceTab === 'report' ? 'rgba(0,255,135,0.1)' : 'transparent',
                      color: workspaceTab === 'report' ? 'var(--neon-emerald)' : 'var(--text-secondary)',
                      borderColor: workspaceTab === 'report' ? 'rgba(0,255,135,0.3)' : 'transparent',
                      opacity: !selectedRun.finalReport ? 0.4 : 1
                    }}
                  >
                    Compiled Report
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleStartSimulation} className="flex-row gap-3">
              <div style={{ flex: 1, position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Input topic (e.g. History of Space Shuttle program, Room-temperature superconductors, etc.)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="custom-input"
                  style={{ paddingRight: '40px' }}
                  required
                  disabled={isSimulating || !apiStatus.hasKey}
                />
                <Globe style={{ width: '16px', height: '16px', color: 'var(--text-muted)', position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ padding: '10px 20px', borderRadius: '12px' }}
                disabled={isSimulating || !topic.trim() || !apiStatus.hasKey}
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="animate-spin" style={{ width: '13px', height: '13px' }} />
                    <span>Collaborating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles style={{ width: '13px', height: '13px', fill: '#000' }} />
                    <span>Compile Report</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* ACTIVE WORKSPACE */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {!selectedRun ? (
              <div className="flex-col align-center justify-between" style={{ padding: '80px', color: 'var(--text-muted)', gap: '15px', border: '1px dashed var(--border-light)', margin: '40px', borderRadius: '24px', textAlign: 'center' }}>
                <Cpu style={{ width: '36px', height: '36px' }} />
                <div>
                  <h4 style={{ color: 'var(--text-primary)', fontSize: '14px', marginBottom: '4px' }}>Launch a Compilation</h4>
                  <p style={{ fontSize: '11px', maxWidth: '280px', margin: '0 auto' }}>Provide a topic in the search prompter above to command your agents to begin web research.</p>
                </div>
              </div>
            ) : workspaceTab === 'chat' ? (
              
              /* CHAT TAB */
              <div style={{ flex: 1, overflowY: 'auto', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Agent collaboration node flow */}
                <div className="glass-panel" style={{ padding: '14px 20px', background: 'rgba(2, 4, 8, 0.4)', borderRadius: '14px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>Collaboration Roadmap</span>
                  
                  <div className="flex-row align-center justify-between" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                      <span style={{ background: selectedRun.messages.length > 0 ? 'var(--neon-cyan)' : activeAgentId === 'researcher' ? 'var(--neon-cyan)' : 'var(--text-muted)', color: '#000', width: '16px', height: '16px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '9px' }}>1</span>
                      <span style={{ color: activeAgentId === 'researcher' ? 'var(--neon-cyan)' : 'var(--text-secondary)', fontWeight: activeAgentId === 'researcher' ? 'bold' : 'normal' }}>Dr. Atlas (Scrape)</span>
                    </div>
                    <ChevronRight style={{ width: '12px', height: '12px', color: 'var(--text-muted)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                      <span style={{ background: selectedRun.messages.length > 1 ? 'var(--neon-violet)' : activeAgentId === 'synthesizer' ? 'var(--neon-violet)' : 'var(--text-muted)', color: '#000', width: '16px', height: '16px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '9px' }}>2</span>
                      <span style={{ color: activeAgentId === 'synthesizer' ? 'var(--neon-violet)' : 'var(--text-secondary)', fontWeight: activeAgentId === 'synthesizer' ? 'bold' : 'normal' }}>Skye (Outline)</span>
                    </div>
                    <ChevronRight style={{ width: '12px', height: '12px', color: 'var(--text-muted)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                      <span style={{ background: selectedRun.messages.length > 2 ? 'var(--neon-blue)' : activeAgentId === 'writer' && selectedRun.messages.length === 2 ? 'var(--neon-blue)' : 'var(--text-muted)', color: '#000', width: '16px', height: '16px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '9px' }}>3</span>
                      <span style={{ color: activeAgentId === 'writer' && selectedRun.messages.length === 2 ? 'var(--neon-blue)' : 'var(--text-secondary)', fontWeight: activeAgentId === 'writer' && selectedRun.messages.length === 2 ? 'bold' : 'normal' }}>Sterling (Draft)</span>
                    </div>
                    <ChevronRight style={{ width: '12px', height: '12px', color: 'var(--text-muted)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                      <span style={{ background: selectedRun.messages.length > 3 ? 'var(--neon-pink)' : activeAgentId === 'critic' ? 'var(--neon-pink)' : 'var(--text-muted)', color: '#000', width: '16px', height: '16px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '9px' }}>4</span>
                      <span style={{ color: activeAgentId === 'critic' ? 'var(--neon-pink)' : 'var(--text-secondary)', fontWeight: activeAgentId === 'critic' ? 'bold' : 'normal' }}>Nova (Inspect)</span>
                    </div>
                    <ChevronRight style={{ width: '12px', height: '12px', color: 'var(--text-muted)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                      <span style={{ background: selectedRun.status === 'completed' ? 'var(--neon-emerald)' : activeAgentId === 'writer' && selectedRun.messages.length === 4 ? 'var(--neon-cyan)' : 'var(--text-muted)', color: '#000', width: '16px', height: '16px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '9px' }}>5</span>
                      <span style={{ color: selectedRun.status === 'completed' ? 'var(--neon-emerald)' : activeAgentId === 'writer' && selectedRun.messages.length === 4 ? 'var(--neon-cyan)' : 'var(--text-secondary)', fontWeight: selectedRun.status === 'completed' ? 'bold' : 'normal' }}>Sterling (Publish)</span>
                    </div>
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-col gap-4">
                  {selectedRun.messages && selectedRun.messages.map((msg, idx) => {
                    const agentProfile = agents.find(a => a.name === msg.agent.replace(' (Final)', ''));
                    const borderCol = agentProfile ? agentProfile.avatarColor : 'var(--border-light)';
                    
                    return (
                      <div 
                        key={idx}
                        className="glass-panel animate-fade-in"
                        style={{ 
                          borderLeft: `3px solid ${borderCol}`,
                          padding: '18px', 
                          background: 'rgba(12, 20, 36, 0.4)',
                          borderRadius: '12px'
                        }}
                      >
                        <div className="flex-row justify-between align-center" style={{ marginBottom: '10px' }}>
                          <div className="flex-row align-center gap-2">
                            <span style={{ fontWeight: '800', color: '#fff', fontSize: '12px' }}>{msg.agent}</span>
                            <span className="badge" style={{ background: `${borderCol}15`, borderColor: `${borderCol}30`, color: borderCol, fontSize: '8px' }}>
                              {msg.role}
                            </span>
                          </div>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{msg.timestamp}</span>
                        </div>
                        
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.6', overflowX: 'auto' }}>
                          {renderMarkdown(msg.content)}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Thinking Status */}
                  {selectedRun.status === 'running' && (
                    <div className="glass-panel animate-fade-in" style={{ padding: '16px', background: 'rgba(2, 4, 8, 0.2)', border: '1px dashed var(--border-light)', borderRadius: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <RefreshCw className="animate-spin text-cyan-400" style={{ width: '14px', height: '14px', color: 'var(--neon-cyan)' }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        Orchestrating agent collaboration loop. The next agent is drafting its response...
                      </span>
                    </div>
                  )}

                  {/* Failure Status */}
                  {selectedRun.status === 'failed' && (
                    <div className="glass-panel animate-fade-in" style={{ padding: '18px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <AlertCircle style={{ width: '16px', height: '16px', color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <h5 style={{ fontSize: '12px', fontWeight: 'bold', color: '#ef4444', marginBottom: '4px' }}>Simulation Failed</h5>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                          {selectedRun.finalReport || 'An unknown error occurred during orchestration.'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>
              </div>
            ) : (
              
              /* REPORT TAB */
              <div className="flex-col" style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
                <div className="flex-row justify-between align-center" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border-light)', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold' }} className="text-gradient-cyan-blue">
                    Compiled Research: {selectedRun.topic}
                  </h3>
                  
                  <div className="flex-row gap-2">
                    <button 
                      onClick={() => handleCopyReport(selectedRun.finalReport)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px' }}
                    >
                      {copied ? (
                        <>
                          <Check style={{ width: '12px', height: '12px', color: 'var(--neon-emerald)' }} />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy style={{ width: '12px', height: '12px' }} />
                          <span>Copy Report</span>
                        </>
                      )}
                    </button>
                    
                    <button 
                      onClick={() => handleDownloadReport(selectedRun.topic, selectedRun.finalReport)}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px' }}
                    >
                      {downloaded ? (
                        <>
                          <Check style={{ width: '12px', height: '12px', color: '#000' }} />
                          <span>Saved</span>
                        </>
                      ) : (
                        <>
                          <Download style={{ width: '12px', height: '12px' }} />
                          <span>Download .md</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Final Report Body */}
                <div className="glass-panel" style={{ padding: '30px', background: 'rgba(10, 16, 30, 0.4)', borderRadius: '16px', lineHeight: '1.7', color: '#f1f5f9', fontSize: '12.5px' }}>
                  {renderMarkdown(selectedRun.finalReport)}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
