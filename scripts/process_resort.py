#!/usr/bin/env python3
"""
Main script for processing ski resort GeoJSON data.
"""

import argparse
import json
import os
import sys
import yaml
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
  python scripts/process_resort.py                # Process all resorts
  python scripts/process_resort.py --resort stratton
  python scripts/process_resort.py --resort stratton --output custom_output/
  python scripts/process_resort.py --resort stratton --tree-density 20 --max-trees 50
        """
    )
    
    parser.add_argument(
        '--resort', 
        help='Resort name to process (e.g., stratton, mammoth). If not specified, processes all resorts.'
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
    
    # Load configuration to get list of resorts
    try:
        with open(args.config, 'r') as f:
            config = yaml.safe_load(f)
    except FileNotFoundError:
        print(f"Error: Configuration file {args.config} not found")
        sys.exit(1)
    except yaml.YAMLError as e:
        print(f"Error parsing configuration file: {e}")
        sys.exit(1)
    
    # Determine which resorts to process
    if args.resort:
        # Process single specified resort
        if args.resort not in config:
            print(f"Error: Resort '{args.resort}' not found in configuration")
            print(f"Available resorts: {', '.join(config.keys())}")
            sys.exit(1)
        resorts_to_process = [args.resort]
    else:
        # Process all resorts
        resorts_to_process = list(config.keys())
        print(f"Processing all {len(resorts_to_process)} resorts in configuration...")
    
    # Track processing results
    successful = []
    failed = []
    
    for resort_name in resorts_to_process:
        try:
            print(f"\nProcessing {resort_name.title()} Mountain Resort...")
            
            # Initialize processor
            processor = ResortProcessor(resort_name, args.config)
            
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
                successful.append(resort_name)
                continue
            
            # Process the resort
            print("  Processing features...")
            output_geojson = processor.create_output_geojson()
            
            # Create output directory
            output_dir = Path(args.output)
            resort_output_dir = output_dir / resort_name
            resort_output_dir.mkdir(parents=True, exist_ok=True)
            
            # Save GeoJSON output
            output_file = resort_output_dir / f"{resort_name}_processed.geojson"
            with open(output_file, 'w') as f:
                json.dump(output_geojson, f, indent=2)
            
            # Print summary
            metadata = output_geojson['metadata']
            print(f"  ✓ Successfully created {output_file}")
            print(f"  Feature Summary:")
            print(f"    Total features: {metadata['total_features']:,}")
            print(f"    - Boundary features: {metadata['boundary_features']}")
            print(f"    - Forest areas: {metadata['forest_features']}")
            # Handle both old and new metadata formats for backward compatibility
            if 'tree_points_total' in metadata:
                print(f"    - Individual trees: {metadata['tree_points_total']:,}")
                if metadata.get('tree_points_osm', 0) > 0:
                    print(f"      • OSM trees: {metadata['tree_points_osm']:,}")
                print(f"      • Generated trees: {metadata['tree_points_generated']:,}")
            elif 'tree_points' in metadata:
                print(f"    - Individual trees: {metadata['tree_points']:,}")
            print(f"    - Rock features: {metadata['rock_features']}")
            
            successful.append(resort_name)
            
        except Exception as e:
            print(f"  ✗ Error processing {resort_name}: {e}")
            failed.append((resort_name, str(e)))
            if len(resorts_to_process) == 1:
                # If processing single resort, show full traceback
                import traceback
                traceback.print_exc()
                sys.exit(1)
    
    # Print final summary for multi-resort processing
    if len(resorts_to_process) > 1:
        print("\n" + "="*50)
        print("Processing Complete")
        print("="*50)
        print(f"Successful: {len(successful)}/{len(resorts_to_process)}")
        if successful:
            print(f"  Processed: {', '.join(successful)}")
        if failed:
            print(f"Failed: {len(failed)}")
            for resort, error in failed:
                print(f"  - {resort}: {error}")
            sys.exit(1)
    
    print(f"\nProcessing complete! Output saved to {args.output}/")


if __name__ == "__main__":
    main()