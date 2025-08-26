# GeoWeld 🏔️

A comprehensive geospatial processing platform for ski resort boundary and OSM feature data. Transform raw geographic data into enriched GeoJSON files with automatically generated tree distributions, complete with an intuitive web interface.

## ✨ Features

- **🌐 Web Interface**: Upload boundaries, configure settings, and process data through an intuitive web UI
- **🌲 Smart Tree Generation**: Automatically generates realistic tree distributions within forest polygons
- **🎿 Resort-Specific Configuration**: Customizable tree types and densities per resort
- **🗺️ Interactive Preview**: Built-in map visualization with Mapbox integration  
- **🔧 Flexible Processing**: Clips OSM features to ski boundaries with configurable parameters
- **📊 Rich Output**: Combined GeoJSON with styling properties and metadata

## 🚀 Quick Start (Docker - Recommended)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed
- [Mapbox API token](https://account.mapbox.com/access-tokens/) (free tier available)

### 1. Download and Start
```bash
# Download the latest release
curl -L https://github.com/drkpxl/GeoWeld/releases/latest/download/docker-compose.yml -o docker-compose.yml

# Configure environment
curl -L https://github.com/drkpxl/GeoWeld/releases/latest/download/.env.example -o .env
# Edit .env and add your Mapbox token

# Start GeoWeld
docker compose up -d
```

### 2. Access Web Interface
Open http://localhost:4011 in your browser

### 3. Process Your Data
1. **Upload** your ski resort boundary GeoJSON file  
2. **Configure** tree generation settings and default tree types
3. **Process** - watch real-time output as OSM data is fetched and processed
4. **Preview** results on an interactive map
5. **Download** your processed GeoJSON files

## 📋 Alternative Installation Methods

<details>
<summary><strong>Development Setup</strong></summary>

For local development with hot reload:

```bash
git clone https://github.com/drkpxl/GeoWeld.git
cd GeoWeld
cp .env.example .env
# Edit .env with your configuration

# Start development environment
docker compose -f docker-compose.dev.yml up
```
</details>

<details>
<summary><strong>Native Python Installation</strong></summary>

```bash
# Clone repository
git clone https://github.com/drkpxl/GeoWeld.git
cd GeoWeld

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Node.js dependencies for web interface
cd web && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start web server
cd web && npm start
```
</details>

## Data Structure

Place your input data in the `data/` directory:

```
data/
└── resort_name/
    ├── boundaries.geojson    # Resort boundary polygons with ZoneType property
    └── osm_features.geojson  # OSM forest and rock features
```

### Required GeoJSON Properties

**boundaries.geojson:**
- `ZoneType`: One of `ski_area_boundary`, `slow_zone`, `closed_area`, `beginner_area`

**osm_features.geojson:**
- `landuse`: `forest` for forest features
- `natural`: `wood`, `rock`, `cliff`, `scree` for natural features
- `leaf_type`: (optional) `needleleaved`, `broadleaved`, or `mixed`

## Usage

### Process Single Resort

```bash
python scripts/process_resort.py --resort stratton
```

### Process with Custom Tree Density

```bash
python scripts/process_resort.py --resort stratton --tree-density 20 --max-trees 50
```

### Batch Processing

```bash
# Process all configured resorts
python scripts/batch_process.py --all

# Process specific resorts
python scripts/batch_process.py --resorts stratton mammoth
```

## 🔧 Configuration

### Tree Type Configuration
GeoWeld supports three tree type defaults that are used when OSM data doesn't specify `leaf_type`:

- **🌲 Needle (coniferous/evergreen)** - Perfect for high elevation resorts like Mammoth Mountain
- **🍃 Broad (deciduous/broadleaved)** - Ideal for temperate deciduous forest regions  
- **🌳 Mixed (deciduous + coniferous)** - For mixed forests or uncertain ecology

**Priority:** OSM `leaf_type` data always takes precedence over defaults when available.

### Advanced Configuration

For manual configuration, edit `config/resorts.yaml`:

```yaml
resort_name:
  name: "Resort Display Name"
  default_tree_type: "tree:needle"    # tree:needle, tree:broad, or tree:mixed
  data_files:
    boundaries: "data/resort_name/boundaries.geojson"
    osm_features: "data/resort_name/osm_features.geojson"
  tree_config:
    min_area_for_trees: 5000          # sq meters
    trees_per_small_hectare: 2        # for areas < 2.5 hectares  
    trees_per_medium_hectare: 4       # for areas 2.5-10 hectares
    trees_per_large_hectare: 15       # for areas > 10 hectares
    max_trees_per_polygon: 40
    random_seed: 42
```

## Output

Processed GeoJSON files are saved to:
```
output/resort_name/resort_name_processed.geojson
```

Each output file contains:
- Boundary zones with styling properties
- Forest polygons with area metadata
- Individual tree points generated within forests
- Rock features
- Processing metadata including feature counts and configuration

## 🌲 Tree Generation Algorithm

The processor uses an intelligent tiered density system:
- **Small areas** (< 2.5 hectares): 2 trees per hectare
- **Medium areas** (2.5-10 hectares): 4 trees per hectare  
- **Large areas** (> 10 hectares): 15 trees per hectare
- Maximum trees per polygon: 40 (configurable)

**Key Features:**
- **100% Inheritance**: Generated tree points inherit exact tree type from parent forest polygon
- **Rejection Sampling**: Ensures all trees fall within polygon boundaries
- **Coordinate Transformation**: Uses EPSG:3857 for accurate area calculations
- **Deterministic Placement**: Same seed produces identical results

## 🐳 Docker Workflow

### Production Deployment
```bash
# Pull latest image and start
docker compose pull
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Development Workflow
```bash
# Development mode with hot reload
docker compose -f docker-compose.dev.yml up

# Build custom image
docker build -t geoweld:custom .

# Run with custom image
docker run -p 4011:4011 -v $(pwd)/data:/app/data geoweld:custom
```

## 📖 Command Line Interface

<details>
<summary><strong>CLI Commands (Advanced Users)</strong></summary>

Access the container for direct CLI usage:

```bash
# Execute commands in running container
docker compose exec geoweld python scripts/process_resort.py --resort mammoth

# Or run one-off commands
docker compose run --rm geoweld python scripts/batch_process.py --all
```

### Available Commands:
```bash
# Process single resort
python scripts/process_resort.py --resort stratton

# Custom tree density
python scripts/process_resort.py --resort stratton --tree-density 20 --max-trees 50

# Batch processing
python scripts/batch_process.py --all
python scripts/batch_process.py --resorts stratton mammoth
```
</details>

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test with: `docker compose -f docker-compose.dev.yml up`
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Perfect for ski resort operators, GIS professionals, and anyone working with geospatial forest data!** 🏔️⛷️