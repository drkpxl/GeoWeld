#!/usr/bin/env python3
"""
Batch processing script for multiple ski resorts.
"""

import argparse
import json
import os
import sys
import yaml
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import List, Tuple

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.processor import ResortProcessor
from src.constants import CONFIG_FILE, OUTPUT_DIR


def process_single_resort(resort_name: str, config_file: str, output_dir: str) -> Tuple[str, bool, str]:
    """
    Process a single resort and return status.
    
    Returns:
        Tuple of (resort_name, success, message)
    """
    try:
        processor = ResortProcessor(resort_name, config_file)
        output_geojson = processor.create_output_geojson()
        
        # Create output directory
        resort_output_dir = Path(output_dir) / resort_name
        resort_output_dir.mkdir(parents=True, exist_ok=True)
        
        # Save GeoJSON output
        output_file = resort_output_dir / f"{resort_name}_processed.geojson"
        with open(output_file, 'w') as f:
            json.dump(output_geojson, f, indent=2)
        
        metadata = output_geojson['metadata']
        message = f"✓ {metadata['total_features']} features ({metadata['tree_points']} trees)"
        return (resort_name, True, message)
        
    except Exception as e:
        return (resort_name, False, f"✗ Error: {str(e)}")


def main():
    """Main batch processing function."""
    parser = argparse.ArgumentParser(
        description="Batch process multiple ski resort GeoJSON files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/batch_process.py --all
  python scripts/batch_process.py --resorts stratton mammoth
  python scripts/batch_process.py --all --parallel --max-workers 3
        """
    )
    
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        '--all',
        action='store_true',
        help='Process all resorts in configuration'
    )
    group.add_argument(
        '--resorts',
        nargs='+',
        help='Specific resort names to process'
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
        '--parallel',
        action='store_true',
        help='Process resorts in parallel'
    )
    
    parser.add_argument(
        '--max-workers',
        type=int,
        default=4,
        help='Maximum number of parallel workers (default: 4)'
    )
    
    args = parser.parse_args()
    
    # Load configuration to get resort list
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
    if args.all:
        resorts_to_process = list(config.keys())
    else:
        resorts_to_process = args.resorts
        # Validate resort names
        invalid_resorts = [r for r in resorts_to_process if r not in config]
        if invalid_resorts:
            print(f"Error: Unknown resorts: {', '.join(invalid_resorts)}")
            print(f"Available resorts: {', '.join(config.keys())}")
            sys.exit(1)
    
    print(f"Processing {len(resorts_to_process)} resort(s)...\n")
    
    # Process resorts
    results = []
    
    if args.parallel:
        # Parallel processing
        with ProcessPoolExecutor(max_workers=args.max_workers) as executor:
            futures = {
                executor.submit(process_single_resort, resort, args.config, args.output): resort
                for resort in resorts_to_process
            }
            
            for future in as_completed(futures):
                resort_name, success, message = future.result()
                results.append((resort_name, success, message))
                print(f"{resort_name:20} {message}")
    else:
        # Sequential processing
        for resort in resorts_to_process:
            print(f"Processing {resort}...", end=" ")
            resort_name, success, message = process_single_resort(resort, args.config, args.output)
            results.append((resort_name, success, message))
            print(message)
    
    # Print summary
    successful = sum(1 for _, success, _ in results if success)
    failed = len(results) - successful
    
    print(f"\n{'='*50}")
    print(f"Batch Processing Complete")
    print(f"{'='*50}")
    print(f"Total resorts: {len(results)}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    
    if failed > 0:
        print(f"\nFailed resorts:")
        for resort_name, success, message in results:
            if not success:
                print(f"  - {resort_name}: {message}")
        sys.exit(1)
    
    print(f"\nAll resorts processed successfully!")
    print(f"Output saved to {args.output}/")


if __name__ == "__main__":
    main()