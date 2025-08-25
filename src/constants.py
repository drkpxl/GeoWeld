"""
Constants for GeoJSON processing
"""

# Area thresholds (square meters)
SMALL_AREA_THRESHOLD = 3000      # 0.5 hectares
MEDIUM_AREA_THRESHOLD = 20000    # 2.5 hectares
LARGE_AREA_THRESHOLD = 100000    # 10 hectares

# Default tree density settings (trees per hectare)
DEFAULT_TREES_PER_SMALL_HECTARE = 2
DEFAULT_TREES_PER_MEDIUM_HECTARE = 4
DEFAULT_TREES_PER_LARGE_HECTARE = 15

# Processing limits
MAX_TREE_ATTEMPTS = 100          # Maximum attempts to place a single tree
DEFAULT_MAX_TREES_PER_POLYGON = 40  # Default maximum trees per polygon
MIN_TREES_PER_POLYGON = 1        # Minimum trees per polygon

# Area conversion constants
HECTARE_TO_SQ_METERS = 10000     # 1 hectare = 10,000 square meters

# Default random seed for reproducible results
DEFAULT_RANDOM_SEED = 42

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