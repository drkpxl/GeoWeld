"""
Core GeoJSON processor for ski resort data
"""

import gc
import json
import logging
import random
import os
import yaml
from typing import List, Dict, Tuple, Optional, Any, Iterator, Generator
from datetime import datetime
from pathlib import Path
import pandas as pd
import geopandas as gpd
import numpy as np
from shapely.geometry import Point, Polygon, MultiPolygon, GeometryCollection
from shapely.ops import unary_union
from shapely import make_valid

from .constants import (
    SMALL_AREA_THRESHOLD, MEDIUM_AREA_THRESHOLD, LARGE_AREA_THRESHOLD, EXTRA_LARGE_AREA_THRESHOLD,
    DEFAULT_TREES_PER_SMALL_HECTARE, DEFAULT_TREES_PER_MEDIUM_HECTARE, DEFAULT_TREES_PER_LARGE_HECTARE, DEFAULT_TREES_PER_EXTRA_LARGE_HECTARE,
    MAX_TREE_ATTEMPTS, DEFAULT_MAX_TREES_PER_POLYGON, MIN_TREES_PER_POLYGON,
    HECTARE_TO_SQ_METERS, DEFAULT_RANDOM_SEED, TIMESTAMP_FORMAT,
    DEFAULT_ZONE_STYLES, DEFAULT_OSM_BUFFER_DEGREES, DEFAULT_OSM_TIMEOUT,
    DEFAULT_OSM_RETRY_DELAY, DEFAULT_OSM_MAX_RETRIES,
    CHUNK_SIZE_FEATURES, LARGE_DATASET_THRESHOLD, GC_INTERVAL
)
from .overpass import fetch_osm_features, get_bounds_from_boundaries

# Set up logger
logger = logging.getLogger(__name__)

def setup_logging(level=logging.INFO, log_file=None):
    """Configure logging for the application."""
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    
    # Root logger setup
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.addHandler(console_handler)
    
    # File handler if specified
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    
    return root_logger

class ValidationError(Exception):
    """Custom exception for data validation errors."""
    pass

class ResortProcessor:
    def __init__(self, resort_name: str, config_file: str = "config/resorts.yaml"):
        """Initialize with resort name and configuration."""
        self.resort_name = resort_name
        self.config = self._load_config(config_file)
        self.resort_config = self._get_resort_config()
        self.feature_boundary = None
        
    def _load_config(self, config_file: str) -> Dict[str, Any]:
        """Load resort configuration from YAML file."""
        try:
            with open(config_file, 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            raise FileNotFoundError(f"Configuration file {config_file} not found")
        except yaml.YAMLError as e:
            raise ValueError(f"Error parsing configuration file: {e}")
    
    def _get_resort_config(self) -> Dict[str, Any]:
        """Get configuration for specific resort."""
        if self.resort_name not in self.config:
            raise ValueError(f"Resort '{self.resort_name}' not found in configuration")
        
        resort_config = self.config[self.resort_name].copy()
        
        # Apply default tree config values
        tree_config = resort_config.get('tree_config', {})
        tree_config.setdefault('min_area_for_trees', SMALL_AREA_THRESHOLD)
        tree_config.setdefault('small_area_threshold', SMALL_AREA_THRESHOLD * 5)
        tree_config.setdefault('medium_area_threshold', MEDIUM_AREA_THRESHOLD * 4)
        tree_config.setdefault('large_area_threshold', LARGE_AREA_THRESHOLD)
        tree_config.setdefault('extra_large_area_threshold', EXTRA_LARGE_AREA_THRESHOLD)
        tree_config.setdefault('trees_per_small_hectare', DEFAULT_TREES_PER_SMALL_HECTARE)
        tree_config.setdefault('trees_per_medium_hectare', DEFAULT_TREES_PER_MEDIUM_HECTARE)
        tree_config.setdefault('trees_per_large_hectare', DEFAULT_TREES_PER_LARGE_HECTARE)
        tree_config.setdefault('trees_per_extra_large_hectare', DEFAULT_TREES_PER_EXTRA_LARGE_HECTARE)
        tree_config.setdefault('max_trees_per_polygon', DEFAULT_MAX_TREES_PER_POLYGON)
        tree_config.setdefault('min_trees_per_polygon', MIN_TREES_PER_POLYGON)
        tree_config.setdefault('random_seed', DEFAULT_RANDOM_SEED)
        resort_config['tree_config'] = tree_config
        
        # Apply default API config values
        api_config = resort_config.get('api_config', {})
        api_config.setdefault('osm_buffer_degrees', DEFAULT_OSM_BUFFER_DEGREES)
        api_config.setdefault('osm_timeout_seconds', DEFAULT_OSM_TIMEOUT)
        api_config.setdefault('osm_retry_delay_seconds', DEFAULT_OSM_RETRY_DELAY)
        api_config.setdefault('osm_max_retries', DEFAULT_OSM_MAX_RETRIES)
        resort_config['api_config'] = api_config
        
        return resort_config
    
    def validate_input_files(self, validate_only: bool = False) -> Dict[str, Any]:
        """Validate input files and return validation results."""
        results = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'file_info': {}
        }
        
        boundaries_file = self.resort_config['data_files']['boundaries']
        osm_file = self.resort_config['data_files']['osm_features']
        
        # Validate boundaries file
        try:
            boundaries_info = self._validate_boundaries_file(boundaries_file)
            results['file_info']['boundaries'] = boundaries_info
            logger.info(f"Boundaries file validation: {boundaries_info['features']} features, {len(boundaries_info['zone_types'])} zone types")
        except ValidationError as e:
            results['valid'] = False
            results['errors'].append(f"Boundaries file: {e}")
            logger.error(f"Boundaries validation failed: {e}")
        
        # Validate OSM file (if it exists)
        if os.path.exists(osm_file):
            try:
                osm_info = self._validate_osm_file(osm_file)
                results['file_info']['osm_features'] = osm_info
                logger.info(f"OSM file validation: {osm_info['features']} features, {len(osm_info['feature_types'])} types")
            except ValidationError as e:
                results['warnings'].append(f"OSM file: {e}")
                logger.warning(f"OSM validation warning: {e}")
        else:
            results['warnings'].append("OSM features file not found - will fetch from Overpass API if needed")
            logger.warning("OSM features file not found")
        
        # Validate configuration consistency
        try:
            self._validate_config_consistency()
            logger.info("Configuration validation passed")
        except ValidationError as e:
            results['valid'] = False
            results['errors'].append(f"Configuration: {e}")
            logger.error(f"Configuration validation failed: {e}")
        
        return results
    
    def _validate_boundaries_file(self, file_path: str) -> Dict[str, Any]:
        """Validate boundaries GeoJSON file structure and content."""
        if not os.path.exists(file_path):
            raise ValidationError(f"File not found: {file_path}")
        
        try:
            gdf = gpd.read_file(file_path)
        except Exception as e:
            raise ValidationError(f"Cannot read GeoJSON file: {e}")
        
        if gdf.empty:
            raise ValidationError("File contains no features")
        
        # Check required columns
        required_cols = ['ZoneType']
        missing_cols = [col for col in required_cols if col not in gdf.columns]
        if missing_cols:
            raise ValidationError(f"Missing required columns: {missing_cols}")
        
        # Check for required zone types
        zone_types = set(gdf['ZoneType'].dropna().unique())
        required_zones = {'ski_area_boundary', 'feature_boundary'}
        missing_zones = required_zones - zone_types
        if missing_zones:
            raise ValidationError(f"Missing required zone types: {missing_zones}")
        
        # Check geometry validity
        invalid_count = (~gdf.geometry.is_valid).sum()
        if invalid_count > 0:
            logger.warning(f"Found {invalid_count} invalid geometries in boundaries file")
        
        return {
            'features': len(gdf),
            'zone_types': list(zone_types),
            'invalid_geometries': invalid_count,
            'crs': str(gdf.crs)
        }
    
    def _validate_osm_file(self, file_path: str) -> Dict[str, Any]:
        """Validate OSM features GeoJSON file structure and content."""
        try:
            gdf = gpd.read_file(file_path)
        except Exception as e:
            raise ValidationError(f"Cannot read OSM file: {e}")
        
        if gdf.empty:
            raise ValidationError("OSM file contains no features")
        
        # Analyze feature types
        feature_types = []
        if 'natural' in gdf.columns:
            feature_types.extend(gdf['natural'].dropna().unique())
        if 'landuse' in gdf.columns:
            feature_types.extend(gdf['landuse'].dropna().unique())
        if 'leisure' in gdf.columns:
            feature_types.extend(gdf['leisure'].dropna().unique())
        
        # Check geometry validity
        invalid_count = (~gdf.geometry.is_valid).sum()
        if invalid_count > 0:
            logger.warning(f"Found {invalid_count} invalid geometries in OSM file")
        
        return {
            'features': len(gdf),
            'feature_types': list(set(feature_types)),
            'invalid_geometries': invalid_count,
            'crs': str(gdf.crs)
        }
    
    def _validate_config_consistency(self):
        """Validate configuration parameters for consistency and reasonable values."""
        tree_config = self.resort_config['tree_config']
        
        # Check tree density values
        if tree_config['trees_per_small_hectare'] <= 0:
            raise ValidationError("trees_per_small_hectare must be positive")
        
        if tree_config['trees_per_medium_hectare'] <= 0:
            raise ValidationError("trees_per_medium_hectare must be positive")
        
        if tree_config['trees_per_large_hectare'] <= 0:
            raise ValidationError("trees_per_large_hectare must be positive")
            
        if tree_config['trees_per_extra_large_hectare'] <= 0:
            raise ValidationError("trees_per_extra_large_hectare must be positive")
        
        # Check reasonable bounds
        if tree_config['max_trees_per_polygon'] > 1000:
            logger.warning("max_trees_per_polygon is very high (>1000), this may impact performance")
        
        if tree_config['small_area_threshold'] >= tree_config['medium_area_threshold']:
            raise ValidationError("small_area_threshold must be less than medium_area_threshold")
        
        if tree_config['medium_area_threshold'] >= 1000000:  # 100 hectares
            logger.warning("medium_area_threshold is very large, check if this is intended")
    
    def _should_use_chunked_processing(self, gdf: gpd.GeoDataFrame) -> bool:
        """Determine if chunked processing should be used based on dataset size."""
        return len(gdf) >= LARGE_DATASET_THRESHOLD
    
    def _chunk_geodataframe(self, gdf: gpd.GeoDataFrame, chunk_size: int = None) -> Generator[gpd.GeoDataFrame, None, None]:
        """Split GeoDataFrame into smaller chunks for memory-efficient processing."""
        if chunk_size is None:
            chunk_size = CHUNK_SIZE_FEATURES
        
        total_rows = len(gdf)
        logger.info(f"Processing {total_rows} features in chunks of {chunk_size}")
        
        for i in range(0, total_rows, chunk_size):
            end_idx = min(i + chunk_size, total_rows)
            chunk = gdf.iloc[i:end_idx].copy()
            logger.debug(f"Processing chunk {i//chunk_size + 1}/{(total_rows + chunk_size - 1)//chunk_size} ({len(chunk)} features)")
            yield chunk
            
            # Suggest garbage collection between chunks
            if (i // chunk_size + 1) % 5 == 0:  # Every 5 chunks
                gc.collect()
    
    def _process_with_memory_management(self, gdf: gpd.GeoDataFrame, 
                                      process_func, *args, **kwargs) -> List[Dict]:
        """Process GeoDataFrame with memory management for large datasets."""
        if not self._should_use_chunked_processing(gdf):
            # Small dataset - process normally
            return process_func(gdf, *args, **kwargs)
        
        # Large dataset - use chunked processing
        logger.info("Using chunked processing for memory efficiency")
        all_results = []
        processed_count = 0
        
        for chunk in self._chunk_geodataframe(gdf):
            chunk_results = process_func(chunk, *args, **kwargs)
            all_results.extend(chunk_results)
            
            processed_count += len(chunk)
            
            # Periodic garbage collection
            if processed_count % GC_INTERVAL == 0:
                gc.collect()
                logger.debug(f"Memory cleanup after processing {processed_count} features")
        
        # Final cleanup
        gc.collect()
        logger.info(f"Completed processing {processed_count} features with {len(all_results)} results")
        
        return all_results
    
    def load_data(self) -> Tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
        """Load boundary and features data, fetching from Overpass if needed."""
        boundaries_file = self.resort_config['data_files']['boundaries']
        
        if not os.path.exists(boundaries_file):
            raise FileNotFoundError(f"Boundary file not found: {boundaries_file}")
        
        boundaries_gdf = gpd.read_file(boundaries_file)
        
        # Normalize ZoneType values (handle case and spacing variations)
        boundaries_gdf['ZoneType'] = boundaries_gdf['ZoneType'].str.lower().str.replace(' ', '_')
        
        # Check what zone types are present
        zone_types = boundaries_gdf['ZoneType'].unique()
        print(f"Found zone types: {', '.join(zone_types)}")
        
        # Check for required ski_area_boundary
        if 'ski_area_boundary' not in zone_types:
            error_msg = (
                f"\n⚠️  Warning: No 'ski_area_boundary' zone found\n"
                f"   Found zones: {', '.join(zone_types)}\n"
                f"   The ski_area_boundary defines the overall resort area.\n"
            )
            print(error_msg)
        
        # Extract feature boundary for tree/rock generation
        feature_boundary_features = boundaries_gdf[boundaries_gdf['ZoneType'] == 'feature_boundary']
        if feature_boundary_features.empty:
            # Provide helpful error message
            error_msg = (
                f"\n❌ Missing required 'feature_boundary' zone in boundaries.geojson\n"
                f"   Found zones: {', '.join(zone_types)}\n"
                f"   Required: At least one feature with ZoneType='feature_boundary'\n"
                f"   This boundary defines where trees and rocks can be placed.\n"
                f"   Please add a feature_boundary zone to your boundaries file."
            )
            raise ValueError(error_msg)
        
        self.feature_boundary = feature_boundary_features.geometry.union_all()
        logger.info("Using feature_boundary for clipping OSM features (forests/rocks)")
        
        # Check if OSM file exists and has content, fetch from Overpass if not
        features_file = self.resort_config['data_files']['osm_features']
        should_fetch = False
        
        if not os.path.exists(features_file):
            should_fetch = True
        else:
            # Check if file is empty or just has empty FeatureCollection
            try:
                temp_gdf = gpd.read_file(features_file)
                if temp_gdf.empty:
                    logger.info("OSM features file is empty, fetching from Overpass API...")
                    should_fetch = True
            except (FileNotFoundError, ValueError, Exception) as e:
                logger.info(f"Unable to read OSM features file ({e}), fetching from Overpass API...")
                should_fetch = True
        
        if should_fetch:
            # Get bounds from boundaries file
            bounds = get_bounds_from_boundaries(Path(boundaries_file))
            
            # Fetch OSM features (will be saved to the expected location)
            logger.info(f"Fetching OSM data for {self.resort_name}...")
            features_file = fetch_osm_features(self.resort_name, bounds)
        
        features_gdf = gpd.read_file(features_file)
        
        return boundaries_gdf, features_gdf
    
    def clip_to_boundary(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Clip all features to the feature boundary using optimized spatial operations."""
        if self.feature_boundary is None:
            raise ValueError("Feature boundary not loaded")
        
        if gdf.empty:
            return gdf
        
        initial_count = len(gdf)
        
        try:
            # Fix invalid geometries before clipping (vectorized operation)
            invalid_mask = ~gdf.geometry.is_valid
            if invalid_mask.any():
                logger.debug(f"Fixing {invalid_mask.sum()} invalid geometries")
                gdf.loc[invalid_mask, 'geometry'] = gdf.loc[invalid_mask, 'geometry'].apply(make_valid)
            
            # Use spatial index for faster intersection checks
            # First, filter features that intersect with the boundary (much faster than clipping everything)
            spatial_index = gdf.sindex
            boundary_bounds = self.feature_boundary.bounds
            possible_matches_index = list(spatial_index.intersection(boundary_bounds))
            
            if not possible_matches_index:
                logger.info(f"Clipped {initial_count} features to feature_boundary, kept 0 (no spatial intersection)")
                return gpd.GeoDataFrame(columns=gdf.columns, crs=gdf.crs)
            
            possible_matches = gdf.iloc[possible_matches_index]
            
            # Create a GeoDataFrame for the boundary to use with overlay
            boundary_gdf = gpd.GeoDataFrame([1], geometry=[self.feature_boundary], crs=gdf.crs)
            
            # Perform actual clipping only on features that might intersect
            clipped_gdf = gpd.overlay(possible_matches, boundary_gdf, how='intersection', keep_geom_type=False)
            
            # Remove empty or zero-area geometries
            valid_mask = (~clipped_gdf.geometry.is_empty) & (clipped_gdf.geometry.area > 0)
            clipped_gdf = clipped_gdf[valid_mask]
            
            logger.info(f"Clipped {initial_count} features to feature_boundary, kept {len(clipped_gdf)} (spatial indexing)")
            return clipped_gdf
            
        except Exception as e:
            logger.warning(f"Spatial indexing failed ({e}), falling back to row-by-row clipping")
            return self._clip_to_boundary_fallback(gdf)
    
    def _clip_to_boundary_fallback(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Fallback method for clipping when spatial indexing fails."""
        clipped_features = []
        initial_count = len(gdf)
        
        for idx, row in gdf.iterrows():
            try:
                # Fix invalid geometries before clipping
                geom = row.geometry
                if not geom.is_valid:
                    geom = make_valid(geom)
                
                clipped_geom = geom.intersection(self.feature_boundary)
                
                # Only keep non-empty geometries
                if not clipped_geom.is_empty and clipped_geom.area > 0:
                    new_row = row.copy()
                    new_row.geometry = clipped_geom
                    clipped_features.append(new_row)
            except Exception as e:
                logger.warning(f"Failed to clip feature {idx}: {e}")
                continue
        
        logger.info(f"Clipped {initial_count} features to feature_boundary, kept {len(clipped_features)} (fallback)")
        
        if not clipped_features:
            return gpd.GeoDataFrame(columns=gdf.columns, crs=gdf.crs)
        
        return gpd.GeoDataFrame(clipped_features, crs=gdf.crs)
    
    def calculate_tree_count(self, area_sq_meters: float) -> int:
        """Calculate number of trees to place based on polygon area with tiered density."""
        tree_config = self.resort_config['tree_config']
        
        if area_sq_meters < tree_config['min_area_for_trees']:
            return 0
        
        hectares = area_sq_meters / HECTARE_TO_SQ_METERS
        
        # Use tiered density based on area size
        if area_sq_meters <= tree_config['small_area_threshold']:
            trees_per_hectare = tree_config['trees_per_small_hectare']
        elif area_sq_meters <= tree_config['medium_area_threshold']:
            trees_per_hectare = tree_config['trees_per_medium_hectare']
        elif area_sq_meters <= tree_config['large_area_threshold']:
            trees_per_hectare = tree_config['trees_per_large_hectare']
        else:
            trees_per_hectare = tree_config['trees_per_extra_large_hectare']
        
        tree_count = int(hectares * trees_per_hectare)
        
        # Apply min/max constraints
        tree_count = max(tree_config['min_trees_per_polygon'], tree_count)
        tree_count = min(tree_config['max_trees_per_polygon'], tree_count)
        
        return tree_count
    
    def _calculate_area_in_sq_meters(self, geometry) -> float:
        """Calculate geometry area in square meters using proper projection."""
        if not geometry or geometry.is_empty:
            return 0.0
        
        try:
            # Ensure geometry is valid
            if not geometry.is_valid:
                geometry = geometry.buffer(0)  # Fix invalid geometry
                if not geometry.is_valid:
                    return 0.0
            
            # More efficient area calculation using Shapely's built-in projection
            # For rough area estimation, use a simplified approach when geometry is small
            bounds = geometry.bounds
            if bounds[2] - bounds[0] < 0.01 and bounds[3] - bounds[1] < 0.01:  # Small geometries
                # Use approximate conversion for small areas (faster)
                # At mid-latitudes, 1 degree ≈ 111km, so 1 sq degree ≈ 12321 km²
                lat_center = (bounds[1] + bounds[3]) / 2
                area_degrees = geometry.area
                # Adjust for latitude (cos correction)
                import math
                cos_lat = math.cos(math.radians(lat_center))
                area_sq_meters = area_degrees * 111320 * 111320 * cos_lat  # More accurate conversion
                return area_sq_meters
            else:
                # Use proper projection for larger geometries
                temp_gdf = gpd.GeoDataFrame([1], geometry=[geometry], crs='EPSG:4326')
                temp_gdf_proj = temp_gdf.to_crs('EPSG:3857')
                return temp_gdf_proj.geometry.area.iloc[0]
                
        except Exception as e:
            logger.warning(f"Failed to calculate area for geometry: {e}")
            return 0.0
    
    def generate_random_points_in_polygon(self, polygon: Polygon, num_points: int) -> List[Point]:
        """Generate random points within a polygon using adaptive sampling strategies."""
        if num_points <= 0:
            return []
        
        # Try grid-based sampling first for efficiency
        try:
            points = self._grid_based_sampling(polygon, num_points)
            if len(points) >= num_points * 0.8:  # If we get 80% or more, we're good
                return points[:num_points]
        except Exception:
            pass
        
        # Fall back to rejection sampling with adaptive bounds
        points = self._rejection_sampling_adaptive(polygon, num_points)
        
        if len(points) < num_points:
            logger.warning(f"Only generated {len(points)} trees out of {num_points} requested")
        
        return points
    
    def _grid_based_sampling(self, polygon: Polygon, num_points: int) -> List[Point]:
        """Generate points using a grid-based approach for better distribution."""
        bounds = polygon.bounds
        min_x, min_y, max_x, max_y = bounds
        
        # Calculate approximate grid size based on area and desired points
        polygon_area = polygon.area
        point_density = num_points / polygon_area
        grid_spacing = 1.0 / (point_density ** 0.5) if point_density > 0 else 0.01
        
        # Ensure reasonable grid spacing
        grid_spacing = max(grid_spacing, (max_x - min_x) / 50)  # At least 50 points across width
        grid_spacing = min(grid_spacing, (max_x - min_x) / 10)   # At most 10 points across width
        
        points = []
        x = min_x
        while x <= max_x and len(points) < num_points * 2:  # Generate extra candidates
            y = min_y
            while y <= max_y and len(points) < num_points * 2:
                # Add some randomness to grid positions
                jitter_x = random.uniform(-grid_spacing * 0.3, grid_spacing * 0.3)
                jitter_y = random.uniform(-grid_spacing * 0.3, grid_spacing * 0.3)
                point = Point(x + jitter_x, y + jitter_y)
                
                if polygon.contains(point):
                    points.append(point)
                
                y += grid_spacing
            x += grid_spacing
        
        # Randomly sample from candidates to get desired number
        if len(points) > num_points:
            import random
            points = random.sample(points, num_points)
        
        return points
    
    def _rejection_sampling_adaptive(self, polygon: Polygon, num_points: int) -> List[Point]:
        """Improved rejection sampling with adaptive bounding and early termination."""
        points = []
        bounds = polygon.bounds
        min_x, min_y, max_x, max_y = bounds
        
        # Calculate polygon efficiency (area ratio) to adjust max attempts
        bbox_area = (max_x - min_x) * (max_y - min_y)
        polygon_area = polygon.area
        efficiency = polygon_area / bbox_area if bbox_area > 0 else 0.1
        
        # Adjust max attempts based on polygon complexity
        base_attempts = MAX_TREE_ATTEMPTS
        max_attempts = int(num_points * base_attempts / max(efficiency, 0.1))
        max_attempts = min(max_attempts, num_points * 500)  # Cap at 500 attempts per point
        
        attempts = 0
        consecutive_failures = 0
        
        while len(points) < num_points and attempts < max_attempts:
            x = random.uniform(min_x, max_x)
            y = random.uniform(min_y, max_y)
            point = Point(x, y)
            
            try:
                if polygon.is_valid and polygon.contains(point):
                    points.append(point)
                    consecutive_failures = 0
                else:
                    consecutive_failures += 1
                    
                # Early termination if we're not making progress
                if consecutive_failures > num_points * 50:
                    break
                    
            except Exception:
                consecutive_failures += 1
                continue
            
            attempts += 1
        
        return points
    
    def _map_tree_type(self, leaf_type: Optional[str], leaf_cycle: Optional[str] = None, default_type: str = 'tree:mixed') -> str:
        """Map OSM leaf_type to standardized tree type.
        
        Args:
            leaf_type: OSM leaf_type value (needleleaved, broadleaved, mixed, or None)
            leaf_cycle: OSM leaf_cycle value (optional, unused currently)
            default_type: Default tree type when leaf_type is not defined
            
        Returns:
            Standardized tree type (tree:needle, tree:broad, or tree:mixed)
        """
        if leaf_type == 'needleleaved':
            return 'tree:needle'
        elif leaf_type == 'broadleaved':
            return 'tree:broad'
        elif leaf_type == 'mixed':
            return 'tree:mixed'
        else:
            # Use resort-specific default when leaf_type is not defined
            return default_type
    
    def process_osm_tree_nodes(self, features_gdf: gpd.GeoDataFrame) -> List[Dict]:
        """Process OSM tree nodes (actual tree points from OSM data)."""
        tree_features = []
        
        # Check if the dataframe is empty
        if features_gdf.empty:
            return []
        
        # Filter for tree nodes (check if columns exist first)
        tree_mask = pd.Series([False] * len(features_gdf), index=features_gdf.index)
        
        if 'natural' in features_gdf.columns:
            tree_mask = (features_gdf['natural'] == 'tree')
        
        # Also check if geometry is Point type
        if any(tree_mask):
            tree_mask &= features_gdf.geometry.geom_type == 'Point'
        
        tree_gdf = features_gdf[tree_mask].copy()
        
        if tree_gdf.empty:
            return []
        
        # Process each tree node
        for idx, row in tree_gdf.iterrows():
            point = row.geometry
            
            # Clip to feature boundary
            if self.feature_boundary is not None:
                if not self.feature_boundary.contains(point):
                    continue
            
            # Map leaf_type to standardized tree type
            leaf_type = row.get('leaf_type')
            leaf_cycle = row.get('leaf_cycle')
            tree_type = self._map_tree_type(leaf_type, leaf_cycle, self.resort_config.get('default_tree_type', 'tree:mixed'))
            
            tree_feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [point.x, point.y]
                },
                "properties": {
                    "trees": True,
                    "type": tree_type,
                    "source": "osm",
                    "@id": row.get('@id', '')
                }
            }
            tree_features.append(tree_feature)
        
        return tree_features
    
    def _extract_valid_polygons(self, geometry) -> List[Polygon]:
        """Extract valid polygons from a geometry (Polygon or MultiPolygon)."""
        if isinstance(geometry, MultiPolygon):
            return [poly for poly in geometry.geoms if isinstance(poly, Polygon)]
        elif isinstance(geometry, Polygon):
            return [geometry]
        else:
            return []
    
    def _distribute_trees_across_polygons(self, polygons: List[Polygon], total_tree_count: int) -> List[int]:
        """Distribute trees across polygons proportionally by area."""
        polygon_areas = [self._calculate_area_in_sq_meters(poly) for poly in polygons]
        total_area = sum(polygon_areas)
        
        if total_area == 0:
            return [0] * len(polygons)
        
        # Calculate proportional distribution
        tree_counts = []
        trees_distributed = 0
        
        for i, area in enumerate(polygon_areas):
            if i == len(polygon_areas) - 1:  # Last polygon gets remaining trees
                tree_count = total_tree_count - trees_distributed
            else:
                proportion = area / total_area
                tree_count = int(total_tree_count * proportion)
            
            tree_counts.append(max(0, tree_count))  # Ensure non-negative
            trees_distributed += tree_count
        
        return tree_counts
    
    def _create_tree_feature(self, point: Point, tree_type: str, source_polygon_id: str) -> Dict:
        """Create a GeoJSON feature for a tree point."""
        return {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [point.x, point.y]
            },
            "properties": {
                "trees": True,
                "type": tree_type,
                "source": "generated",
                "source_polygon_id": source_polygon_id
            }
        }
    
    def _process_forest_geometry(self, geometry, leaf_type: str, leaf_cycle: str, polygon_id: str) -> List[Dict]:
        """Process a single forest geometry and generate tree features."""
        tree_features = []
        
        # Since geometry is already clipped in process_forest_features, 
        # we don't need to clip again here. Just calculate area directly.
        total_area_sq_meters = self._calculate_area_in_sq_meters(geometry)
        total_tree_count = self.calculate_tree_count(total_area_sq_meters)
        
        if total_tree_count == 0:
            return tree_features
        
        # Extract valid polygons
        valid_polygons = self._extract_valid_polygons(geometry)
        if not valid_polygons:
            return tree_features
        
        # Distribute trees across polygons
        tree_counts = self._distribute_trees_across_polygons(valid_polygons, total_tree_count)
        
        # Generate tree type
        tree_type = self._map_tree_type(leaf_type, leaf_cycle, self.resort_config.get('default_tree_type', 'tree:mixed'))
        
        # Generate points for each polygon
        for polygon, tree_count in zip(valid_polygons, tree_counts):
            if tree_count > 0:
                points = self.generate_random_points_in_polygon(polygon, tree_count)
                for point in points:
                    tree_feature = self._create_tree_feature(point, tree_type, polygon_id)
                    tree_features.append(tree_feature)
        
        return tree_features
    
    def generate_tree_points(self, forest_gdf: gpd.GeoDataFrame) -> List[Dict]:
        """Generate individual tree points for forest polygons within the feature boundary."""
        tree_features = []
        
        for idx, row in forest_gdf.iterrows():
            leaf_type = row.get('leaf_type')
            leaf_cycle = row.get('leaf_cycle')
            
            forest_trees = self._process_forest_geometry(
                row.geometry, leaf_type, leaf_cycle, str(idx)
            )
            tree_features.extend(forest_trees)
        
        return tree_features
    
    def process_forest_features(self, features_gdf: gpd.GeoDataFrame) -> Tuple[List[Dict], List[Dict]]:
        """Process forest features and generate tree points."""
        forest_features = []
        
        # Check if the dataframe is empty
        if features_gdf.empty:
            print("No OSM features found, skipping forest processing")
            return [], []
        
        # Filter for forest features (check if columns exist first)
        forest_mask = pd.Series([False] * len(features_gdf), index=features_gdf.index)
        
        if 'landuse' in features_gdf.columns:
            forest_mask |= (features_gdf['landuse'] == 'forest')
        if 'natural' in features_gdf.columns:
            forest_mask |= (features_gdf['natural'] == 'wood')
        
        forest_gdf = features_gdf[forest_mask].copy()
        
        if forest_gdf.empty:
            return [], []
        
        # Clip forest features to boundary
        clipped_forest_gdf = self.clip_to_boundary(forest_gdf)
        
        if clipped_forest_gdf.empty:
            return [], []
        
        # Process forest polygons
        for idx, row in clipped_forest_gdf.iterrows():
            # Calculate area
            geom = row.geometry
            area_sq_meters = self._calculate_area_in_sq_meters(geom)
            
            # Map leaf_type to standardized tree type
            leaf_type = row.get('leaf_type')
            leaf_cycle = row.get('leaf_cycle')
            tree_type = self._map_tree_type(leaf_type, leaf_cycle, self.resort_config.get('default_tree_type', 'tree:mixed'))
            
            feature = {
                "type": "Feature",
                "geometry": row.geometry.__geo_interface__,
                "properties": {
                    "trees": True,
                    "type": tree_type,
                    "area_sq_meters": area_sq_meters,
                    "@id": row.get('@id', '')
                }
            }
            forest_features.append(feature)
        
        # Generate individual tree points
        tree_points = self.generate_tree_points(clipped_forest_gdf)
        
        return forest_features, tree_points
    
    def process_rock_features(self, features_gdf: gpd.GeoDataFrame) -> List[Dict]:
        """Process rock features."""
        rock_features = []
        
        # Check if the dataframe is empty
        if features_gdf.empty:
            print("No OSM features found, skipping rock processing")
            return []
        
        # Filter for rock features (check if columns exist first)
        rock_mask = pd.Series([False] * len(features_gdf), index=features_gdf.index)
        
        if 'natural' in features_gdf.columns:
            rock_mask |= features_gdf['natural'].isin(['rock', 'cliff', 'scree', 'bare_rock', 'stone'])
        if 'landuse' in features_gdf.columns:
            rock_mask |= (features_gdf['landuse'] == 'quarry')
        
        rock_gdf = features_gdf[rock_mask].copy()
        
        if rock_gdf.empty:
            return []
        
        # Clip rock features to boundary
        clipped_rock_gdf = self.clip_to_boundary(rock_gdf)
        
        if clipped_rock_gdf.empty:
            return []
        
        # Process rock features
        for idx, row in clipped_rock_gdf.iterrows():
            feature = {
                "type": "Feature",
                "geometry": row.geometry.__geo_interface__,
                "properties": {
                    "type": "rock",
                    "@id": row.get('@id', '')
                }
            }
            rock_features.append(feature)
        
        return rock_features
    
    def _map_zone_type(self, zone_type: str) -> str:
        """Map ZoneType to standardized type."""
        zone_mapping = {
            'slow_zone': 'zone:slow',
            'closed_area': 'zone:closed',
            'ski_area_boundary': 'boundary:ski',
            'feature_boundary': 'boundary:feature',  # Boundary for tree/rock generation
            'beginner_area': 'zone:beginner',  # Not in spec but handling it
            # Add support for first-tracks if it appears in data
            'first_tracks': 'boundary:first-tracks'
        }
        return zone_mapping.get(zone_type, zone_type)
    
    def process_boundary_features(self, boundaries_gdf: gpd.GeoDataFrame) -> List[Dict]:
        """Process boundary features for styling."""
        boundary_features = []
        zone_styles = DEFAULT_ZONE_STYLES
        
        for idx, row in boundaries_gdf.iterrows():
            zone_type = row.get('ZoneType', '')
            standardized_type = self._map_zone_type(zone_type)
            
            # Set styling based on zone type
            properties = {
                "type": standardized_type
            }
            
            # Add appropriate top-level property based on type
            if standardized_type.startswith('boundary:'):
                properties["boundaries"] = True
            elif standardized_type.startswith('zone:'):
                properties["zones"] = True
            
            if zone_type in zone_styles:
                style = zone_styles[zone_type]
                properties.update({
                    "stroke": style.get('stroke_color', '#000000'),
                    "stroke-opacity": style.get('stroke_opacity', 1.0)
                })
                
                # Add fill properties if they exist
                if 'fill_color' in style:
                    properties["fill"] = style['fill_color']
                if 'fill_opacity' in style:
                    properties["fill-opacity"] = style['fill_opacity']
                if 'stroke_width' in style:
                    properties["stroke-width"] = style['stroke_width']
            
            feature = {
                "type": "Feature",
                "geometry": row.geometry.__geo_interface__,
                "properties": properties
            }
            boundary_features.append(feature)
        
        return boundary_features
    
    def create_output_geojson(self) -> Dict:
        """Create the final merged GeoJSON output."""
        # Set random seed for reproducibility
        random.seed(self.resort_config['tree_config']['random_seed'])
        
        boundaries_gdf, features_gdf = self.load_data()
        
        # Process different feature types
        boundary_features = self.process_boundary_features(boundaries_gdf)
        forest_features, generated_tree_points = self.process_forest_features(features_gdf)
        osm_tree_points = self.process_osm_tree_nodes(features_gdf)
        rock_features = self.process_rock_features(features_gdf)
        
        # Combine all features (OSM trees + generated trees)
        all_tree_points = osm_tree_points + generated_tree_points
        
        # Add incrementing integer IDs to all tree points
        for tree_id, tree_feature in enumerate(all_tree_points, start=1):
            tree_feature['properties']['id'] = tree_id
        
        all_features = boundary_features + forest_features + all_tree_points + rock_features
        
        output_geojson = {
            "type": "FeatureCollection",
            "features": all_features,
            "metadata": {
                "generator": "geojson-processor-standalone",
                "resort_name": self.resort_name,
                "timestamp": datetime.now().strftime(TIMESTAMP_FORMAT),
                "total_features": len(all_features),
                "boundary_features": len(boundary_features),
                "forest_features": len(forest_features),
                "tree_points_total": len(all_tree_points),
                "tree_points_osm": len(osm_tree_points),
                "tree_points_generated": len(generated_tree_points),
                "tree_id_range": {"min": 1, "max": len(all_tree_points)} if all_tree_points else {"min": 0, "max": 0},
                "rock_features": len(rock_features),
                "tree_config": self.resort_config['tree_config'],
                "center": self.resort_config.get('center'),
                "zoom": self.resort_config.get('zoom', 14),
                "bounds": self.resort_config.get('bounds')
            }
        }
        
        return output_geojson