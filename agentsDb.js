import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve('agents_db.json');

export class AgentsDb {
  constructor() {
    this.data = {
      agents: [],
      runs: [],
      settings: {
        geminiApiKey: ''
      }
    };
    this.load();
    this.seedDefaultAgents();
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
      console.error('[AgentsDb] Error loading database:', error);
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[AgentsDb] Error saving database:', error);
    }
  }

  seedDefaultAgents() {
    if (!this.data.agents || this.data.agents.length === 0) {
      this.data.agents = [
        {
          id: 'researcher',
          name: 'Dr. Atlas',
          role: 'Lead Researcher',
          prompt: `You are the Lead Researcher. Your job is to search the web for the latest data, compile findings, and summarize key insights. Always focus on extracting cold, hard facts, statistics, and events. Always cite the websites or dates you found. Provide a highly detailed fact sheet.`,
          avatarColor: '#00f2fe',
          hasSearch: true
        },
        {
          id: 'synthesizer',
          name: 'Skye',
          role: 'Outline Architect',
          prompt: `You are the Outline Architect. Take the raw web research facts provided by the Researcher and organize them into a structured, chapter-by-chapter Markdown outline. For each chapter, specify what sub-points and key details it must cover. Do not write full paragraphs yet, just structure the skeleton of the report.`,
          avatarColor: '#7f00ff',
          hasSearch: false
        },
        {
          id: 'writer',
          name: 'Sterling',
          role: 'Lead Writer',
          prompt: `You are the Lead Writer. Take the structured outline and expand it into a comprehensive, detailed report in Markdown format. Ensure that you write full, descriptive, and informative paragraphs for each chapter. Avoid placeholders or summaries—write out the complete text. Integrate all the facts and statistics collected by the Researcher.`,
          avatarColor: '#4facfe',
          hasSearch: false
        },
        {
          id: 'critic',
          name: 'Nova',
          role: 'Quality Inspector',
          prompt: `You are the Quality Inspector. Review the draft report. Identify details that are missing, sentences that lack clarity, or areas where facts could be expanded. Provide clear, constructive bullet-point feedback on how the writer can improve the report. Do not rewrite the report yourself—simply provide the review.`,
          avatarColor: '#ff007f',
          hasSearch: false
        }
      ];
      this.save();
    }
  }

  getAgents() {
    return this.data.agents || [];
  }

  getAgent(id) {
    return (this.data.agents || []).find(a => a.id === id);
  }

  addAgent(agent) {
    const newAgent = {
      id: `agent-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: agent.name,
      role: agent.role,
      prompt: agent.prompt,
      avatarColor: agent.avatarColor || '#00f2fe',
      hasSearch: !!agent.hasSearch
    };
    if (!this.data.agents) this.data.agents = [];
    this.data.agents.push(newAgent);
    this.save();
    return newAgent;
  }

  deleteAgent(id) {
    this.data.agents = (this.data.agents || []).filter(a => a.id !== id);
    this.save();
  }

  getRuns() {
    return this.data.runs || [];
  }

  getRun(id) {
    return (this.data.runs || []).find(r => r.id === id);
  }

  addRun(topic) {
    const run = {
      id: `run-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      topic,
      status: 'running',
      messages: [],
      finalReport: '',
      createdAt: new Date().toISOString()
    };
    if (!this.data.runs) this.data.runs = [];
    this.data.runs.push(run);
    this.save();
    return run;
  }

  updateRun(id, updates) {
    if (!this.data.runs) return null;
    const idx = this.data.runs.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.data.runs[idx] = { ...this.data.runs[idx], ...updates };
      this.save();
      return this.data.runs[idx];
    }
    return null;
  }

  addRunMessage(id, agentName, agentRole, content) {
    if (!this.data.runs) return null;
    const idx = this.data.runs.findIndex(r => r.id === id);
    if (idx !== -1) {
      const message = {
        agent: agentName,
        role: agentRole,
        content,
        timestamp: new Date().toLocaleTimeString()
      };
      if (!this.data.runs[idx].messages) this.data.runs[idx].messages = [];
      this.data.runs[idx].messages.push(message);
      this.save();
      return this.data.runs[idx];
    }
    return null;
  }

  deleteRun(id) {
    this.data.runs = (this.data.runs || []).filter(r => r.id !== id);
    this.save();
  }

  getSettings() {
    const settings = this.data.settings || { geminiApiKey: '' };
    // Migrate off of gemini-2.5-flash due to strict daily rate limits on the free tier
    if (!settings.geminiModel || settings.geminiModel === 'gemini-2.5-flash') {
      settings.geminiModel = 'gemini-2.0-flash';
      this.data.settings = settings;
      this.save();
    }
    return settings;
  }

  updateSettings(settings) {
    this.data.settings = { ...this.data.settings, ...settings };
    this.save();
    return this.data.settings;
  }

  clear() {
    this.data = {
      agents: [],
      runs: [],
      settings: { geminiApiKey: '' }
    };
    this.save();
    this.seedDefaultAgents();
  }
}
