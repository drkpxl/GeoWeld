#!/usr/bin/env python3
"""
Main script for processing ski resort GeoJSON data.
"""

import argparse
import json
import os
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.processor import ResortProcessor
from src.constants import CONFIG_FILE, OUTPUT_DIR


def main():
    """Main processing function with command line interface."""
    parser = argparse.ArgumentParser(
        description="Process ski resort GeoJSON data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/process_resort.py --resort stratton
  python scripts/process_resort.py --resort stratton --output custom_output/
  python scripts/process_resort.py --resort stratton --tree-density 20 --max-trees 50
        """
    )
    
    parser.add_argument(
        '--resort', 
        required=True,
        help='Resort name to process (e.g., stratton, mammoth)'
    )
    
    parser.add_argument(
        '--output',
        default=OUTPUT_DIR,
        help=f'Output directory (default: {OUTPUT_DIR})'
    )
    
    parser.add_argument(
        '--config',
        default=CONFIG_FILE,
        help=f'Configuration file path (default: {CONFIG_FILE})'
    )
    
    parser.add_argument(
        '--tree-density',
        type=int,
        help='Override tree density for large areas (trees per hectare)'
    )
    
    parser.add_argument(
        '--max-trees',
        type=int,
        help='Override maximum trees per polygon'
    )
    
    parser.add_argument(
        '--validate-only',
        action='store_true',
        help='Only validate input files, do not process'
    )
    
    args = parser.parse_args()
    
    try:
        print(f"Processing {args.resort.title()} Mountain Resort...")
        
        # Initialize processor
        processor = ResortProcessor(args.resort, args.config)
        
        # Apply command line overrides
        if args.tree_density:
            processor.resort_config['tree_config']['trees_per_large_hectare'] = args.tree_density
        if args.max_trees:
            processor.resort_config['tree_config']['max_trees_per_polygon'] = args.max_trees
        
        if args.validate_only:
            # Just validate input files
            print("  Validating input files...")
            boundaries_gdf, features_gdf = processor.load_data()
            print(f"  ✓ Boundary file: {len(boundaries_gdf)} features")
            print(f"  ✓ OSM features file: {len(features_gdf)} features")
            print(f"  ✓ Ski area boundary extracted successfully")
            return
        
        # Process the resort
        print("  Processing features...")
        output_geojson = processor.create_output_geojson()
        
        # Create output directory
        output_dir = Path(args.output)
        resort_output_dir = output_dir / args.resort
        resort_output_dir.mkdir(parents=True, exist_ok=True)
        
        # Save GeoJSON output
        output_file = resort_output_dir / f"{args.resort}_processed.geojson"
        with open(output_file, 'w') as f:
            json.dump(output_geojson, f, indent=2)
        
        # Print summary
        metadata = output_geojson['metadata']
        print(f"\n✓ Successfully created {output_file}")
        print(f"\nFeature Summary:")
        print(f"  Total features: {metadata['total_features']:,}")
        print(f"  - Boundary features: {metadata['boundary_features']}")
        print(f"  - Forest areas: {metadata['forest_features']}")
        print(f"  - Individual trees: {metadata['tree_points']:,}")
        print(f"  - Rock features: {metadata['rock_features']}")
        
        tree_config = metadata['tree_config']
        print(f"\nTree Configuration:")
        print(f"  - Min area: {tree_config['min_area_for_trees']:,} sq meters")
        print(f"  - Density (S/M/L): {tree_config['trees_per_small_hectare']}/{tree_config['trees_per_medium_hectare']}/{tree_config['trees_per_large_hectare']} trees/hectare")
        print(f"  - Max trees per polygon: {tree_config['max_trees_per_polygon']}")
        print(f"  - Random seed: {tree_config['random_seed']}")
        
        if 'center' in metadata:
            print(f"\nResort center: {metadata['center']}")
        if 'zoom' in metadata:
            print(f"Default zoom: {metadata['zoom']}")
        
    except Exception as e:
        print(f"Error processing {args.resort}: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    print(f"\nProcessing complete! Output saved to {resort_output_dir}/")


if __name__ == "__main__":
    main()