import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import auth from 'basic-auth';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.dirname(__dirname);

// Input sanitization functions
function sanitizeResortName(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }
  // Only allow alphanumeric, hyphens, underscores
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '');
  if (sanitized.length === 0 || sanitized.length > 50) {
    return null;
  }
  return sanitized;
}

function sanitizeFileName(filename) {
  if (!filename || typeof filename !== 'string') {
    return null;
  }
  // Only allow alphanumeric, hyphens, underscores, and dots for extensions
  const sanitized = filename.replace(/[^a-zA-Z0-9_.-]/g, '');
  if (sanitized.length === 0 || sanitized.length > 100 || sanitized.includes('..')) {
    return null;
  }
  return sanitized;
}

const app = express();

// Basic authentication middleware
const basicAuth = (req, res, next) => {
  const credentials = auth(req);
  const validUsername = process.env.ADMIN_USERNAME || 'admin';
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validPassword) {
    return res.status(500).json({ error: 'Authentication not configured' });
  }

  if (!credentials || credentials.name !== validUsername || credentials.pass !== validPassword) {
    res.set('WWW-Authenticate', 'Basic realm="GeoWeld Admin"');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// Apply authentication to all routes except health checks
app.use((req, res, next) => {
  // Skip auth for health check or if no password is set
  if (req.path === '/health' || !process.env.ADMIN_PASSWORD) {
    return next();
  }
  
  return basicAuth(req, res, next);
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration constants
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024;
const MAX_FILES = parseInt(process.env.MAX_FILES_PER_UPLOAD || '1');

// Configure multer for file uploads
const upload = multer({ 
  dest: path.join(__dirname, 'uploads'),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES
  },
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

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Upload boundaries.geojson
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    // Validate file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { resortName } = req.body;
    if (!resortName || !resortName.trim()) {
      return res.status(400).json({ error: 'Resort name is required' });
    }

    // Sanitize resort name
    const sanitizedName = sanitizeResortName(resortName);
    if (!sanitizedName) {
      return res.status(400).json({ error: 'Invalid resort name. Use only letters, numbers, hyphens, and underscores.' });
    }

    const resortDir = path.join(ROOT_DIR, 'data', sanitizedName);
    await ensureDir(resortDir);

    // Validate file size
    if (req.file.size === 0) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Uploaded file is empty' });
    }

    // Validate GeoJSON structure
    let fileContent, geojson;
    try {
      fileContent = await fs.readFile(req.file.path, 'utf8');
    } catch (readError) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Could not read uploaded file' });
    }

    try {
      geojson = JSON.parse(fileContent);
    } catch (parseError) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Invalid JSON format' });
    }
    
    // Validate GeoJSON structure
    if (!geojson.type || geojson.type !== 'FeatureCollection') {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'File must be a GeoJSON FeatureCollection' });
    }

    if (!Array.isArray(geojson.features) || geojson.features.length === 0) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'GeoJSON must contain at least one feature' });
    }

    // Check for required zone types
    const hasSkiAreaBoundary = geojson.features.some(f => 
      f.properties?.ZoneType === 'ski_area_boundary'
    );
    const hasFeatureBoundary = geojson.features.some(f => 
      f.properties?.ZoneType === 'feature_boundary'
    );
    
    if (!hasSkiAreaBoundary || !hasFeatureBoundary) {
      await fs.unlink(req.file.path);
      const missing = [];
      if (!hasSkiAreaBoundary) missing.push('ski_area_boundary');
      if (!hasFeatureBoundary) missing.push('feature_boundary');
      return res.status(400).json({ 
        error: `GeoJSON must contain features with ZoneType: ${missing.join(' and ')}` 
      });
    }

    // Copy file to resort directory (can't use rename across Docker volumes)
    const targetPath = path.join(resortDir, 'boundaries.geojson');
    await fs.copyFile(req.file.path, targetPath);
    await fs.unlink(req.file.path);

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
      // Get constants from Python to ensure consistency
      const constantsProcess = spawn('python3', [
        path.join(ROOT_DIR, 'scripts', 'export_constants.py')
      ], {
        cwd: ROOT_DIR
      });

      let constantsOutput = '';
      constantsProcess.stdout.on('data', (data) => {
        constantsOutput += data.toString();
      });

      await new Promise((resolve, reject) => {
        constantsProcess.on('close', (code) => {
          if (code === 0) {
            try {
              const constants = JSON.parse(constantsOutput);
              config[resortName] = {
                name: `${resortName.charAt(0).toUpperCase() + resortName.slice(1)} Resort`,
                data_files: {
                  boundaries: `data/${resortName}/boundaries.geojson`,
                  osm_features: `data/${resortName}/osm_features.geojson`
                },
                default_tree_type: 'tree:mixed',  // Default fallback tree type
                tree_config: {
                  min_area_for_trees: constants.area_thresholds.small_area_threshold / 2,
                  small_area_threshold: constants.area_thresholds.small_area_threshold,
                  medium_area_threshold: constants.area_thresholds.medium_area_threshold,
                  large_area_threshold: constants.area_thresholds.large_area_threshold,
                  extra_large_area_threshold: constants.area_thresholds.extra_large_area_threshold,
                  trees_per_small_hectare: constants.tree_densities.trees_per_small_hectare,
                  trees_per_medium_hectare: constants.tree_densities.trees_per_medium_hectare,
                  trees_per_large_hectare: constants.tree_densities.trees_per_large_hectare,
                  trees_per_extra_large_hectare: constants.tree_densities.trees_per_extra_large_hectare,
                  max_trees_per_polygon: constants.limits.max_trees_per_polygon,
                  min_trees_per_polygon: constants.limits.min_trees_per_polygon,
                  random_seed: constants.defaults.random_seed
                }
              };
              resolve();
            } catch (parseError) {
              reject(new Error('Failed to parse constants for new resort config'));
            }
          } else {
            reject(new Error('Failed to load constants for new resort config'));
          }
        });
      });
      
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
    
    // Update tree_config and default_tree_type
    config[req.params.name].tree_config = {
      ...config[req.params.name].tree_config,
      ...req.body.tree_config
    };
    
    // Update default_tree_type if provided
    if (req.body.default_tree_type) {
      config[req.params.name].default_tree_type = req.body.default_tree_type;
    }
    
    await fs.writeFile(configPath, yaml.dump(config), 'utf8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process resort
app.get('/api/process/:name', async (req, res) => {
  try {
    const resortName = sanitizeResortName(req.params.name);
    if (!resortName) {
      return res.status(400).json({ error: 'Invalid resort name' });
    }
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
      if (code === 0) {
        res.write(`data: ${JSON.stringify({ type: 'success', message: 'Processing completed successfully' })}\n\n`);
      } else {
        const errorMsg = `Processing failed with exit code ${code}. Check the output above for details.`;
        res.write(`data: ${JSON.stringify({ type: 'error', message: errorMsg })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
      res.end();
    });

    pythonProcess.on('error', (error) => {
      const errorMsg = `Failed to start processing: ${error.message}`;
      res.write(`data: ${JSON.stringify({ type: 'error', message: errorMsg })}\n\n`);
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      if (!pythonProcess.killed) {
        pythonProcess.kill();
        console.log(`Terminated processing for ${resortName} due to client disconnect`);
      }
    });

  } catch (error) {
    console.error('Process endpoint error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error', 
        details: process.env.NODE_ENV === 'development' ? error.message : 'Processing failed'
      });
    }
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
    const resortName = sanitizeResortName(req.params.resort);
    const fileName = sanitizeFileName(req.params.file);
    
    if (!resortName || !fileName) {
      return res.status(400).json({ error: 'Invalid resort name or file name' });
    }
    
    const filePath = path.join(ROOT_DIR, 'output', resortName, fileName);
    
    // Ensure the resolved path is still within the expected directory
    const resolvedPath = path.resolve(filePath);
    const expectedDir = path.resolve(path.join(ROOT_DIR, 'output'));
    if (!resolvedPath.startsWith(expectedDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await fs.access(filePath);
    res.download(filePath);
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

// Delete processed files for a resort
app.delete('/api/resort/:name/processed', async (req, res) => {
  try {
    const resortName = sanitizeResortName(req.params.name);
    if (!resortName) {
      return res.status(400).json({ error: 'Invalid resort name' });
    }
    
    const outputDir = path.join(ROOT_DIR, 'output', resortName);
    
    // Check if output directory exists
    try {
      await fs.access(outputDir);
    } catch {
      return res.status(404).json({ error: 'No processed files found for this resort' });
    }
    
    // Remove all files in the output directory
    const files = await fs.readdir(outputDir);
    for (const file of files) {
      await fs.unlink(path.join(outputDir, file));
    }
    
    // Remove the output directory
    await fs.rmdir(outputDir);
    
    res.json({ success: true, message: 'Processed files deleted successfully' });
  } catch (error) {
    console.error('Delete processed files error:', error);
    res.status(500).json({ error: 'Failed to delete processed files' });
  }
});

// Delete OSM files for a resort
app.delete('/api/resort/:name/osm', async (req, res) => {
  try {
    const resortName = sanitizeResortName(req.params.name);
    if (!resortName) {
      return res.status(400).json({ error: 'Invalid resort name' });
    }
    
    const osmFile = path.join(ROOT_DIR, 'data', resortName, 'osm_features.geojson');
    
    // Check if OSM file exists
    try {
      await fs.access(osmFile);
    } catch {
      return res.status(404).json({ error: 'No OSM file found for this resort' });
    }
    
    // Remove the OSM file
    await fs.unlink(osmFile);
    
    res.json({ success: true, message: 'OSM file deleted successfully' });
  } catch (error) {
    console.error('Delete OSM file error:', error);
    res.status(500).json({ error: 'Failed to delete OSM file' });
  }
});

// Delete boundary files for a resort
app.delete('/api/resort/:name/boundaries', async (req, res) => {
  try {
    const resortName = sanitizeResortName(req.params.name);
    if (!resortName) {
      return res.status(400).json({ error: 'Invalid resort name' });
    }
    
    const boundaryFile = path.join(ROOT_DIR, 'data', resortName, 'boundaries.geojson');
    
    // Check if boundary file exists
    try {
      await fs.access(boundaryFile);
    } catch {
      return res.status(404).json({ error: 'No boundary file found for this resort' });
    }
    
    // Remove the boundary file
    await fs.unlink(boundaryFile);
    
    res.json({ success: true, message: 'Boundary file deleted successfully' });
  } catch (error) {
    console.error('Delete boundary file error:', error);
    res.status(500).json({ error: 'Failed to delete boundary file' });
  }
});

// Delete entire resort (all files and configuration)
app.delete('/api/resort/:name', async (req, res) => {
  try {
    const resortName = sanitizeResortName(req.params.name);
    if (!resortName) {
      return res.status(400).json({ error: 'Invalid resort name' });
    }
    
    const dataDir = path.join(ROOT_DIR, 'data', resortName);
    const outputDir = path.join(ROOT_DIR, 'output', resortName);
    const configPath = path.join(ROOT_DIR, 'config', 'resorts.yaml');
    
    // Remove data directory if it exists
    try {
      await fs.access(dataDir);
      const dataFiles = await fs.readdir(dataDir);
      for (const file of dataFiles) {
        await fs.unlink(path.join(dataDir, file));
      }
      await fs.rmdir(dataDir);
    } catch {
      // Data directory might not exist
    }
    
    // Remove output directory if it exists
    try {
      await fs.access(outputDir);
      const outputFiles = await fs.readdir(outputDir);
      for (const file of outputFiles) {
        await fs.unlink(path.join(outputDir, file));
      }
      await fs.rmdir(outputDir);
    } catch {
      // Output directory might not exist
    }
    
    // Remove resort from configuration
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      const config = yaml.load(configContent) || {};
      delete config[resortName];
      await fs.writeFile(configPath, yaml.dump(config), 'utf8');
    } catch (error) {
      console.error('Error updating config:', error);
      // Continue even if config update fails
    }
    
    res.json({ success: true, message: 'Resort deleted successfully' });
  } catch (error) {
    console.error('Delete resort error:', error);
    res.status(500).json({ error: 'Failed to delete resort' });
  }
});

// Get constants from Python
app.get('/api/constants', (req, res) => {
  const pythonProcess = spawn('python3', [
    path.join(ROOT_DIR, 'scripts', 'export_constants.py')
  ], {
    cwd: ROOT_DIR
  });

  let output = '';
  let error = '';

  pythonProcess.stdout.on('data', (data) => {
    output += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    error += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code === 0) {
      try {
        const constants = JSON.parse(output);
        res.json(constants);
      } catch (parseError) {
        console.error('Error parsing constants JSON:', parseError);
        res.status(500).json({ error: 'Failed to parse constants' });
      }
    } else {
      console.error('Error getting constants:', error);
      res.status(500).json({ error: 'Failed to load constants' });
    }
  });
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