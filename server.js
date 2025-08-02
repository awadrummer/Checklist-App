const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS for all origins
app.use(cors());

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Serve static files (PWA assets)
app.use(express.static('.', {
  // Set proper MIME types for PWA files
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Import and mount API routes
const apiRouter = express.Router();

// Copy the API logic from simple-api.js
const fs = require('fs').promises;
const DATA_DIR = process.env.DATA_DIR || './data';

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Validate ID format
function isValidId(id) {
  return /^[a-zA-Z0-9_-]{3,50}$/.test(id);
}

// API Routes
apiRouter.post('/save', async (req, res) => {
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

apiRouter.get('/load/:id', async (req, res) => {
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

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Mount API routes
app.use('/api', apiRouter);

// Serve index.html for all other routes (SPA routing)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Checklist PWA running on port ${PORT}`);
  console.log(`📁 Data directory: ${DATA_DIR}`);
  
  // Ensure data directory exists on startup
  await ensureDataDir();
  console.log('✅ Data directory ready');
});

module.exports = app;