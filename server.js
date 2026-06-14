import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { AgentsDb } from './agentsDb.js';
import { runSimulation } from './agentEngine.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Database
const db = new AgentsDb();

// Helper: Get Gemini API Key
function getGeminiApiKey(req) {
  const settings = db.getSettings();
  const apiKey = req.headers['x-api-key'] || settings.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Gemini API Key is missing. Please configure it in Settings.');
  }
  return apiKey;
}

// --- API Endpoints ---

// Get Status
app.get('/api/status', (req, res) => {
  try {
    const settings = db.getSettings();
    const envKeyConfigured = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
    const hasKey = envKeyConfigured || !!(settings.geminiApiKey && settings.geminiApiKey.trim() !== '');
    
    res.json({
      envKeyConfigured,
      hasKey,
      agentsCount: db.getAgents().length,
      runsCount: db.getRuns().length,
      settings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Settings
app.post('/api/settings', (req, res) => {
  try {
    const { geminiApiKey, geminiModel, apiProvider, hfToken, hfModel } = req.body;
    const updated = db.updateSettings({ geminiApiKey, geminiModel, apiProvider, hfToken, hfModel });
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Agents
app.get('/api/agents', (req, res) => {
  try {
    res.json(db.getAgents());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Agent
app.post('/api/agents', (req, res) => {
  try {
    const { name, role, prompt, avatarColor, hasSearch } = req.body;
    if (!name || !role || !prompt) {
      return res.status(400).json({ error: 'Name, Role, and Prompt are required.' });
    }
    const agent = db.addAgent({ name, role, prompt, avatarColor, hasSearch });
    res.json({ success: true, agent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Agent
app.delete('/api/agents/:id', (req, res) => {
  try {
    db.deleteAgent(req.params.id);
    res.json({ success: true, message: 'Agent deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Runs
app.get('/api/runs', (req, res) => {
  try {
    res.json(db.getRuns());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Run Simulation
app.post('/api/runs', async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic || topic.trim() === '') {
      return res.status(400).json({ error: 'Research topic is required.' });
    }

    const apiKey = getGeminiApiKey(req);
    const agents = db.getAgents();

    if (agents.length === 0) {
      return res.status(400).json({ error: 'No agents available for simulation.' });
    }

    // 1. Create run record in database
    const run = db.addRun(topic);
    console.log(`[Server] Starting simulation run: ${run.id} for topic: "${topic}"`);

    // 2. Trigger asynchronous agent collaboration loop in background
    runSimulation(run.id, topic, agents, apiKey, db)
      .catch(err => {
        console.error(`[Server] Error running background simulation:`, err);
        db.updateRun(run.id, { status: 'failed', finalReport: `Simulation failed: ${err.message}` });
      });

    res.json({ success: true, run });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Run Details
app.get('/api/runs/:id', (req, res) => {
  try {
    const run = db.getRun(req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Run not found.' });
    }
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Run
app.delete('/api/runs/:id', (req, res) => {
  try {
    db.deleteRun(req.params.id);
    res.json({ success: true, message: 'Simulation run deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear DB
app.post('/api/clear', (req, res) => {
  try {
    db.clear();
    res.json({ success: true, message: 'Database reset successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static React production bundle
const distDir = path.resolve('dist');
app.use(express.static(distDir));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend static asset folder not found. Run npm run build first.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Multi-Agent backend server listening at http://0.0.0.0:${PORT}`);
});
