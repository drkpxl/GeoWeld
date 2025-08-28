# GeoWeld 🏔️

A comprehensive geospatial processing platform for ski resort boundary and OSM feature data. Transform raw geographic data into enriched GeoJSON files with automatically generated tree distributions, featuring a complete web application for end-to-end resort data management.

## ✨ Key Features

### 🌐 Complete Web Application
- **4-Tab Interface**: Dashboard, Upload, Configure & Process, View Results
- **Responsive Design**: Mobile-first design that works on all devices  
- **Dark/Light Mode**: Theme toggle with persistent preferences
- **Real-time Processing**: Live output streaming with color-coded logs
- **URL State Management**: Deep linking and browser navigation support

### 🌲 Advanced Tree Generation
- **Intelligent Tiered Density**: Area-based tree generation (Small: 5/ha, Medium: 40/ha, Large: 100/ha, XL: 300/ha)
- **Smart Tree Classification**: Preserves OSM leaf_type data, falls back to resort defaults
- **Rejection Sampling**: Ensures 100% accurate tree placement within polygon boundaries
- **Tree Type Support**: Needle, Broad, and Mixed forest types with visual differentiation

### 🗺️ Interactive Map Visualization  
- **Multi-layer Display**: Boundaries, zones, forests, individual trees, and rock features
- **Click to Explore**: Interactive feature selection with detailed property panels
- **Auto-fit Bounds**: Intelligent zoom to show all resort features
- **Visual Legend**: Clear symbology for all map elements
- **Feature Statistics**: Real-time counts and area calculations

### 📊 Comprehensive Data Management
- **File Upload & Validation**: GeoJSON validation with detailed error reporting  
- **Resort Configuration**: Per-resort tree density and type settings
- **Batch Operations**: Process multiple resorts or individual customization
- **Download Management**: Access all processed files with organized output structure

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

### 3. Complete Workflow
1. **📁 Upload**: Add your ski resort boundary GeoJSON file with validation
2. **⚙️ Configure**: Set tree generation parameters and default tree types  
3. **🔄 Process**: Watch real-time processing with live log output
4. **🗺️ Visualize**: Explore results on interactive Mapbox map with feature details
5. **📥 Download**: Get processed GeoJSON files with enhanced data

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

## 📊 Web Interface Overview

### Dashboard Tab 📊
- **Resort Management**: View all resorts with quick actions (Configure, View Map, Download, Delete)  
- **Summary Statistics**: Total resorts, processed count, and processing status
- **Quick Navigation**: Direct access to configure and view functions

### Upload Data Tab 📁
- **Resort Creation**: Enter resort name and upload boundary GeoJSON files
- **File Validation**: Real-time validation with detailed error reporting
- **Requirements Check**: Ensures proper `ski_area_boundary` and zone type structure
- **File Limits**: Supports up to 50MB GeoJSON files

### Configure & Process Tab ⚙️
- **Tree Type Selection**: Choose default tree type (Mixed, Needle, or Broad)
- **Dynamic Density Settings**:
  - Trees per Small Hectare (< 2.5 ha) - Default: 5 trees/ha
  - Trees per Medium Hectare (2.5-10 ha) - Default: 40 trees/ha  
  - Trees per Large Hectare (10-20 ha) - Default: 100 trees/ha
  - Trees per Extra Large Hectare (> 20 ha) - Default: 300 trees/ha
  - Maximum trees per polygon - Default: 300
- **Real-time Processing**: Live log output with color-coded status messages
- **Configuration Persistence**: Settings saved per resort in YAML format

### View Results Tab 🗺️
- **Interactive Map**: Mapbox-powered visualization with multiple layers
  - Boundaries (ski area in blue, features in purple)
  - Zone types (slow zones, closed areas, beginner areas)
  - Forest polygons with area calculations
  - Individual tree points (color-coded by type)
  - Rock formations and natural features
- **Feature Interaction**: Click any feature to view detailed properties
- **Statistics Dashboard**: Live counts of trees, forests, and boundaries
- **File Downloads**: Access all processed GeoJSON files

## 📋 Data Requirements

### Input File Structure
Upload your boundary data via the web interface. Required structure:

**boundaries.geojson Properties:**
- `ZoneType`: Must include `ski_area_boundary` and can include:
  - `slow_zone`, `closed_area`, `beginner_area` for additional zones

**Automatic OSM Data:**
- Forest features automatically fetched from OpenStreetMap
- Rock and natural features included from OSM
- `leaf_type` preserved when available (`needleleaved`, `broadleaved`, `mixed`)

## 🎯 Primary Usage - Web Interface

GeoWeld is designed as a **web-first application**. Most users should use the web interface for the complete workflow:

1. **Start the application**: `docker compose up -d`
2. **Open browser**: Navigate to `http://localhost:4011`
3. **Upload data**: Use the Upload tab to add your resort boundary files
4. **Configure settings**: Adjust tree generation parameters in Configure tab  
5. **Process data**: Run processing with real-time log output
6. **View results**: Explore your data on the interactive map
7. **Download files**: Get processed GeoJSON files for your applications

## 🖥️ Advanced CLI Usage

<details>
<summary><strong>Command Line Interface (Advanced Users)</strong></summary>

For advanced users or automation workflows, direct CLI access is available:

### Process Single Resort
```bash
docker compose exec geoweld python scripts/process_resort.py --resort stratton
```

### Process with Custom Tree Density  
```bash
docker compose exec geoweld python scripts/process_resort.py --resort stratton --tree-density 20 --max-trees 50
```

### Batch Processing
```bash
# Process all configured resorts
docker compose exec geoweld python scripts/batch_process.py --all

# Process specific resorts  
docker compose exec geoweld python scripts/batch_process.py --resorts stratton mammoth
```

</details>

## 🔧 Configuration Options

### Web-Based Configuration (Recommended)
Configure resorts through the **Configure & Process** tab in the web interface:

- **Tree Type Selection**: Choose default for generated trees  
  - **🌲 Needle (Coniferous)** - High elevation, evergreen forests
  - **🍃 Broad (Deciduous)** - Temperate, deciduous regions
  - **🌳 Mixed** - Mixed forests or uncertain ecology
- **Dynamic Tree Density**: Adjust trees per hectare by polygon size
- **Processing Parameters**: Set maximum trees per polygon and area thresholds

**Smart Hierarchy:** OSM `leaf_type` data → Resort default → System fallback

### Advanced YAML Configuration

<details>
<summary><strong>Manual Configuration (Advanced)</strong></summary>

For direct configuration file editing:

```yaml
resort_name:
  name: "Resort Display Name"
  default_tree_type: "tree:needle"    # tree:needle, tree:broad, or tree:mixed
  data_files:
    boundaries: "data/resort_name/boundaries.geojson"
    osm_features: "data/resort_name/osm_features.geojson"
  tree_config:
    min_area_for_trees: 5000          # sq meters
    trees_per_small_hectare: 5        # < 2.5 hectares  
    trees_per_medium_hectare: 40      # 2.5-10 hectares
    trees_per_large_hectare: 100      # 10-20 hectares
    trees_per_xl_hectare: 300         # > 20 hectares
    max_trees_per_polygon: 300        # absolute maximum
    random_seed: 42
```

</details>

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

GeoWeld uses an advanced **4-tier density system** based on forest polygon area:

| Area Range | Default Density | Typical Use Case |
|------------|----------------|------------------|
| **Small** (< 2.5 ha) | 5 trees/hectare | Edge forests, clearings |
| **Medium** (2.5-10 ha) | 40 trees/hectare | Standard forest patches |
| **Large** (10-20 ha) | 100 trees/hectare | Dense forest areas |
| **Extra Large** (> 20 ha) | 300 trees/hectare | Major forest blocks |

**Advanced Features:**
- **Smart Type Inheritance**: Generated trees inherit parent polygon tree type
- **Rejection Sampling**: Guarantees 100% accurate placement within boundaries  
- **Coordinate Precision**: Uses EPSG:3857 for accurate area calculations
- **Deterministic Results**: Same seed produces identical tree placement
- **Configurable Limits**: Maximum 300 trees per polygon (adjustable)
- **OSM Data Respect**: Preserves original tree data from OpenStreetMap

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

## 🔍 Technical Architecture

### Frontend Stack
- **React 18**: Modern component-based UI with hooks
- **Tailwind CSS**: Utility-first responsive design system
- **Mapbox GL JS**: Interactive vector tile mapping
- **Custom State Management**: Centralized app state with URL synchronization

### Backend Stack  
- **Node.js/Express**: RESTful API server with real-time capabilities
- **Python Integration**: Subprocess execution for geospatial processing
- **YAML Configuration**: Human-readable resort configuration files
- **File Management**: Secure upload/download with validation

### Key Features
- **Real-time Processing**: Server-sent events for live log streaming
- **Responsive Design**: Mobile-first approach with dark/light themes
- **Error Handling**: Comprehensive validation and user-friendly error messages  
- **Security**: Input sanitization and path traversal protection
- **Performance**: Optimized map rendering with efficient data loading

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

## 🎯 Perfect For

- **🏔️ Ski Resort Operators**: Visualize and manage resort boundaries with enhanced forest data
- **🗺️ GIS Professionals**: Generate realistic tree distributions for spatial analysis
- **📊 Environmental Consultants**: Analyze forest coverage and tree density patterns
- **🎿 Resort Developers**: Plan facilities with accurate forest and terrain data
- **🌲 Land Managers**: Understand forest composition and spatial distribution

**Transform your geospatial forest data with GeoWeld!** 🏔️⛷️