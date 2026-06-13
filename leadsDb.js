import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve('leads_db.json');

export class LeadsDb {
  constructor() {
    this.data = {
      campaigns: [],
      leads: [],
      settings: {
        n8nWebhookUrl: '',
        geminiApiKey: ''
      }
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(fileContent);
      } else {
        this.save();
      }
    } catch (error) {
      console.error('[LeadsDb] Error loading database:', error);
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[LeadsDb] Error saving database:', error);
    }
  }

  getCampaigns() {
    return this.data.campaigns || [];
  }

  getLeads(campaignId = null) {
    if (campaignId) {
      return (this.data.leads || []).filter(lead => lead.campaignId === campaignId);
    }
    return this.data.leads || [];
  }

  getLead(leadId) {
    return (this.data.leads || []).find(lead => lead.id === leadId);
  }

  addCampaign(keyword, location) {
    const campaign = {
      id: `camp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      keyword,
      location,
      createdAt: new Date().toISOString()
    };
    if (!this.data.campaigns) this.data.campaigns = [];
    this.data.campaigns.push(campaign);
    this.save();
    return campaign;
  }

  addLeads(campaignId, rawLeads) {
    if (!this.data.leads) this.data.leads = [];
    const addedLeads = [];

    for (const raw of rawLeads) {
      // Avoid duplicate website or business name in the same campaign
      const exists = this.data.leads.some(l => 
        l.campaignId === campaignId && 
        ((raw.website && l.website === raw.website) || l.name === raw.name)
      );

      if (!exists) {
        const lead = {
          id: `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          campaignId,
          name: raw.name,
          website: raw.website || '',
          phone: raw.phone || '',
          rating: raw.rating || null,
          reviewsCount: raw.reviewsCount || 0,
          address: raw.address || '',
          mapsUrl: raw.mapsUrl || '',
          status: 'scraped', // 'scraped' | 'auditing' | 'audited' | 'outreach_ready'
          screenshotPath: '',
          audit: null,
          emailDraft: '',
          createdAt: new Date().toISOString()
        };
        this.data.leads.push(lead);
        addedLeads.push(lead);
      }
    }
    if (addedLeads.length > 0) {
      this.save();
    }
    return addedLeads;
  }

  updateLead(leadId, updates) {
    if (!this.data.leads) return null;
    const idx = this.data.leads.findIndex(l => l.id === leadId);
    if (idx !== -1) {
      this.data.leads[idx] = { ...this.data.leads[idx], ...updates };
      this.save();
      return this.data.leads[idx];
    }
    return null;
  }

  deleteCampaign(campaignId) {
    this.data.campaigns = (this.data.campaigns || []).filter(c => c.id !== campaignId);
    this.data.leads = (this.data.leads || []).filter(l => l.campaignId !== campaignId);
    this.save();
  }

  getSettings() {
    return this.data.settings || { n8nWebhookUrl: '', geminiApiKey: '' };
  }

  updateSettings(settings) {
    this.data.settings = { ...this.data.settings, ...settings };
    this.save();
    return this.data.settings;
  }

  clear() {
    this.data = { campaigns: [], leads: [], settings: { n8nWebhookUrl: '', geminiApiKey: '' } };
    this.save();
  }
}
