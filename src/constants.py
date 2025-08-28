"""
Constants for GeoJSON processing
"""

# Area thresholds (square meters)
SMALL_AREA_THRESHOLD = 1      # 0.0001 hectares
MEDIUM_AREA_THRESHOLD = 20000    # 2.5 hectares
LARGE_AREA_THRESHOLD = 100000    # 10 hectares
EXTRA_LARGE_AREA_THRESHOLD = 200000  # 20 hectares

# Default tree density settings (trees per hectare)
DEFAULT_TREES_PER_SMALL_HECTARE = 4
DEFAULT_TREES_PER_MEDIUM_HECTARE = 10
DEFAULT_TREES_PER_LARGE_HECTARE = 20
DEFAULT_TREES_PER_EXTRA_LARGE_HECTARE = 40

# Processing limits
MAX_TREE_ATTEMPTS = 100          # Maximum attempts to place a single tree
DEFAULT_MAX_TREES_PER_POLYGON = 1000  # Default maximum trees per polygon
MIN_TREES_PER_POLYGON = 1        # Minimum trees per polygon

# Network and API configuration
DEFAULT_OSM_BUFFER_DEGREES = 0.005   # ~500m buffer around boundaries for OSM data fetch
DEFAULT_OSM_TIMEOUT = 30             # Timeout for OSM API requests in seconds
DEFAULT_OSM_RETRY_DELAY = 5          # Delay between OSM API retries in seconds
DEFAULT_OSM_MAX_RETRIES = 3          # Maximum number of OSM API retries

# Area conversion constants
HECTARE_TO_SQ_METERS = 10000     # 1 hectare = 10,000 square meters

# Default random seed for reproducible results
DEFAULT_RANDOM_SEED = 42

# Memory optimization constants
CHUNK_SIZE_FEATURES = 1000       # Process features in chunks of this size
LARGE_DATASET_THRESHOLD = 5000   # Features threshold to enable chunked processing
GC_INTERVAL = 500               # Trigger garbage collection every N processed features

# Timestamp format
TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M:%S"

# Default zone styling
DEFAULT_ZONE_STYLES = {
    "slow_zone": {
        "stroke_color": "#FFFF00",
        "stroke_opacity": 1.0,
        "fill_color": "#FFFF00",
        "fill_opacity": 0.5
    },
    "closed_area": {
        "stroke_color": "#FF0000",
        "stroke_opacity": 1.0,
        "fill_color": "#FF0000",
        "fill_opacity": 0.7
    },
    "beginner_area": {
        "stroke_color": "#FFFF00",
        "stroke_opacity": 1.0,
        "fill_color": "#FFFF00",
        "fill_opacity": 0.4
    },
    "ski_area_boundary": {
        "stroke_color": "#000000",
        "stroke_opacity": 1.0,
        "stroke_width": 3,
        "fill_color": "#000000",
        "fill_opacity": 0.1
    },
    "feature_boundary": {
        "stroke_color": "#008000",
        "stroke_opacity": 0.8,
        "stroke_width": 2,
        "fill_color": "#008000",
        "fill_opacity": 0.05
    }
}

# File paths
CONFIG_FILE = "config/resorts.yaml"
OUTPUT_DIR = "output"
DATA_DIR = "data"