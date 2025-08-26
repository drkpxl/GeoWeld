"""
Overpass API integration for fetching OSM features.
"""

import json
import logging
import time
from pathlib import Path
from typing import Dict, Optional, Tuple
import requests
from shapely.geometry import shape

logger = logging.getLogger(__name__)


class OverpassClient:
    """Client for fetching OSM data from Overpass API."""
    
    OVERPASS_URL = "https://overpass-api.de/api/interpreter"
    TIMEOUT = 30
    RETRY_DELAY = 5
    MAX_RETRIES = 3
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'GeoWeld/1.0 (ski resort processor)'
        })
    
    def fetch_features(self, bounds: Tuple[float, float, float, float]) -> Dict:
        """
        Fetch OSM features within the given bounds.
        
        Args:
            bounds: Bounding box (min_lon, min_lat, max_lon, max_lat)
        
        Returns:
            GeoJSON FeatureCollection dictionary
        """
        query = self._build_query(bounds)
        
        for attempt in range(self.MAX_RETRIES):
            try:
                logger.info(f"Fetching OSM data (attempt {attempt + 1}/{self.MAX_RETRIES})")
                response = self.session.post(
                    self.OVERPASS_URL,
                    data={'data': query},
                    timeout=self.TIMEOUT
                )
                response.raise_for_status()
                
                data = response.json()
                geojson = self._convert_to_geojson(data)
                logger.info(f"Successfully fetched {len(geojson['features'])} features")
                return geojson
                
            except requests.exceptions.RequestException as e:
                logger.warning(f"Overpass API request failed: {e}")
                if attempt < self.MAX_RETRIES - 1:
                    logger.info(f"Retrying in {self.RETRY_DELAY} seconds...")
                    time.sleep(self.RETRY_DELAY)
                else:
                    raise
    
    def _build_query(self, bounds: Tuple[float, float, float, float]) -> str:
        """Build Overpass QL query for forest, rock, and tree features."""
        min_lon, min_lat, max_lon, max_lat = bounds
        
        query = f"""
[out:json][timeout:30];
(
  // Forest features
  way["landuse"="forest"]({min_lat},{min_lon},{max_lat},{max_lon});
  way["natural"="wood"]({min_lat},{min_lon},{max_lat},{max_lon});
  relation["landuse"="forest"]({min_lat},{min_lon},{max_lat},{max_lon});
  relation["natural"="wood"]({min_lat},{min_lon},{max_lat},{max_lon});
  
  // Rock features
  way["natural"="bare_rock"]({min_lat},{min_lon},{max_lat},{max_lon});
  way["natural"="rock"]({min_lat},{min_lon},{max_lat},{max_lon});
  way["natural"="cliff"]({min_lat},{min_lon},{max_lat},{max_lon});
  way["natural"="scree"]({min_lat},{min_lon},{max_lat},{max_lon});
  way["natural"="stone"]({min_lat},{min_lon},{max_lat},{max_lon});
  way["landuse"="quarry"]({min_lat},{min_lon},{max_lat},{max_lon});
  relation["natural"="bare_rock"]({min_lat},{min_lon},{max_lat},{max_lon});
  relation["natural"="rock"]({min_lat},{min_lon},{max_lat},{max_lon});
  relation["natural"="cliff"]({min_lat},{min_lon},{max_lat},{max_lon});
  relation["natural"="scree"]({min_lat},{min_lon},{max_lat},{max_lon});
  relation["natural"="stone"]({min_lat},{min_lon},{max_lat},{max_lon});
  relation["landuse"="quarry"]({min_lat},{min_lon},{max_lat},{max_lon});
  
  // Tree nodes
  node["natural"="tree"]({min_lat},{min_lon},{max_lat},{max_lon});
);
// Recursively get all members of relations to build complete geometries
(._; rel(r); >>;);
out geom;
"""
        return query.strip()
    
    def _convert_to_geojson(self, overpass_data: Dict) -> Dict:
        """Convert Overpass JSON to GeoJSON format."""
        features = []
        
        skipped_count = 0
        geometry_failures = 0
        
        for element in overpass_data.get('elements', []):
            element_id = f"{element['type']}/{element['id']}"
            
            # Check if element has geometry data (ways/relations) or is a node with lat/lon
            if element['type'] == 'node':
                # Nodes have lat/lon directly, not in a geometry field
                if 'lat' not in element or 'lon' not in element:
                    logger.debug(f"Skipping node {element_id}: missing lat/lon")
                    skipped_count += 1
                    continue
            elif element['type'] == 'way' and 'geometry' not in element:
                # Ways need geometry field
                logger.debug(f"Skipping way {element_id}: missing geometry field")
                skipped_count += 1
                continue
            elif element['type'] == 'relation' and 'members' not in element:
                # Relations need members field
                logger.debug(f"Skipping relation {element_id}: missing members field")
                skipped_count += 1
                continue
            
            # Convert Overpass geometry to GeoJSON geometry
            geometry = self._convert_geometry(element)
            if not geometry:
                geometry_failures += 1
                continue
            
            # Extract properties
            properties = {
                '@id': f"{element['type']}/{element['id']}"
            }
            
            # Add all tags as properties
            if 'tags' in element:
                properties.update(element['tags'])
            
            features.append({
                'type': 'Feature',
                'properties': properties,
                'geometry': geometry
            })
        
        # Log conversion summary
        total_elements = len(overpass_data.get('elements', []))
        if skipped_count > 0:
            logger.info(f"Skipped {skipped_count} elements due to missing geometry/coordinates")
        if geometry_failures > 0:
            logger.warning(f"Failed to convert geometry for {geometry_failures} elements")
        
        logger.info(f"Converted {len(features)} of {total_elements} OSM elements to GeoJSON features")
        
        return {
            'type': 'FeatureCollection',
            'generator': 'GeoWeld Overpass Client',
            'copyright': 'The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.',
            'features': features
        }
    
    def _convert_geometry(self, element: Dict) -> Optional[Dict]:
        """Convert Overpass element geometry to GeoJSON geometry."""
        element_id = f"{element['type']}/{element['id']}"
        
        try:
            if element['type'] == 'node':
                # Handle point geometries for tree nodes
                if 'lat' in element and 'lon' in element:
                    return {
                        'type': 'Point',
                        'coordinates': [element['lon'], element['lat']]
                    }
            
            elif element['type'] == 'way':
                coords = [[node['lon'], node['lat']] for node in element['geometry']]
                
                # Check if it's a closed way (polygon)
                if len(coords) > 2 and coords[0] == coords[-1]:
                    return {
                        'type': 'Polygon',
                        'coordinates': [coords]
                    }
                else:
                    return {
                        'type': 'LineString',
                        'coordinates': coords
                    }
            
            elif element['type'] == 'relation':
                # Handle multipolygon relations and forest/area relations
                tags = element.get('tags', {})
                relation_type = tags.get('type')
                
                # Check if this is a multipolygon or an area relation (forest, rock, etc.)
                is_multipolygon = relation_type == 'multipolygon'
                is_area_relation = any(tag in tags for tag in ['landuse', 'natural', 'leisure', 'amenity'])
                
                if is_multipolygon or is_area_relation:
                    outer_rings = []
                    inner_rings = []
                    
                    for member in element.get('members', []):
                        if member['type'] == 'way' and 'geometry' in member:
                            coords = [[node['lon'], node['lat']] for node in member['geometry']]
                            # Ensure ring is closed
                            if len(coords) > 2 and coords[0] != coords[-1]:
                                coords.append(coords[0])
                            
                            if member['role'] == 'outer':
                                outer_rings.append(coords)
                            elif member['role'] == 'inner':
                                inner_rings.append(coords)
                            elif member['role'] == '':
                                # Default to outer if role is empty
                                outer_rings.append(coords)
                    
                    if not outer_rings:
                        logger.warning(f"Relation {element_id} has no outer rings")
                        return None
                    
                    if len(outer_rings) == 1:
                        # Single polygon (potentially with holes)
                        coordinates = [outer_rings[0]] + inner_rings
                        return {
                            'type': 'Polygon',
                            'coordinates': coordinates
                        }
                    else:
                        # Multiple polygons - create MultiPolygon
                        polygons = []
                        for outer in outer_rings:
                            # For simplicity, assign all inner rings to first outer
                            # More complex logic would match inners to their containing outers
                            if outer == outer_rings[0]:
                                polygons.append([outer] + inner_rings)
                            else:
                                polygons.append([outer])
                        
                        return {
                            'type': 'MultiPolygon',
                            'coordinates': polygons
                        }
                
                else:
                    # Handle other relation types if needed
                    logger.debug(f"Skipping relation {element_id} of type {relation_type} (no area tags)")
                    return None
        
        except Exception as e:
            logger.error(f"Failed to convert geometry for {element_id}: {e}")
            return None
        
        logger.warning(f"Could not convert geometry for {element_id} (type: {element['type']})")
        return None


def fetch_osm_features(resort_name: str, bounds: Tuple[float, float, float, float]) -> Path:
    """
    Fetch OSM features for a resort from Overpass API.
    
    Args:
        resort_name: Name of the resort
        bounds: Bounding box (min_lon, min_lat, max_lon, max_lat)
    
    Returns:
        Path to the OSM features GeoJSON file
    """
    output_path = Path(f"data/{resort_name}/osm_features.geojson")
    
    # Ensure directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Fetch from Overpass API
    client = OverpassClient()
    
    # Add buffer to bounds (approximately 500m)
    buffer = 0.005  # ~500m in degrees at this latitude
    buffered_bounds = (
        bounds[0] - buffer,
        bounds[1] - buffer,
        bounds[2] + buffer,
        bounds[3] + buffer
    )
    
    try:
        geojson = client.fetch_features(buffered_bounds)
        
        # Save to file
        with open(output_path, 'w') as f:
            json.dump(geojson, f, indent=2)
        
        logger.info(f"Saved OSM features to: {output_path}")
        return output_path
        
    except Exception as e:
        logger.error(f"Failed to fetch OSM features: {e}")
        
        # Fall back to existing file if available
        if output_path.exists():
            logger.warning("Using existing OSM features file as fallback")
            return output_path
        else:
            raise


def get_bounds_from_boundaries(boundaries_path: Path) -> Tuple[float, float, float, float]:
    """
    Extract bounding box from boundaries GeoJSON file.
    Uses feature_boundary for fetching OSM data to ensure we get all features.
    
    Args:
        boundaries_path: Path to boundaries GeoJSON file
    
    Returns:
        Bounding box tuple (min_lon, min_lat, max_lon, max_lat)
    """
    with open(boundaries_path) as f:
        data = json.load(f)
    
    def _normalize(zone: str) -> str:
        """Normalize ZoneType values for comparison."""
        return zone.lower().replace(" ", "_")

    # First try to find feature_boundary polygons
    feature_geom = None
    for feature in data["features"]:
        zone_type = _normalize(feature.get("properties", {}).get("ZoneType", ""))
        if zone_type == "feature_boundary":
            geom = shape(feature["geometry"])
            feature_geom = geom if feature_geom is None else feature_geom.union(geom)

    if feature_geom is not None:
        logger.info(f"Using feature_boundary for OSM data fetching: {feature_geom.bounds}")
        return feature_geom.bounds

    # Fall back to ski_area_boundary if no feature_boundary was found
    logger.warning("No feature_boundary found, falling back to ski_area_boundary")
    ski_geom = None
    for feature in data["features"]:
        zone_type = _normalize(feature.get("properties", {}).get("ZoneType", ""))
        if zone_type == "ski_area_boundary":
            geom = shape(feature["geometry"])
            ski_geom = geom if ski_geom is None else ski_geom.union(geom)

    if ski_geom is not None:
        return ski_geom.bounds

    # Fall back to union of all features as last resort
    logger.warning("No feature_boundary or ski_area_boundary found, using all features")
    all_bounds = []
    for feature in data["features"]:
        geom = shape(feature["geometry"])
        all_bounds.append(geom.bounds)

    if all_bounds:
        min_lon = min(b[0] for b in all_bounds)
        min_lat = min(b[1] for b in all_bounds)
        max_lon = max(b[2] for b in all_bounds)
        max_lat = max(b[3] for b in all_bounds)
        return (min_lon, min_lat, max_lon, max_lat)

    raise ValueError("Could not extract bounds from boundaries file")
