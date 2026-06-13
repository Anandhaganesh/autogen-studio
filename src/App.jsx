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
  Cpu
} from 'lucide-react';

export default function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [leads, setLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  
  // Search state
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState(5);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapingCampaignId, setScrapingCampaignId] = useState(null);
  
  // Settings & Status
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ n8nWebhookUrl: '', geminiApiKey: '' });
  const [apiStatus, setApiStatus] = useState({ envKeyConfigured: false, hasKey: false, campaignsCount: 0, leadsCount: 0 });
  const [customApiKey, setCustomApiKey] = useState('');
  const [customWebhookUrl, setCustomWebhookUrl] = useState('');
  
  // Modal / Detail view
  const [selectedLead, setSelectedLead] = useState(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editedDraft, setEditedDraft] = useState('');
  
  // Logs state
  const [activeLogs, setActiveLogs] = useState([]);
  const [pollLogsId, setPollLogsId] = useState(null);
  
  // Clipboard alert
  const [copied, setCopied] = useState(false);

  const logsEndRef = useRef(null);

  // Initial load
  useEffect(() => {
    fetchStatus();
    fetchCampaigns();
  }, []);

  // Poll campaigns and leads list if scraping is active
  useEffect(() => {
    let interval;
    if (isScraping) {
      interval = setInterval(() => {
        fetchCampaigns();
        if (selectedCampaignId === scrapingCampaignId) {
          fetchLeads(selectedCampaignId, false);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isScraping, selectedCampaignId, scrapingCampaignId]);

  // Poll logs if pollLogsId is set (for running scraper or auditor)
  useEffect(() => {
    let interval;
    if (pollLogsId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/logs/${pollLogsId}`);
          if (res.ok) {
            const data = await res.json();
            setActiveLogs(data.logs || []);
          }
        } catch (err) {
          console.error("Error polling logs:", err);
        }
      }, 1500);
    } else {
      setActiveLogs([]);
    }
    return () => clearInterval(interval);
  }, [pollLogsId]);

  // Auto scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeLogs]);

  // Fetch status and settings
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setApiStatus(data);
        setSettings(data.settings || { n8nWebhookUrl: '', geminiApiKey: '' });
        setCustomApiKey(data.settings?.geminiApiKey || '');
        setCustomWebhookUrl(data.settings?.n8nWebhookUrl || '');
      }
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  };

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
        
        if (data.length > 0 && !selectedCampaignId) {
          setSelectedCampaignId(data[0].id);
          fetchLeads(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    }
  };

  // Fetch leads
  const fetchLeads = async (campaignId, showSpinner = true) => {
    if (showSpinner) setLoadingLeads(true);
    try {
      const res = await fetch(`/api/leads?campaignId=${campaignId}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
        
        if (selectedLead) {
          const updatedLead = data.find(l => l.id === selectedLead.id);
          if (updatedLead) setSelectedLead(updatedLead);
        }
        
        const auditingLead = data.find(l => l.status === 'auditing');
        if (auditingLead) {
          setPollLogsId(auditingLead.id);
        } else if (pollLogsId && pollLogsId.startsWith('lead-')) {
          setPollLogsId(null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      if (showSpinner) setLoadingLeads(false);
    }
  };

  // Handle campaign selection
  const handleSelectCampaign = (id) => {
    setSelectedCampaignId(id);
    fetchLeads(id);
    
    if (isScraping && scrapingCampaignId === id) {
      setPollLogsId(id);
    } else if (pollLogsId && !pollLogsId.startsWith('lead-')) {
      setPollLogsId(null);
    }
  };

  // Launch campaign
  const handleLaunchCampaign = async (e) => {
    e.preventDefault();
    if (!keyword.trim() || !location.trim()) return;

    setIsScraping(true);
    setScrapingCampaignId(null);
    setActiveLogs(['[System] Initializing scraper container...']);
    
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, location, limit })
      });
      const data = await res.json();
      if (res.ok) {
        const newCampId = data.campaign.id;
        setScrapingCampaignId(newCampId);
        setPollLogsId(newCampId);
        setSelectedCampaignId(newCampId);
        
        setKeyword('');
        setLocation('');
        
        fetchCampaigns();
        fetchLeads(newCampId);
      } else {
        alert(data.error || 'Failed to start campaign');
        setIsScraping(false);
      }
    } catch (err) {
      console.error(err);
      alert('Network error starting campaign');
      setIsScraping(false);
    }
  };

  // Delete Campaign
  const handleDeleteCampaign = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this campaign and all its leads?')) return;
    
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedCampaignId === id) {
          setSelectedCampaignId('');
          setLeads([]);
        }
        if (scrapingCampaignId === id) {
          setIsScraping(false);
          setScrapingCampaignId(null);
          setPollLogsId(null);
        }
        fetchCampaigns();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger Playwright website pixel/SEO audit
  const handleAuditLead = async (leadId) => {
    setPollLogsId(leadId); 
    try {
      const res = await fetch(`/api/leads/${leadId}/audit`, { method: 'POST' });
      if (res.ok) {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: 'auditing' } : l));
        setTimeout(() => {
          fetchLeads(selectedCampaignId, false);
        }, 1000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger Gemini/n8n outreach drafting
  const handleEnrichLead = async (leadId) => {
    try {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: 'enriching' } : l));
      
      const res = await fetch(`/api/leads/${leadId}/enrich`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        fetchLeads(selectedCampaignId, false);
        
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead(prev => ({
            ...prev,
            status: 'outreach_ready',
            emailDraft: data.emailDraft
          }));
        }
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to enrich lead');
        fetchLeads(selectedCampaignId, false);
      }
    } catch (err) {
      console.error(err);
      fetchLeads(selectedCampaignId, false);
    }
  };

  // Update lead status (e.g. mark contacted)
  const handleUpdateStatus = async (leadId, newStatus, draft = '') => {
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, emailDraft: draft || selectedLead?.emailDraft })
      });
      if (res.ok) {
        fetchLeads(selectedCampaignId, false);
        setSelectedLead(null);
        setIsEditingDraft(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n8nWebhookUrl: customWebhookUrl, geminiApiKey: customApiKey })
      });
      if (res.ok) {
        fetchStatus();
        setShowSettings(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Copy email draft to clipboard
  const handleCopyClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStopScrapeView = () => {
    setIsScraping(false);
    setScrapingCampaignId(null);
    setPollLogsId(null);
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="app-container">
      
      {/* HEADER SECTION */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <Zap style={{ width: '20px', height: '20px', color: '#02050a', fill: '#02050a' }} />
          </div>
          <div>
            <h1 className="brand-title">
              LeadFlow<span className="text-gradient-cyan-blue">.ai</span>
            </h1>
            <p style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Intelligent local acquisition engine
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="header-status-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border-light)', fontSize: '11px' }}>
            <Database style={{ width: '14px', height: '14px', color: 'var(--neon-cyan)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Database:</span>
            <span style={{ fontWeight: '800', color: 'var(--neon-cyan)' }}>{apiStatus.leadsCount} Leads</span>
          </div>

          {settings.n8nWebhookUrl ? (
            <span className="badge badge-ready" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Server style={{ width: '12px', height: '12px' }} /> n8n Active
            </span>
          ) : (
            <span className="badge badge-enriching" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Cpu style={{ width: '12px', height: '12px' }} /> Local Model
            </span>
          )}

          {apiStatus.hasKey ? (
            <span className="badge badge-ready">Gemini Active</span>
          ) : (
            <span className="badge badge-contacted" style={{ animation: 'pulseGlow 2.3s infinite' }}>Key Required</span>
          )}

          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className="btn btn-secondary"
            style={{ padding: '8px 10px', borderRadius: '10px' }}
            title="Settings Dashboard"
          >
            <Settings style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      </header>

      {/* SETTINGS CONFIGURATION */}
      {showSettings && (
        <div style={{ background: 'rgba(9, 14, 26, 0.9)', borderBottom: '1px solid var(--border-light)', padding: '24px' }}>
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <div className="flex-row justify-between align-center" style={{ marginBottom: '16px' }}>
              <h3 className="text-gradient-cyan-blue" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings style={{ width: '16px', height: '16px', color: 'var(--neon-cyan)' }} /> Settings Panel
              </h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
            
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
              Connect n8n workflows for custom lead processing, Google Sheets integration, and slack notifications. If left blank, the pipeline uses direct backend calling and local Gemini API fallback.
            </p>

            <form onSubmit={handleSaveSettings} className="flex-col gap-3">
              <div className="flex-row gap-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group">
                  <label style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Gemini API Key</label>
                  <input 
                    type="password" 
                    placeholder="Paste Gemini Key (AIzaSy...)" 
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    className="custom-input"
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>n8n Webhook URL</label>
                  <input 
                    type="text" 
                    placeholder="http://localhost:5678/webhook/..." 
                    value={customWebhookUrl}
                    onChange={(e) => setCustomWebhookUrl(e.target.value)}
                    className="custom-input"
                  />
                </div>
              </div>
              
              <div className="flex-row justify-between align-center" style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Download the <a href="/n8n_workflow.json" download style={{ color: 'var(--neon-cyan)', textDecoration: 'underline' }}>n8n_workflow.json</a> template to import into n8n.
                </span>
                <button type="submit" className="btn btn-primary">Save Settings</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DASHBOARD LAYOUT */}
      <div className="dashboard-layout">
        
        {/* SIDEBAR */}
        <aside className="sidebar">
          
          {/* SEARCH INPUT WIDGET */}
          <div className="scrape-widget">
            <h3 className="widget-title text-gradient-cyan-blue">
              <Search style={{ width: '14px', height: '14px', color: 'var(--neon-cyan)' }} /> Lead Locator
            </h3>
            
            <form onSubmit={handleLaunchCampaign} className="flex-col gap-3">
              <div className="form-group">
                <input 
                  type="text" 
                  placeholder="Business query (e.g. Spas, Dentists)" 
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="custom-input"
                  required
                  disabled={isScraping}
                />
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Location (e.g. Seattle, WA)" 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="custom-input"
                  style={{ paddingLeft: '34px' }}
                  required
                  disabled={isScraping}
                />
                <MapPin style={{ width: '14px', height: '14px', color: 'var(--text-muted)', position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
              
              <div className="flex-row justify-between align-center" style={{ gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Limit:</span>
                  <select 
                    value={limit} 
                    onChange={(e) => setLimit(parseInt(e.target.value))}
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '6px', color: '#fff', fontSize: '11px', padding: '4px 8px', outline: 'none' }}
                    disabled={isScraping}
                  >
                    <option value={3}>3 leads</option>
                    <option value={5}>5 leads</option>
                    <option value={10}>10 leads</option>
                  </select>
                </div>
                
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isScraping || !apiStatus.hasKey}
                  style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
                >
                  {isScraping ? (
                    <RefreshCw className="animate-spin" style={{ width: '12px', height: '12px' }} />
                  ) : (
                    <Play style={{ width: '12px', height: '12px', fill: '#02050a' }} />
                  )}
                  Scrape Leads
                </button>
              </div>
            </form>
          </div>

          {/* PLAYWRIGHT SCRAPE CONSOLE LOGS */}
          {pollLogsId && (
            <div className="flex-col gap-2">
              <h4 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal style={{ width: '12px', height: '12px', color: 'var(--neon-cyan)' }} /> Playwright Browser Logs
              </h4>
              <div className="cyber-terminal">
                {activeLogs.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Launching Chromium Instance...</div>
                ) : (
                  activeLogs.map((log, idx) => (
                    <div key={idx} style={{ marginBottom: '2px' }}>{log}</div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* CAMPAIGNS DIRECTORY LIST */}
          <div className="flex-col" style={{ flex: 1, minHeight: 0 }}>
            <h4 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText style={{ width: '12px', height: '12px', color: 'var(--neon-cyan)' }} /> Scrape Collections ({campaigns.length})
            </h4>
            
            {campaigns.length === 0 ? (
              <div style={{ flex: 1, border: '1px dashed var(--border-light)', borderRadius: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Database style={{ width: '24px', height: '24px', marginBottom: '8px' }} />
                <span style={{ fontSize: '11px' }}>No campaigns found. Start a local scrape search above.</span>
              </div>
            ) : (
              <div className="campaign-list">
                {campaigns.map((camp) => {
                  const isActive = selectedCampaignId === camp.id;
                  const isScrapingThis = scrapingCampaignId === camp.id;
                  
                  return (
                    <div 
                      key={camp.id} 
                      onClick={() => handleSelectCampaign(camp.id)}
                      className={`campaign-card ${isActive ? 'campaign-card-active' : ''}`}
                    >
                      <div className="flex-row justify-between align-center" style={{ marginBottom: '8px' }}>
                        <h5 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{camp.keyword}</h5>
                        {isScrapingThis ? (
                          <span className="badge badge-auditing animate-pulse">Scraping</span>
                        ) : (
                          <span className="badge badge-scraped">{camp.totalLeads} leads</span>
                        )}
                      </div>
                      
                      <div className="flex-row align-center" style={{ gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <MapPin style={{ width: '11px', height: '11px', color: 'var(--text-muted)' }} />
                        <span>{camp.location}</span>
                      </div>
                      
                      {camp.totalLeads > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px', fontSize: '9px', textAlign: 'center' }}>
                          <div>
                            <span style={{ display: 'block', fontWeight: '800', color: 'var(--text-primary)' }}>{camp.totalLeads}</span>
                            <span style={{ color: 'var(--text-muted)' }}>Found</span>
                          </div>
                          <div>
                            <span style={{ display: 'block', fontWeight: '800', color: 'var(--neon-amber)' }}>{camp.auditedLeads}</span>
                            <span style={{ color: 'var(--text-muted)' }}>Audited</span>
                          </div>
                          <div>
                            <span style={{ display: 'block', fontWeight: '800', color: 'var(--neon-emerald)' }}>{camp.outreachReady}</span>
                            <span style={{ color: 'var(--text-muted)' }}>Pitch</span>
                          </div>
                        </div>
                      )}

                      <button 
                        onClick={(e) => handleDeleteCampaign(camp.id, e)}
                        style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        title="Delete Directory"
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

        {/* PIPELINE LEAD PANEL */}
        <main className="main-content">
          
          {/* HEADER */}
          <div className="pipeline-header">
            <div>
              {selectedCampaignId ? (
                (() => {
                  const activeCamp = campaigns.find(c => c.id === selectedCampaignId);
                  return (
                    <div className="flex-col" style={{ gap: '4px' }}>
                      <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Target:</span> 
                        <span className="text-gradient-cyan-blue">{activeCamp?.keyword}</span>
                        <ChevronRight style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', border: '1px solid var(--border-light)', padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>{activeCamp?.location}</span>
                      </h2>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Audit website structures, look for advertising pixels, and craft outreach proposals.</p>
                    </div>
                  );
                })()
              ) : (
                <div className="flex-col" style={{ gap: '4px' }}>
                  <h2 style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>Acquisition Workspace</h2>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Select a scrape directory collection from the sidebar to inspect local listings.</p>
                </div>
              )}
            </div>
            
            {/* Metrics */}
            {selectedCampaignId && leads.length > 0 && (
              <div className="metrics-row">
                <div className="metric-badge">
                  <Globe style={{ width: '14px', height: '14px', color: 'var(--neon-cyan)' }} />
                  <div>
                    <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 'bold' }}>Websites Found</span>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {((leads.filter(l => l.website).length / leads.length) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="metric-badge">
                  <Sparkles style={{ width: '14px', height: '14px', color: 'var(--neon-emerald)' }} />
                  <div>
                    <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 'bold' }}>Outreach Ready</span>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {leads.filter(l => l.status === 'outreach_ready' || l.status === 'contacted').length} / {leads.length}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* LEADS CONTENT GRID */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingLeads ? (
              <div className="flex-col align-center justify-between" style={{ padding: '60px', color: 'var(--text-secondary)', gap: '10px' }}>
                <RefreshCw className="animate-spin" style={{ width: '24px', height: '24px', color: 'var(--neon-cyan)' }} />
                <span style={{ fontSize: '12px' }}>Loading campaign listings database...</span>
              </div>
            ) : !selectedCampaignId ? (
              <div className="flex-col align-center justify-between" style={{ padding: '80px', color: 'var(--text-muted)', gap: '15px', border: '1px dashed var(--border-light)', margin: '40px', borderRadius: '24px', textAlign: 'center' }}>
                <Database style={{ width: '32px', height: '32px' }} />
                <div>
                  <h4 style={{ color: 'var(--text-primary)', fontSize: '14px', marginBottom: '4px' }}>Workspace Empty</h4>
                  <p style={{ fontSize: '11px', maxWidth: '240px', margin: '0 auto' }}>Select a campaign on the sidebar or trigger a new search to populate leads.</p>
                </div>
              </div>
            ) : leads.length === 0 ? (
              <div className="flex-col align-center justify-between" style={{ padding: '80px', color: 'var(--text-secondary)', gap: '15px', textAlign: 'center' }}>
                <RefreshCw className="animate-spin" style={{ width: '32px', height: '32px', color: 'var(--neon-cyan)' }} />
                <div>
                  <h4 style={{ color: 'var(--text-primary)', fontSize: '14px', marginBottom: '4px' }}>Scraper Core Running</h4>
                  <p style={{ fontSize: '11px', maxWidth: '260px', margin: '0 auto' }}>Playwright is browsing search indexes for listing pages. Leads will render automatically shortly.</p>
                </div>
              </div>
            ) : (
              <div className="lead-grid">
                {leads.map((lead) => {
                  const hasWebsite = !!lead.website;
                  
                  return (
                    <div 
                      key={lead.id}
                      className={`lead-card status-${lead.status}`}
                    >
                      <div>
                        {/* Title and Badge */}
                        <div className="flex-row justify-between align-center" style={{ marginBottom: '8px', gap: '8px' }}>
                          <h4 className="line-clamp-1" style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }} title={lead.name}>
                            {lead.name}
                          </h4>
                          
                          {/* Badges */}
                          {lead.status === 'scraped' && <span className="badge badge-scraped">Scraped</span>}
                          {lead.status === 'auditing' && <span className="badge badge-auditing animate-pulse">Auditing</span>}
                          {lead.status === 'audited' && <span className="badge badge-audited">Audited</span>}
                          {lead.status === 'enriching' && <span className="badge badge-enriching animate-pulse">Enriching</span>}
                          {lead.status === 'outreach_ready' && <span className="badge badge-ready">✓ Pitch Ready</span>}
                          {lead.status === 'contacted' && <span className="badge badge-contacted">Sent</span>}
                        </div>

                        {/* Location / Rating Info */}
                        <div className="flex-row" style={{ flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                          {lead.rating && (
                            <span style={{ color: 'var(--neon-amber)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <Star style={{ width: '12px', height: '12px', fill: 'var(--neon-amber)' }} /> {lead.rating} ({lead.reviewsCount})
                            </span>
                          )}
                          {lead.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Phone style={{ width: '11px', height: '11px', color: 'var(--text-muted)' }} /> {lead.phone}</span>}
                          {lead.address && <span className="line-clamp-1" style={{ maxWidth: '180px', display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin style={{ width: '11px', height: '11px', color: 'var(--text-muted)' }} /> {lead.address.split(',')[0]}</span>}
                        </div>

                        {/* Website URL link */}
                        <div style={{ marginBottom: '14px' }}>
                          {hasWebsite ? (
                            <a 
                              href={lead.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex-row align-center text-gradient-cyan-blue"
                              style={{ fontSize: '11px', fontWeight: 'bold', textDecoration: 'none', gap: '4px' }}
                            >
                              <Globe style={{ width: '12px', height: '12px', color: 'var(--neon-cyan)' }} /> 
                              <span className="truncate" style={{ maxWidth: '200px' }}>{lead.website.replace(/https?:\/\/(www\.)?/, '')}</span>
                              <ExternalLink style={{ width: '10px', height: '10px', color: 'var(--text-muted)' }} />
                            </a>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Globe style={{ width: '12px', height: '12px', color: '#1e293b' }} /> No Website URL
                            </span>
                          )}
                        </div>

                        {/* Audit indicators mini-checklist */}
                        {lead.audit && (
                          <div className="audit-mini-grid">
                            <div className="audit-indicator-row">
                              <span className={`audit-dot ${lead.audit.pixels.facebook ? 'audit-dot-green' : 'audit-dot-red'}`}>
                                {lead.audit.pixels.facebook ? '✓' : '✗'}
                              </span>
                              <span>FB Pixel</span>
                            </div>
                            <div className="audit-indicator-row">
                              <span className={`audit-dot ${lead.audit.pixels.googleAnalytics ? 'audit-dot-green' : 'audit-dot-red'}`}>
                                {lead.audit.pixels.googleAnalytics ? '✓' : '✗'}
                              </span>
                              <span>Google Tag</span>
                            </div>
                            <div className="audit-indicator-row">
                              <span className={`audit-dot ${lead.audit.seo.hasMetaDescription ? 'audit-dot-green' : 'audit-dot-red'}`}>
                                {lead.audit.seo.hasMetaDescription ? '✓' : '✗'}
                              </span>
                              <span>Meta Tag</span>
                            </div>
                            <div className="audit-indicator-row">
                              <span style={{ color: lead.audit.speed === 'fast' ? 'var(--neon-emerald)' : lead.audit.speed === 'average' ? 'var(--neon-amber)' : 'var(--neon-pink)', fontWeight: 'bold' }}>
                                {lead.audit.speed.toUpperCase()}
                              </span>
                              <span style={{ color: 'var(--text-secondary)' }}>Speed</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex-row justify-between align-center" style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px' }}>
                        {lead.status === 'outreach_ready' || lead.status === 'contacted' ? (
                          <button 
                            onClick={() => {
                              setSelectedLead(lead);
                              setEditedDraft(lead.emailDraft);
                              setIsEditingDraft(false);
                            }}
                            className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Mail style={{ width: '12px', height: '12px', color: 'var(--neon-cyan)' }} /> View Proposal
                          </button>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            {!hasWebsite ? 'Cannot Audit (No URL)' : 'Requires Web Audit'}
                          </span>
                        )}

                        <div className="flex-row gap-2">
                          {hasWebsite && (lead.status === 'scraped' || lead.status === 'audited') && (
                            <button 
                              onClick={() => handleAuditLead(lead.id)}
                              disabled={lead.status === 'auditing'}
                              className="btn btn-secondary"
                            >
                              {lead.status === 'auditing' ? (
                                <RefreshCw className="animate-spin" style={{ width: '12px', height: '12px' }} />
                              ) : (
                                'Run Audit'
                              )}
                            </button>
                          )}
                          
                          {lead.status === 'audited' && (
                            <button 
                              onClick={() => handleEnrichLead(lead.id)}
                              className="btn btn-primary"
                              style={{ display: 'flex', alignItems: 'center', gap: '3px' }}
                            >
                              <Sparkles style={{ width: '12px', height: '12px', fill: '#02050a' }} />
                              Write Pitch
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* DETAILED INSPECTION MODAL */}
      {selectedLead && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            
            {/* Modal Left side */}
            <div className="modal-col-left">
              <div className="flex-row justify-between align-center" style={{ marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>{selectedLead.name}</h3>
                  <a href={selectedLead.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--neon-cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {selectedLead.website} <ExternalLink style={{ width: '11px', height: '11px' }} />
                  </a>
                </div>
                {selectedLead.rating && (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--neon-amber)', fontWeight: 'bold', fontSize: '11px', background: 'rgba(255, 179, 0, 0.08)', border: '1px solid rgba(255, 179, 0, 0.2)', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Star style={{ width: '12px', height: '12px', fill: 'var(--neon-amber)' }} /> {selectedLead.rating}
                    </span>
                  </div>
                )}
              </div>

              {/* Contacts */}
              <div className="flex-col gap-2" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                {selectedLead.phone && <div style={{ display: 'flex', gap: '6px' }}><Phone style={{ width: '14px', height: '14px', color: 'var(--text-muted)' }} /> <span>{selectedLead.phone}</span></div>}
                {selectedLead.address && <div style={{ display: 'flex', gap: '6px' }}><MapPin style={{ width: '14px', height: '14px', color: 'var(--text-muted)' }} /> <span>{selectedLead.address}</span></div>}
                {selectedLead.audit?.contactEmail && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <Mail style={{ width: '14px', height: '14px', color: 'var(--neon-cyan)' }} /> 
                    <span style={{ fontWeight: 'bold', color: 'var(--neon-cyan)' }}>{selectedLead.audit.contactEmail}</span>
                    <span className="badge badge-scraped" style={{ fontSize: '8px' }}>Found on Website</span>
                  </div>
                )}
              </div>

              {/* Full diagnostic Checklist */}
              <h4 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '8px' }}>Diagnostic Core Checklist</h4>
              <div className="flex-row gap-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '20px' }}>
                
                <div style={{ background: '#020408', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>Pixel Tracking status</span>
                  <div className="flex-col gap-2" style={{ fontSize: '11px' }}>
                    <div className="flex-row justify-between align-center">
                      <span>Facebook Ads Pixel</span>
                      <span style={{ color: selectedLead.audit?.pixels.facebook ? 'var(--neon-emerald)' : 'var(--neon-pink)', fontWeight: 'bold' }}>
                        {selectedLead.audit?.pixels.facebook ? 'Installed' : 'Missing'}
                      </span>
                    </div>
                    <div className="flex-row justify-between align-center">
                      <span>Google Analytics Tag</span>
                      <span style={{ color: selectedLead.audit?.pixels.googleAnalytics ? 'var(--neon-emerald)' : 'var(--neon-pink)', fontWeight: 'bold' }}>
                        {selectedLead.audit?.pixels.googleAnalytics ? 'Installed' : 'Missing'}
                      </span>
                    </div>
                    <div className="flex-row justify-between align-center">
                      <span>TikTok Pixel</span>
                      <span style={{ color: selectedLead.audit?.pixels.tiktok ? 'var(--neon-emerald)' : 'var(--neon-pink)', fontWeight: 'bold' }}>
                        {selectedLead.audit?.pixels.tiktok ? 'Installed' : 'Missing'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#020408', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>SEO essentials status</span>
                  <div className="flex-col gap-2" style={{ fontSize: '11px' }}>
                    <div className="flex-row justify-between align-center">
                      <span>Meta Description tag</span>
                      <span style={{ color: selectedLead.audit?.seo.hasMetaDescription ? 'var(--neon-emerald)' : 'var(--neon-pink)', fontWeight: 'bold' }}>
                        {selectedLead.audit?.seo.hasMetaDescription ? 'Installed' : 'Missing'}
                      </span>
                    </div>
                    <div className="flex-row justify-between align-center">
                      <span>H1 Header Tag</span>
                      <span style={{ color: selectedLead.audit?.seo.hasH1 ? 'var(--neon-emerald)' : 'var(--neon-pink)', fontWeight: 'bold' }}>
                        {selectedLead.audit?.seo.hasH1 ? 'Installed' : 'Missing'}
                      </span>
                    </div>
                    <div className="flex-row justify-between align-center">
                      <span>OpenGraph Meta</span>
                      <span style={{ color: selectedLead.audit?.seo.hasOpenGraph ? 'var(--neon-emerald)' : 'var(--neon-pink)', fontWeight: 'bold' }}>
                        {selectedLead.audit?.seo.hasOpenGraph ? 'Installed' : 'Missing'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Website mock frame render */}
              {selectedLead.screenshotPath && (
                <div className="flex-col gap-2">
                  <h4 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 'bold' }}>HTML Screenshot render</h4>
                  <div className="browser-mock">
                    <div className="browser-bar">
                      <div className="browser-dot" style={{ background: '#ff5f56' }} />
                      <div className="browser-dot" style={{ background: '#ffbd2e' }} />
                      <div className="browser-dot" style={{ background: '#27c93f' }} />
                      <div className="browser-address">{selectedLead.website}</div>
                    </div>
                    <img 
                      src={`http://localhost:5000${selectedLead.screenshotPath}`} 
                      alt="Homepage Screenshot Mockup" 
                      style={{ width: '100%', height: 'auto', maxLength: '180px', objectFit: 'cover', objectPosition: 'top' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Right side (AI Draft Editor) */}
            <div className="modal-col-right">
              
              <div className="flex-col" style={{ flex: 1, minHeight: 0 }}>
                <div className="flex-row justify-between align-center" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '15px' }}>
                  <h3 style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }} className="text-gradient-cyan-blue">
                    <Sparkles style={{ width: '14px', height: '14px', color: 'var(--neon-cyan)' }} /> Generated Outreach Pitch
                  </h3>
                  
                  <div className="flex-row gap-2">
                    <button 
                      onClick={() => handleCopyClipboard(editedDraft || selectedLead.emailDraft)}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '6px', color: '#fff', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title="Copy proposal to clipboard"
                    >
                      {copied ? (
                        <Check style={{ width: '12px', height: '12px', color: 'var(--neon-emerald)' }} />
                      ) : (
                        <Copy style={{ width: '12px', height: '12px' }} />
                      )}
                    </button>
                    <button 
                      onClick={() => setSelectedLead(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      <X style={{ width: '16px', height: '16px' }} />
                    </button>
                  </div>
                </div>

                {/* Text editor box */}
                <div style={{ flex: 1, background: '#020408', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '12px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#e2e8f0', minHeight: '220px' }}>
                  {isEditingDraft ? (
                    <textarea 
                      value={editedDraft}
                      onChange={(e) => setEditedDraft(e.target.value)}
                      style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '12px', resize: 'none' }}
                    />
                  ) : (
                    <div style={{ whitespace: 'pre-wrap', lineHeight: '1.6' }}>{editedDraft || selectedLead.emailDraft}</div>
                  )}
                </div>
              </div>

              {/* Modal footer actions */}
              <div className="flex-row justify-between align-center" style={{ marginTop: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '15px' }}>
                <div>
                  {isEditingDraft ? (
                    <button 
                      onClick={() => setIsEditingDraft(false)}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        setEditedDraft(selectedLead.emailDraft);
                        setIsEditingDraft(true);
                      }}
                      className="btn btn-secondary"
                    >
                      Edit Proposal
                    </button>
                  )}
                </div>

                <div className="flex-row gap-2">
                  {isEditingDraft ? (
                    <button 
                      onClick={() => {
                        setIsEditingDraft(false);
                        handleUpdateStatus(selectedLead.id, 'outreach_ready', editedDraft);
                      }}
                      className="btn btn-primary"
                    >
                      Save Pitch
                    </button>
                  ) : (
                    <>
                      {selectedLead.status !== 'contacted' ? (
                        <button 
                          onClick={() => handleUpdateStatus(selectedLead.id, 'contacted')}
                          className="btn btn-primary"
                        >
                          Mark Sent (via n8n)
                        </button>
                      ) : (
                        <span className="badge badge-ready" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '6px 12px' }}>
                          <CheckCircle2 style={{ width: '12px', height: '12px' }} /> Pitch Dispatched
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
