// Simple Node.js API for Checklist Cloud Sync
// Deploy this to any simple hosting service like Vercel, Netlify Functions, or Railway

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || './data';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Validate ID format (alphanumeric, hyphens, underscores only)
function isValidId(id) {
  return /^[a-zA-Z0-9_-]{3,50}$/.test(id);
}

// Save checklist data
app.post('/api/save', async (req, res) => {
  try {
    const { id, data } = req.body;
    
    if (!id || !data) {
      return res.status(400).json({ success: false, message: 'ID and data are required' });
    }
    
    if (!isValidId(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid ID format. Use only letters, numbers, hyphens, and underscores (3-50 characters)' 
      });
    }
    
    await ensureDataDir();
    const filePath = path.join(DATA_DIR, `${id}.json`);
    
    // Check if ID already exists
    try {
      await fs.access(filePath);
      // File exists, allow overwrite (user owns this ID)
    } catch {
      // File doesn't exist, create new
    }
    
    // Save data with timestamp
    const saveData = {
      ...data,
      savedAt: new Date().toISOString()
    };
    
    await fs.writeFile(filePath, JSON.stringify(saveData, null, 2));
    
    res.json({ 
      success: true, 
      message: 'Data saved successfully',
      id: id,
      savedAt: saveData.savedAt
    });
    
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Load checklist data
app.get('/api/load/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidId(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid ID format' 
      });
    }
    
    const filePath = path.join(DATA_DIR, `${id}.json`);
    
    try {
      const fileData = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(fileData);
      
      res.json({ 
        success: true, 
        data: data,
        loadedAt: new Date().toISOString()
      });
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ success: false, message: 'ID not found' });
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('Load error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Checklist Sync API running on port ${PORT}`);
  ensureDataDir().then(() => {
    console.log(`Data directory: ${DATA_DIR}`);
  });
});

module.exports = app;