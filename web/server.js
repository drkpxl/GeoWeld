import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.dirname(__dirname);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const upload = multer({ 
  dest: path.join(__dirname, 'uploads'),
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.geojson') {
      cb(null, true);
    } else {
      cb(new Error('Only .geojson files are allowed'));
    }
  }
});

// Helper to ensure directory exists
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    console.error(`Error creating directory ${dirPath}:`, err);
  }
}

// Upload boundaries.geojson
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { resortName } = req.body;
    if (!resortName) {
      return res.status(400).json({ error: 'Resort name is required' });
    }

    const resortDir = path.join(ROOT_DIR, 'data', resortName);
    await ensureDir(resortDir);

    // Validate GeoJSON structure
    const fileContent = await fs.readFile(req.file.path, 'utf8');
    const geojson = JSON.parse(fileContent);
    
    // Check for ski_area_boundary
    const hasBoundary = geojson.features?.some(f => 
      f.properties?.ZoneType === 'ski_area_boundary'
    );
    
    if (!hasBoundary) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ 
        error: 'GeoJSON must contain at least one feature with ZoneType: ski_area_boundary' 
      });
    }

    // Move file to resort directory
    const targetPath = path.join(resortDir, 'boundaries.geojson');
    await fs.rename(req.file.path, targetPath);

    // Don't create placeholder - let Python script fetch OSM data

    // Update resorts.yaml with default config
    const configPath = path.join(ROOT_DIR, 'config', 'resorts.yaml');
    let config = {};
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      config = yaml.load(configContent) || {};
    } catch (err) {
      console.log('Creating new resorts.yaml');
    }

    if (!config[resortName]) {
      config[resortName] = {
        name: `${resortName.charAt(0).toUpperCase() + resortName.slice(1)} Resort`,
        data_files: {
          boundaries: `data/${resortName}/boundaries.geojson`,
          osm_features: `data/${resortName}/osm_features.geojson`
        },
        tree_config: {
          min_area_for_trees: 5000,
          small_area_threshold: 25000,
          medium_area_threshold: 100000,
          trees_per_small_hectare: 2,
          trees_per_medium_hectare: 4,
          trees_per_large_hectare: 15,
          max_trees_per_polygon: 40,
          min_trees_per_polygon: 1,
          random_seed: 42
        }
      };
      
      await fs.writeFile(configPath, yaml.dump(config), 'utf8');
    }

    res.json({ success: true, resort: resortName });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List resorts
app.get('/api/resorts', async (req, res) => {
  try {
    const dataDir = path.join(ROOT_DIR, 'data');
    const dirs = await fs.readdir(dataDir);
    const resorts = [];
    
    for (const dir of dirs) {
      const dirPath = path.join(dataDir, dir);
      const stat = await fs.stat(dirPath);
      if (stat.isDirectory()) {
        // Check if boundaries.geojson exists
        try {
          await fs.access(path.join(dirPath, 'boundaries.geojson'));
          resorts.push(dir);
        } catch {
          // Skip directories without boundaries.geojson
        }
      }
    }
    
    res.json(resorts);
  } catch (error) {
    res.json([]);
  }
});

// Get resort config
app.get('/api/resort/:name', async (req, res) => {
  try {
    const configPath = path.join(ROOT_DIR, 'config', 'resorts.yaml');
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = yaml.load(configContent) || {};
    
    if (config[req.params.name]) {
      res.json(config[req.params.name]);
    } else {
      res.status(404).json({ error: 'Resort not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update resort config
app.put('/api/resort/:name/config', async (req, res) => {
  try {
    const configPath = path.join(ROOT_DIR, 'config', 'resorts.yaml');
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = yaml.load(configContent) || {};
    
    if (!config[req.params.name]) {
      return res.status(404).json({ error: 'Resort not found' });
    }
    
    // Update tree_config only
    config[req.params.name].tree_config = {
      ...config[req.params.name].tree_config,
      ...req.body.tree_config
    };
    
    await fs.writeFile(configPath, yaml.dump(config), 'utf8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process resort
app.get('/api/process/:name', async (req, res) => {
  try {
    const resortName = req.params.name;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const pythonProcess = spawn('python3', [
      path.join(ROOT_DIR, 'scripts', 'process_resort.py'),
      '--resort', resortName
    ], {
      cwd: ROOT_DIR
    });

    pythonProcess.stdout.on('data', (data) => {
      res.write(`data: ${JSON.stringify({ type: 'stdout', message: data.toString() })}\n\n`);
    });

    pythonProcess.stderr.on('data', (data) => {
      res.write(`data: ${JSON.stringify({ type: 'stderr', message: data.toString() })}\n\n`);
    });

    pythonProcess.on('close', (code) => {
      res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
      res.end();
    });

    pythonProcess.on('error', (error) => {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List output files
app.get('/api/outputs', async (req, res) => {
  try {
    const outputDir = path.join(ROOT_DIR, 'output');
    const resorts = {};
    
    try {
      const dirs = await fs.readdir(outputDir);
      for (const dir of dirs) {
        const dirPath = path.join(outputDir, dir);
        const stat = await fs.stat(dirPath);
        if (stat.isDirectory()) {
          const files = await fs.readdir(dirPath);
          resorts[dir] = files.filter(f => f.endsWith('.geojson'));
        }
      }
    } catch {
      // Output directory might not exist yet
    }
    
    res.json(resorts);
  } catch (error) {
    res.json({});
  }
});

// Get processed GeoJSON for preview
app.get('/api/output/:resort', async (req, res) => {
  try {
    const filePath = path.join(ROOT_DIR, 'output', req.params.resort, `${req.params.resort}_processed.geojson`);
    const content = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(content));
  } catch (error) {
    res.status(404).json({ error: 'Processed file not found' });
  }
});

// Download file
app.get('/api/download/:resort/:file', async (req, res) => {
  try {
    const filePath = path.join(ROOT_DIR, 'output', req.params.resort, req.params.file);
    await fs.access(filePath);
    res.download(filePath);
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

// Get Mapbox token
app.get('/api/mapbox-token', (req, res) => {
  res.json({ token: process.env.MAPBOX_TOKEN });
});

const PORT = process.env.PORT || 4011;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Access the web interface at http://100.101.39.4:${PORT}`);
});