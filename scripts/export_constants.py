#!/usr/bin/env python3
"""
Export Python constants as JSON for the web UI.
This ensures the web frontend uses the same values as the Python processing code.
"""

import json
import sys
import os

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src'))

try:
    from constants import (
        SMALL_AREA_THRESHOLD,
        MEDIUM_AREA_THRESHOLD, 
        LARGE_AREA_THRESHOLD,
        EXTRA_LARGE_AREA_THRESHOLD,
        DEFAULT_TREES_PER_SMALL_HECTARE,
        DEFAULT_TREES_PER_MEDIUM_HECTARE,
        DEFAULT_TREES_PER_LARGE_HECTARE,
        DEFAULT_TREES_PER_EXTRA_LARGE_HECTARE,
        DEFAULT_MAX_TREES_PER_POLYGON,
        MIN_TREES_PER_POLYGON,
        HECTARE_TO_SQ_METERS,
        DEFAULT_RANDOM_SEED
    )
    
    constants_data = {
        "area_thresholds": {
            "small_area_threshold": SMALL_AREA_THRESHOLD,
            "medium_area_threshold": MEDIUM_AREA_THRESHOLD,
            "large_area_threshold": LARGE_AREA_THRESHOLD,
            "extra_large_area_threshold": EXTRA_LARGE_AREA_THRESHOLD
        },
        "tree_densities": {
            "trees_per_small_hectare": DEFAULT_TREES_PER_SMALL_HECTARE,
            "trees_per_medium_hectare": DEFAULT_TREES_PER_MEDIUM_HECTARE,
            "trees_per_large_hectare": DEFAULT_TREES_PER_LARGE_HECTARE,
            "trees_per_extra_large_hectare": DEFAULT_TREES_PER_EXTRA_LARGE_HECTARE
        },
        "limits": {
            "max_trees_per_polygon": DEFAULT_MAX_TREES_PER_POLYGON,
            "min_trees_per_polygon": MIN_TREES_PER_POLYGON
        },
        "conversion": {
            "hectare_to_sq_meters": HECTARE_TO_SQ_METERS
        },
        "defaults": {
            "random_seed": DEFAULT_RANDOM_SEED
        }
    }
    
    print(json.dumps(constants_data))
    
except ImportError as e:
    print(f"Error importing constants: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"Error exporting constants: {e}", file=sys.stderr)
    sys.exit(1)