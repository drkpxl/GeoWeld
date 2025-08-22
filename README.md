# GeoJSON Processor Standalone

A standalone Python tool for processing ski resort boundary and OSM feature data into combined GeoJSON files with generated tree points.

## Features

- Clips OSM features (forests, rocks) to ski resort boundaries
- Generates individual tree points within forest polygons using tiered density algorithms
- Processes boundary zones (slow zones, closed areas, beginner areas)
- Outputs combined GeoJSON files with enriched properties

## Installation

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

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

## Configuration

Edit `config/resorts.yaml` to configure resorts:

```yaml
resort_name:
  name: "Resort Display Name"
  center: [-72.907706, 43.101027]  # Longitude, Latitude
  zoom: 14
  
  data_files:
    boundaries: "data/resort_name/boundaries.geojson"
    osm_features: "data/resort_name/osm_features.geojson"
  
  tree_config:
    min_area_for_trees: 5000        # sq meters
    trees_per_small_hectare: 2      # for areas < 2.5 hectares
    trees_per_medium_hectare: 4     # for areas 2.5-10 hectares
    trees_per_large_hectare: 15     # for areas > 10 hectares
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

## Tree Generation Algorithm

The processor uses a tiered density system:
- **Small areas** (< 2.5 hectares): 2 trees per hectare
- **Medium areas** (2.5-10 hectares): 4 trees per hectare  
- **Large areas** (> 10 hectares): 15 trees per hectare
- Maximum trees per polygon: 40 (configurable)

Trees are placed using rejection sampling to ensure they fall within polygon boundaries.