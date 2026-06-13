import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LeadsDb } from './leadsDb.js';
import { scrapeGoogleMaps, auditWebsite } from './scraper.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Directories
const uploadsDir = path.resolve('uploads');
const screenshotsDir = path.join(uploadsDir, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Serve screenshots statically
app.use('/screenshots', express.static(screenshotsDir));

// Initialize JSON database
const db = new LeadsDb();

// In-memory progress logs for scraping/auditing
const logs = {};

function addLog(id, message) {
  if (!logs[id]) logs[id] = [];
  const timestamp = new Date().toLocaleTimeString();
  const logLine = `[${timestamp}] ${message}`;
  logs[id].push(logLine);
  console.log(`[Campaign/Lead LOG][${id}] ${message}`);
  // Keep logs at max 100 lines to prevent memory bloating
  if (logs[id].length > 100) {
    logs[id].shift();
  }
}

// Helper: Get Gemini Client
function getGeminiClient(req) {
  const settings = db.getSettings();
  const apiKey = req.headers['x-api-key'] || settings.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Gemini API Key is missing. Please configure it in Settings.');
  }
  return new GoogleGenerativeAI(apiKey);
}

// --- Endpoints ---

// Get Status
app.get('/api/status', (req, res) => {
  const settings = db.getSettings();
  const envKeyConfigured = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  const hasKey = envKeyConfigured || !!(settings.geminiApiKey && settings.geminiApiKey.trim() !== '');
  
  res.json({
    envKeyConfigured,
    hasKey,
    campaignsCount: db.getCampaigns().length,
    leadsCount: db.getLeads().length,
    settings
  });
});

// Update Settings
app.post('/api/settings', (req, res) => {
  try {
    const { n8nWebhookUrl, geminiApiKey } = req.body;
    const updated = db.updateSettings({ n8nWebhookUrl, geminiApiKey });
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Campaigns
app.get('/api/campaigns', (req, res) => {
  try {
    const campaigns = db.getCampaigns();
    const leads = db.getLeads();
    
    // Map campaign to include lead counts
    const enrichedCampaigns = campaigns.map(c => {
      const campLeads = leads.filter(l => l.campaignId === c.id);
      return {
        ...c,
        totalLeads: campLeads.length,
        auditedLeads: campLeads.filter(l => l.status === 'audited' || l.status === 'outreach_ready' || l.status === 'contacted').length,
        outreachReady: campLeads.filter(l => l.status === 'outreach_ready' || l.status === 'contacted').length
      };
    });
    
    res.json(enrichedCampaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Campaign & Start Scraping
app.post('/api/campaigns', async (req, res) => {
  try {
    const { keyword, location, limit = 5 } = req.body;
    if (!keyword || !location) {
      return res.status(400).json({ error: 'Keyword and Location are required.' });
    }
    
    // 1. Save campaign
    const campaign = db.addCampaign(keyword, location);
    const campaignId = campaign.id;
    
    addLog(campaignId, `Campaign created: "${keyword}" in "${location}"`);
    
    // 2. Trigger async Playwright scrape
    // Don't await this so API responds immediately
    scrapeGoogleMaps(keyword, location, limit, (msg) => addLog(campaignId, msg))
      .then(scrapedLeads => {
        addLog(campaignId, `Saving ${scrapedLeads.length} leads to database...`);
        const added = db.addLeads(campaignId, scrapedLeads);
        addLog(campaignId, `Successfully saved ${added.length} new listings (skipped duplicates). Campaign scraping completed!`);
      })
      .catch(err => {
        addLog(campaignId, `ERROR: ${err.message}`);
      });
      
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Campaign
app.delete('/api/campaigns/:id', (req, res) => {
  try {
    db.deleteCampaign(req.params.id);
    // clean logs
    delete logs[req.params.id];
    res.json({ success: true, message: 'Campaign and its leads deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Leads
app.get('/api/leads', (req, res) => {
  try {
    const { campaignId } = req.query;
    const leads = db.getLeads(campaignId);
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get logs (scrapes or audits)
app.get('/api/logs/:id', (req, res) => {
  res.json({ logs: logs[req.params.id] || [] });
});

// Audit Lead Website (Playwright website check & screenshot)
app.post('/api/leads/:id/audit', async (req, res) => {
  try {
    const leadId = req.params.id;
    const lead = db.getLead(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    if (!lead.website) {
      return res.status(400).json({ error: 'This lead has no website URL to audit.' });
    }
    
    db.updateLead(leadId, { status: 'auditing' });
    addLog(leadId, `Initiating website audit for ${lead.name} (${lead.website})`);
    
    // Trigger Playwright audit in background
    auditWebsite(lead.website, screenshotsDir, leadId, (msg) => addLog(leadId, msg))
      .then(auditResult => {
        const screenshotPath = `/screenshots/lead-${leadId}.png`;
        db.updateLead(leadId, {
          status: 'audited',
          audit: auditResult,
          screenshotPath
        });
        addLog(leadId, `Audit finished successfully for ${lead.name}`);
      })
      .catch(err => {
        db.updateLead(leadId, { status: 'scraped' });
        addLog(leadId, `Audit failed: ${err.message}`);
      });
      
    res.json({ success: true, message: 'Audit started in the background.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enrich Lead (Gemini Email draft generation or n8n webhook routing)
app.post('/api/leads/:id/enrich', async (req, res) => {
  try {
    const leadId = req.params.id;
    const lead = db.getLead(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    if (!lead.audit) {
      return res.status(400).json({ error: 'Please audit the website first before generating outreach.' });
    }
    
    const settings = db.getSettings();
    addLog(leadId, `Starting outreach enrichment for ${lead.name}`);
    
    // Check if n8n is configured
    if (settings.n8nWebhookUrl && settings.n8nWebhookUrl.trim() !== '') {
      addLog(leadId, `Routing lead to n8n webhook: ${settings.n8nWebhookUrl}`);
      
      const response = await fetch(settings.n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead)
      });
      
      if (!response.ok) {
        throw new Error(`n8n Webhook returned status ${response.status}`);
      }
      
      const responseData = await response.json();
      const emailDraft = responseData.emailDraft || '';
      
      db.updateLead(leadId, {
        status: 'outreach_ready',
        emailDraft
      });
      
      addLog(leadId, `Successfully enriched lead via n8n workflow!`);
      return res.json({ success: true, emailDraft });
      
    } else {
      // Fallback: Run direct Gemini analysis on backend
      addLog(leadId, `No n8n Webhook Url configured. Using fallback direct Gemini API.`);
      
      const genAI = getGeminiClient(req);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const systemPrompt = `You are a professional local agency business outreach writer. 
Generate a personalized, non-spammy outreach email targeting the business owner of ${lead.name}.
Use their diagnostic data to write a compelling, tailored pitch.
Keep it under 180 words. Reference their Google Maps rating of ${lead.rating || 'N/A'} stars with ${lead.reviewsCount || 0} reviews.
Point out missing pixels/tags from their audit profile (Facebook Pixel: ${lead.audit.pixels.facebook ? 'Yes' : 'Missing'}, Google Analytics: ${lead.audit.pixels.googleAnalytics ? 'Yes' : 'Missing'}, SEO Meta Tags: ${lead.audit.seo.hasMetaDescription ? 'Yes' : 'Missing'}).
Suggest a call to action. Provide a clear Subject: line first, followed by the Body. Do not use placeholders like [My Name] - sign it off from 'the audit team'.`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: "Write the outreach email." }] }],
        systemInstruction: systemPrompt
      });
      
      const emailDraft = result.response.text();
      
      db.updateLead(leadId, {
        status: 'outreach_ready',
        emailDraft
      });
      
      addLog(leadId, `Successfully enriched lead via direct Gemini LLM!`);
      res.json({ success: true, emailDraft });
    }
  } catch (err) {
    addLog(req.params.id, `Enrichment failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Update Lead Status (E.g. send email draft / contacted)
app.post('/api/leads/:id/status', (req, res) => {
  try {
    const { status, emailDraft } = req.body;
    const updated = db.updateLead(req.params.id, { status, emailDraft });
    if (!updated) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    res.json({ success: true, lead: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear DB
app.post('/api/clear', (req, res) => {
  try {
    db.clear();
    res.json({ success: true, message: 'Database cleared successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend in production (after running npm run build)
const distDir = path.resolve('dist');
app.use(express.static(distDir));

// Fallback all other GET requests to index.html for Single Page App router
app.get('*', (req, res, next) => {
  // Only serve index.html for page routes, not API endpoints
  if (req.path.startsWith('/api') || req.path.startsWith('/screenshots')) {
    return next();
  }
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not built. Run npm run build first.');
  }
});

app.listen(PORT, () => {
  console.log(`[Server] Lead Enrichment backend listening at http://localhost:${PORT}`);
});
