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
        """Build Overpass QL query for forest and rock features."""
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
);
out geom;
"""
        return query.strip()
    
    def _convert_to_geojson(self, overpass_data: Dict) -> Dict:
        """Convert Overpass JSON to GeoJSON format."""
        features = []
        
        for element in overpass_data.get('elements', []):
            if 'geometry' not in element:
                continue
            
            # Convert Overpass geometry to GeoJSON geometry
            geometry = self._convert_geometry(element)
            if not geometry:
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
        
        return {
            'type': 'FeatureCollection',
            'generator': 'GeoWeld Overpass Client',
            'copyright': 'The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.',
            'features': features
        }
    
    def _convert_geometry(self, element: Dict) -> Optional[Dict]:
        """Convert Overpass element geometry to GeoJSON geometry."""
        if element['type'] == 'way':
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
            # Handle multipolygon relations
            if element.get('tags', {}).get('type') == 'multipolygon':
                polygons = []
                
                for member in element.get('members', []):
                    if member['type'] == 'way' and 'geometry' in member:
                        coords = [[node['lon'], node['lat']] for node in member['geometry']]
                        if member['role'] == 'outer':
                            polygons.append([coords])
                        # Note: Inner rings would need more complex handling
                
                if len(polygons) == 1:
                    return {
                        'type': 'Polygon',
                        'coordinates': polygons[0]
                    }
                elif len(polygons) > 1:
                    return {
                        'type': 'MultiPolygon',
                        'coordinates': polygons
                    }
        
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
    
    Args:
        boundaries_path: Path to boundaries GeoJSON file
    
    Returns:
        Bounding box tuple (min_lon, min_lat, max_lon, max_lat)
    """
    with open(boundaries_path) as f:
        data = json.load(f)
    
    # Find ski_area_boundary feature
    ski_area = None
    for feature in data['features']:
        if feature.get('properties', {}).get('ZoneType') == 'ski_area_boundary':
            ski_area = feature
            break
    
    if not ski_area:
        # Fall back to union of all features
        logger.warning("No ski_area_boundary found, using all features")
        all_bounds = []
        for feature in data['features']:
            geom = shape(feature['geometry'])
            all_bounds.append(geom.bounds)
        
        if all_bounds:
            min_lon = min(b[0] for b in all_bounds)
            min_lat = min(b[1] for b in all_bounds)
            max_lon = max(b[2] for b in all_bounds)
            max_lat = max(b[3] for b in all_bounds)
            return (min_lon, min_lat, max_lon, max_lat)
    else:
        geom = shape(ski_area['geometry'])
        return geom.bounds
    
    raise ValueError("Could not extract bounds from boundaries file")