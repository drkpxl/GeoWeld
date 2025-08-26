"""
Core GeoJSON processor for ski resort data
"""

import json
import random
import os
import yaml
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime
from pathlib import Path
import pandas as pd
import geopandas as gpd
import numpy as np
from shapely.geometry import Point, Polygon, MultiPolygon, GeometryCollection
from shapely.ops import unary_union
from shapely import make_valid

from .constants import (
    SMALL_AREA_THRESHOLD, MEDIUM_AREA_THRESHOLD, LARGE_AREA_THRESHOLD,
    DEFAULT_TREES_PER_SMALL_HECTARE, DEFAULT_TREES_PER_MEDIUM_HECTARE, DEFAULT_TREES_PER_LARGE_HECTARE,
    MAX_TREE_ATTEMPTS, DEFAULT_MAX_TREES_PER_POLYGON, MIN_TREES_PER_POLYGON,
    HECTARE_TO_SQ_METERS, DEFAULT_RANDOM_SEED, TIMESTAMP_FORMAT,
    DEFAULT_ZONE_STYLES
)
from .overpass import fetch_osm_features, get_bounds_from_boundaries


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
        tree_config.setdefault('trees_per_small_hectare', DEFAULT_TREES_PER_SMALL_HECTARE)
        tree_config.setdefault('trees_per_medium_hectare', DEFAULT_TREES_PER_MEDIUM_HECTARE)
        tree_config.setdefault('trees_per_large_hectare', DEFAULT_TREES_PER_LARGE_HECTARE)
        tree_config.setdefault('max_trees_per_polygon', DEFAULT_MAX_TREES_PER_POLYGON)
        tree_config.setdefault('min_trees_per_polygon', MIN_TREES_PER_POLYGON)
        tree_config.setdefault('random_seed', DEFAULT_RANDOM_SEED)
        resort_config['tree_config'] = tree_config
        
        return resort_config
    
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
        print(f"Using feature_boundary for clipping OSM features (forests/rocks)")
        
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
                    print(f"OSM features file is empty, fetching from Overpass API...")
                    should_fetch = True
            except:
                should_fetch = True
        
        if should_fetch:
            # Get bounds from boundaries file
            bounds = get_bounds_from_boundaries(Path(boundaries_file))
            
            # Fetch OSM features (will be saved to the expected location)
            print(f"Fetching OSM data for {self.resort_name}...")
            features_file = fetch_osm_features(self.resort_name, bounds)
        
        features_gdf = gpd.read_file(features_file)
        
        return boundaries_gdf, features_gdf
    
    def clip_to_boundary(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Clip all features to the feature boundary."""
        if self.feature_boundary is None:
            raise ValueError("Feature boundary not loaded")
        
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
                print(f"Warning: Failed to clip feature {idx}: {e}")
                continue
        
        print(f"  Clipped {initial_count} features to feature_boundary, kept {len(clipped_features)}")
        
        if not clipped_features:
            return gpd.GeoDataFrame()
        
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
        else:
            trees_per_hectare = tree_config['trees_per_large_hectare']
        
        tree_count = int(hectares * trees_per_hectare)
        
        # Apply min/max constraints
        tree_count = max(tree_config['min_trees_per_polygon'], tree_count)
        tree_count = min(tree_config['max_trees_per_polygon'], tree_count)
        
        return tree_count
    
    def generate_random_points_in_polygon(self, polygon: Polygon, num_points: int) -> List[Point]:
        """Generate random points within a polygon using rejection sampling."""
        points = []
        bounds = polygon.bounds
        min_x, min_y, max_x, max_y = bounds
        
        attempts = 0
        max_attempts = num_points * MAX_TREE_ATTEMPTS
        
        while len(points) < num_points and attempts < max_attempts:
            x = random.uniform(min_x, max_x)
            y = random.uniform(min_y, max_y)
            point = Point(x, y)
            
            if polygon.contains(point):
                points.append(point)
            
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
            tree_type = self._map_tree_type(leaf_type, leaf_cycle, self.config.get('default_tree_type', 'tree:mixed'))
            
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
    
    def generate_tree_points(self, forest_gdf: gpd.GeoDataFrame) -> List[Dict]:
        """Generate individual tree points for forest polygons within the feature boundary."""
        tree_features = []

        for idx, row in forest_gdf.iterrows():
            geom = row.geometry

            # Ensure geometry is constrained to the feature boundary
            if self.feature_boundary is not None:
                geom = geom.intersection(self.feature_boundary)
                if geom.is_empty:
                    continue

            # Calculate total area for the (potentially clipped) geometry
            temp_gdf = gpd.GeoDataFrame([1], geometry=[geom], crs='EPSG:4326')
            temp_gdf_proj = temp_gdf.to_crs('EPSG:3857')  # Web Mercator
            total_area_sq_meters = temp_gdf_proj.geometry.area.iloc[0]

            # Calculate total tree count for this feature
            total_tree_count = self.calculate_tree_count(total_area_sq_meters)

            if total_tree_count > 0:
                # Handle both Polygon and MultiPolygon, skip invalid geometries
                if isinstance(geom, MultiPolygon):
                    polygons = list(geom.geoms)
                elif isinstance(geom, Polygon):
                    polygons = [geom]
                else:
                    continue

                # Distribute trees across polygons proportionally by area
                polygon_areas = []
                valid_polygons = []

                for polygon in polygons:
                    if isinstance(polygon, Polygon):
                        temp_poly_gdf = gpd.GeoDataFrame([1], geometry=[polygon], crs='EPSG:4326')
                        temp_poly_proj = temp_poly_gdf.to_crs('EPSG:3857')
                        poly_area = temp_poly_proj.geometry.area.iloc[0]
                        polygon_areas.append(poly_area)
                        valid_polygons.append(polygon)

                if not valid_polygons:
                    continue

                # Distribute trees proportionally
                total_polygon_area = sum(polygon_areas)
                trees_placed = 0

                # Map leaf_type to standardized tree type
                leaf_type = row.get('leaf_type')
                leaf_cycle = row.get('leaf_cycle')
                tree_type = self._map_tree_type(leaf_type, leaf_cycle, self.config.get('default_tree_type', 'tree:mixed'))

                for i, (polygon, poly_area) in enumerate(zip(valid_polygons, polygon_areas)):
                    # Calculate trees for this polygon
                    if i == len(valid_polygons) - 1:  # Last polygon gets remaining trees
                        polygon_tree_count = total_tree_count - trees_placed
                    else:
                        proportion = poly_area / total_polygon_area
                        polygon_tree_count = int(total_tree_count * proportion)

                    if polygon_tree_count > 0:
                        points = self.generate_random_points_in_polygon(polygon, polygon_tree_count)
                        trees_placed += len(points)

                        for point in points:
                            tree_feature = {
                                "type": "Feature",
                                "geometry": {
                                    "type": "Point",
                                    "coordinates": [point.x, point.y]
                                },
                                "properties": {
                                    "trees": True,
                                    "type": tree_type,
                                    "source": "generated",
                                    "source_polygon_id": str(idx)
                                }
                            }
                            tree_features.append(tree_feature)

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
            temp_gdf = gpd.GeoDataFrame([1], geometry=[geom], crs='EPSG:4326')
            temp_gdf_proj = temp_gdf.to_crs('EPSG:3857')
            area_sq_meters = temp_gdf_proj.geometry.area.iloc[0]
            
            # Map leaf_type to standardized tree type
            leaf_type = row.get('leaf_type')
            leaf_cycle = row.get('leaf_cycle')
            tree_type = self._map_tree_type(leaf_type, leaf_cycle, self.config.get('default_tree_type', 'tree:mixed'))
            
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