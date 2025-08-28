// Map Viewer Tab Component for GeoWeld Resort Processor
// Refactored into smaller, focused components
const { useState, useEffect, useRef } = React;
const { Button, Card, InfoCard, LoadingSpinner } = window.Components;
const { loadMapData, downloadFile, calculateFeatureStats, deleteEntireResort } = window.ApiServices;
const { useNotifications } = window.NotificationSystem;

// Calculate initial center from data bounds
const calculateDataCenter = (mapData) => {
  if (!mapData || !mapData.features || mapData.features.length === 0) {
    return { center: [-105.8717, 39.6403], zoom: 12 }; // A-Basin fallback
  }

  const bounds = new mapboxgl.LngLatBounds();
  let hasValidBounds = false;

  mapData.features.forEach(feature => {
    try {
      if (feature.geometry && feature.geometry.coordinates) {
        if (feature.geometry.type === 'Point') {
          const coord = feature.geometry.coordinates;
          if (Array.isArray(coord) && coord.length >= 2 && 
              typeof coord[0] === 'number' && typeof coord[1] === 'number' &&
              !isNaN(coord[0]) && !isNaN(coord[1])) {
            bounds.extend(coord);
            hasValidBounds = true;
          }
        } else if (feature.geometry.type === 'Polygon') {
          const coords = feature.geometry.coordinates[0]; // Get exterior ring
          if (Array.isArray(coords)) {
            coords.forEach(coord => {
              if (Array.isArray(coord) && coord.length >= 2 && 
                  typeof coord[0] === 'number' && typeof coord[1] === 'number' &&
                  !isNaN(coord[0]) && !isNaN(coord[1])) {
                bounds.extend(coord);
                hasValidBounds = true;
              }
            });
          }
        }
      }
    } catch (error) {
      console.warn('Error processing feature for center calculation:', error);
    }
  });

  if (hasValidBounds) {
    const center = bounds.getCenter();
    return {
      center: [center.lng, center.lat],
      zoom: 12,
      bounds: bounds
    };
  }

  return { center: [-105.8717, 39.6403], zoom: 12 }; // A-Basin fallback
};

// Custom hook for map management
const useMapbox = (mapboxToken, mapData, showMap, setSelectedFeature) => {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (!showMap || !mapboxToken || !mapData || !mapContainer.current) {
      return;
    }

    // Clean up existing map safely
    if (map.current) {
      try {
        map.current.off();
        map.current.remove();
      } catch (error) {
        console.warn('Error cleaning up previous map:', error);
      }
      map.current = null;
    }

    // Ensure container has proper dimensions
    const container = mapContainer.current;
    container.style.minHeight = '560px';
    container.style.height = '560px';
    container.style.width = '100%';
    
    // Calculate initial center from data to avoid Stratton pan
    const { center, zoom, bounds } = calculateDataCenter(mapData);
    
    try {
      mapboxgl.accessToken = mapboxToken;
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        center: center,
        zoom: zoom
      });

      map.current.on('load', () => {
        if (!map.current) return; // Check if map still exists
        
        // Single resize after load
        map.current.resize();

        // Add data and layers
        try {
          setupMapLayers(map.current, mapData);
          setupMapInteractions(map.current, (feature) => {
            if (setSelectedFeature) {
              setSelectedFeature(feature);
            }
          });
          
          // Fit to bounds with proper padding if we have calculated bounds
          if (bounds) {
            map.current.fitBounds(bounds, {
              padding: { top: 50, bottom: 50, left: 50, right: 50 },
              maxZoom: 15
            });
          }
        } catch (error) {
          console.error('Error setting up map layers:', error);
        }
      });
      
      // Add error handler
      map.current.on('error', (e) => {
        console.error('Map error:', e.error);
      });

    } catch (error) {
      console.error('Error initializing map:', error);
    }

    // Cleanup function
    return () => {
      if (map.current) {
        try {
          map.current.off();
          map.current.remove();
        } catch (error) {
          console.warn('Error during map cleanup:', error);
        } finally {
          map.current = null;
        }
      }
    };
  }, [showMap, mapData, mapboxToken]);

  return { mapContainer, map };
};

// Map layer configuration
const setupMapLayers = (map, mapData) => {
  // Add the data source
  map.addSource('resort-data', {
    type: 'geojson',
    data: mapData,
  });

  // Boundaries (ski area and feature boundaries)
  map.addLayer({
    id: "boundaries",
    type: "fill",
    source: "resort-data",
    filter: [
      "in",
      ["get", "type"],
      ["literal", ["boundary:ski", "boundary:feature"]],
    ],
    paint: {
      "fill-color": [
        "case",
        ["==", ["get", "type"], "boundary:ski"],
        "rgba(33, 150, 243, 0.1)",
        "rgba(156, 39, 176, 0.1)",
      ],
      "fill-outline-color": [
        "case",
        ["==", ["get", "type"], "boundary:ski"],
        "#2196F3",
        "#9C27B0",
      ],
    },
  });

  // Slow zones
  map.addLayer({
    id: "slow-zones",
    type: "fill",
    source: "resort-data",
    filter: ["==", ["get", "type"], "zone:slow"],
    paint: {
      "fill-color": "rgba(255, 193, 7, 0.3)",
      "fill-outline-color": "#FFC107",
    },
  });

  // Closed areas
  map.addLayer({
    id: "closed-areas",
    type: "fill",
    source: "resort-data",
    filter: ["==", ["get", "type"], "zone:closed"],
    paint: {
      "fill-color": "rgba(244, 67, 54, 0.3)",
      "fill-outline-color": "#F44336",
    },
  });

  // Beginner areas
  map.addLayer({
    id: "beginner-areas",
    type: "fill",
    source: "resort-data",
    filter: ["==", ["get", "type"], "zone:beginner"],
    paint: {
      "fill-color": "rgba(76, 175, 80, 0.3)",
      "fill-outline-color": "#4CAF50",
    },
  });

  // Forest polygons (polygons with trees property)
  map.addLayer({
    id: "forests",
    type: "fill",
    source: "resort-data",
    filter: [
      "all",
      ["==", ["get", "trees"], true],
      ["==", ["geometry-type"], "Polygon"]
    ],
    paint: {
      "fill-color": "rgba(46, 125, 50, 0.4)",
      "fill-outline-color": "#2E7D32",
    },
  });

  // Individual trees (points) - using colored circles
  map.addLayer({
    id: "trees",
    type: "circle",
    source: "resort-data",
    filter: [
      "all",
      ["in", ["get", "type"], ["literal", ["tree:needle", "tree:broad", "tree:mixed"]]],
      ["==", ["geometry-type"], "Point"]
    ],
    paint: {
      "circle-radius": [
        "case",
        ["==", ["get", "source"], "osm"], 6, // OSM trees slightly larger
        4 // Generated trees normal size
      ],
      "circle-color": [
        "case",
        ["==", ["get", "type"], "tree:needle"], "#2E7D32", // Dark green for needle trees
        ["==", ["get", "type"], "tree:broad"], "#4CAF50", // Light green for broad trees
        ["==", ["get", "type"], "tree:mixed"], "#388E3C", // Medium green for mixed
        "#2E7D32" // Default dark green
      ],
      "circle-stroke-color": "#1B5E20",
      "circle-stroke-width": 1,
      "circle-opacity": 0.8
    }
  });

  // Rocks
  map.addLayer({
    id: "rocks",
    type: "fill",
    source: "resort-data",
    filter: ["==", ["get", "type"], "rock"],
    paint: {
      "fill-color": "rgba(158, 158, 158, 0.6)",
      "fill-outline-color": "#616161",
    },
  });
};

// Map interaction setup
const setupMapInteractions = (map, setSelectedFeature) => {
  if (!map || !setSelectedFeature) {
    console.warn('Map or setSelectedFeature not available for interaction setup');
    return;
  }

  const clickableLayers = ['boundaries', 'slow-zones', 'closed-areas', 'beginner-areas', 'forests', 'trees', 'rocks'];
  
  clickableLayers.forEach(layerId => {
    try {
      // Check if layer exists before adding event listeners
      if (!map.getLayer(layerId)) {
        console.warn(`Layer ${layerId} not found, skipping interaction setup`);
        return;
      }

      map.on('click', layerId, (e) => {
        try {
          // Additional safety checks
          if (!e || !e.features || !e.lngLat || !setSelectedFeature) {
            console.warn('Invalid click event data:', e);
            return;
          }

          if (e.features.length > 0) {
            const feature = e.features[0];
            
            // Validate feature data before processing
            if (!feature || !feature.properties) {
              console.warn('Invalid feature data:', feature);
              return;
            }

            console.log('Feature clicked:', { layerId, feature, coordinates: e.lngLat });
            
            // Create a safe copy of the feature data
            const safeFeature = {
              type: feature.type,
              geometry: feature.geometry,
              properties: { ...feature.properties },
              layerId: layerId,
              coordinates: {
                lng: e.lngLat.lng,
                lat: e.lngLat.lat
              }
            };

            setSelectedFeature(safeFeature);
          }
        } catch (error) {
          console.error('Error handling click for layer', layerId, ':', error);
          // Don't re-throw the error to prevent app crash
        }
      });

      // Change cursor on hover
      map.on('mouseenter', layerId, () => {
        try {
          const canvas = map.getCanvas();
          if (canvas) {
            canvas.style.cursor = 'pointer';
          }
        } catch (error) {
          console.warn('Error setting cursor on mouseenter:', error);
        }
      });

      map.on('mouseleave', layerId, () => {
        try {
          const canvas = map.getCanvas();
          if (canvas) {
            canvas.style.cursor = '';
          }
        } catch (error) {
          console.warn('Error resetting cursor on mouseleave:', error);
        }
      });
    } catch (error) {
      console.error(`Error setting up interactions for layer ${layerId}:`, error);
    }
  });
};


// Resort Selector Component
const ResortSelector = ({ resorts, selectedResort, onResortChange }) => (
  <div className="flex space-x-4">
    <label htmlFor="resort-select" className="sr-only">Select Resort</label>
    <select
      id="resort-select"
      value={selectedResort}
      onChange={onResortChange}
      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
    >
      <option value="">Select Resort</option>
      {resorts.map(resort => (
        <option key={resort} value={resort}>{resort}</option>
      ))}
    </select>
  </div>
);

// File Management Component
const FileManagement = ({ selectedResort, outputs, onDelete, deleting }) => (
  <Card className="p-6">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
      Files - {selectedResort}
    </h3>
    
    <div className="flex space-x-2 mb-4">
      {outputs[selectedResort] && (
        <Button
          size="sm"
          variant="success"
          onClick={() => downloadFile(selectedResort, outputs[selectedResort][0])}
        >
          📄 Download
        </Button>
      )}
      <Button
        size="sm"
        variant="danger"
        onClick={() => onDelete('entire', `Delete entire resort "${selectedResort}" including all files and configuration?`)}
        className="bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center space-x-2"
        disabled={deleting}
      >
        {deleting ? (
          <>
            <LoadingSpinner size="sm" />
            <span>Deleting...</span>
          </>
        ) : (
          <>
            <span>🗑️</span>
            <span>Delete Resort</span>
          </>
        )}
      </Button>
    </div>
    
    {outputs[selectedResort] ? (
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Available Downloads</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {outputs[selectedResort].map((file) => (
            <Button
              key={file}
              size="sm"
              variant="outline"
              onClick={() => downloadFile(selectedResort, file)}
              className="justify-start"
              aria-label={`Download ${file}`}
              title={`Download ${file}`}
            >
              📄 {file}
            </Button>
          ))}
        </div>
      </div>
    ) : (
      <p className="text-gray-600 dark:text-gray-400">No processed files available for download.</p>
    )}
  </Card>
);

// Feature Statistics Component
const FeatureStatistics = ({ featureStats }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <InfoCard
      title="Total Features"
      value={featureStats.total_features.toString()}
      icon="📊"
    />
    <InfoCard
      title="Trees"
      value={featureStats.trees.total.toString()}
      icon="🌲"
      subtitle={`${featureStats.trees.osm} OSM, ${featureStats.trees.generated} generated`}
    />
    <InfoCard
      title="Forests"
      value={featureStats.forests.total.toString()}
      icon="🌲"
      subtitle={`${featureStats.forests.area_hectares.toFixed(1)} hectares`}
    />
    <InfoCard
      title="Boundaries"
      value={featureStats.boundaries.total.toString()}
      icon="🗺️"
      subtitle={`${featureStats.boundaries.ski_area} ski, ${featureStats.boundaries.feature} feature`}
    />
  </div>
);

// Map Legend Component
const MapLegend = () => (
  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
    <div className="flex items-center space-x-2">
      <div className="w-4 h-4 bg-blue-500 bg-opacity-20 border border-blue-500 rounded"></div>
      <span className="text-gray-700 dark:text-gray-300">Ski Boundary</span>
    </div>
    <div className="flex items-center space-x-2">
      <div className="w-4 h-4 bg-purple-500 bg-opacity-20 border border-purple-500 rounded"></div>
      <span className="text-gray-700 dark:text-gray-300">Feature Boundary</span>
    </div>
    <div className="flex items-center space-x-2">
      <div className="w-4 h-4 bg-green-600 bg-opacity-40 border border-green-800 rounded"></div>
      <span className="text-gray-700 dark:text-gray-300">Forest</span>
    </div>
    <div className="flex items-center space-x-2">
      <div className="w-4 h-4 bg-green-700 rounded-full border border-green-900"></div>
      <span className="text-gray-700 dark:text-gray-300">Trees</span>
    </div>
    <div className="flex items-center space-x-2">
      <div className="w-4 h-4 bg-yellow-500 bg-opacity-30 border border-yellow-600 rounded"></div>
      <span className="text-gray-700 dark:text-gray-300">Slow Zone</span>
    </div>
    <div className="flex items-center space-x-2">
      <div className="w-4 h-4 bg-red-500 bg-opacity-30 border border-red-600 rounded"></div>
      <span className="text-gray-700 dark:text-gray-300">Closed Area</span>
    </div>
    <div className="flex items-center space-x-2">
      <div className="w-4 h-4 bg-gray-500 bg-opacity-60 border border-gray-600 rounded"></div>
      <span className="text-gray-700 dark:text-gray-300">Rock</span>
    </div>
  </div>
);

// Feature Details Component
const FeatureDetails = ({ selectedFeature }) => {
  if (!selectedFeature) return null;

  const props = selectedFeature.properties || {};
  const coords = selectedFeature.coordinates;

  // Helper function to format property values
  const formatValue = (key, value) => {
    if (value === null || value === undefined) return null;
    
    switch (key) {
      case 'area_sq_meters':
        return `${(value / 10000).toFixed(2)} hectares (${value.toLocaleString()} m²)`;
      case 'ZoneType':
        return value.replace(/([A-Z])/g, ' $1').trim(); // Add spaces before capitals
      case 'leaf_type':
        return value.charAt(0).toUpperCase() + value.slice(1);
      default:
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'number') return value.toLocaleString();
        return value.toString();
    }
  };

  // Get all non-internal properties to display
  const displayProps = Object.entries(props)
    .filter(([key, value]) => 
      value !== null && 
      value !== undefined && 
      value !== '' &&
      !key.startsWith('_') // Skip internal properties
    )
    .sort(([a], [b]) => a.localeCompare(b)); // Sort alphabetically

  return (
    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg" aria-live="polite">
      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Selected Feature</h4>
      
      {/* Basic info */}
      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
        <div className="grid grid-cols-2 gap-4">
          <div><strong>Type:</strong> {props.type || 'Unknown'}</div>
          <div><strong>Layer:</strong> {selectedFeature.layerId}</div>
        </div>
        
        {coords && (
          <div className="grid grid-cols-2 gap-4">
            <div><strong>Longitude:</strong> {coords.lng.toFixed(6)}</div>
            <div><strong>Latitude:</strong> {coords.lat.toFixed(6)}</div>
          </div>
        )}
        
        {/* Geometry type */}
        {selectedFeature.geometry && (
          <div><strong>Geometry:</strong> {selectedFeature.geometry.type}</div>
        )}

        {/* All other properties */}
        {displayProps.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-300 dark:border-gray-600">
            <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Properties</h5>
            <div className="space-y-1">
              {displayProps.map(([key, value]) => {
                const formattedValue = formatValue(key, value);
                if (!formattedValue) return null;
                
                return (
                  <div key={key} className="grid grid-cols-5 gap-2">
                    <div className="col-span-2 font-medium">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                    </div>
                    <div className="col-span-3">{formattedValue}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Interactive Map Component
const InteractiveMap = ({ mapboxToken, mapData, selectedResort, featureStats, selectedFeature, setSelectedFeature }) => {
  const { mapContainer } = useMapbox(mapboxToken, mapData, true, setSelectedFeature);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Interactive Map - {selectedResort}
        </h3>
        {featureStats && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {featureStats.trees.total} trees • {featureStats.forests.total} forests • {featureStats.boundaries.total} boundaries
          </div>
        )}
      </div>
      
      <div
        ref={mapContainer}
        className="w-full h-[560px] rounded-lg border border-gray-200 dark:border-gray-700"
        role="region"
        aria-label={selectedResort ? `${selectedResort} map` : 'Resort map'}
      />
      
      <MapLegend />
      <FeatureDetails selectedFeature={selectedFeature} />
    </Card>
  );
};

// Main MapViewer Component
const MapViewer = ({ refreshData }) => {
  const { state, actions } = window.AppState.useAppState();
  const { showError, showSuccess } = useNotifications();

  const handleResortSelection = async (e) => {
    const resort = e.target.value;
    
    // Update URL immediately for better UX
    actions.setSelectedResortWithUrl(resort);
    
    if (resort) {
      actions.setLoadingMap(true);
      try {
        const data = await loadMapData(resort);
        actions.setMapData(data);
        actions.setFeatureStats(calculateFeatureStats(data));
        actions.setShowMap(true);
      } catch (err) {
        console.error("Error loading map data:", err);
        showError("Failed to load map data. Please try again.", "Map Loading Error");
      } finally {
        actions.setLoadingMap(false);
      }
    } else {
      // Clear map state when no resort selected
      actions.resetMapState();
    }
  };

  const handleDelete = async (type, confirmMessage) => {
    const success = await actions.deleteResortAndCleanup(state.selectedResort);
    if (success) {
      showSuccess(`Resort "${state.selectedResort}" has been completely deleted.`, "Resort Deleted");
      if (refreshData) {
        refreshData();
      }
    } else if (state.selectedResort) {
      showError("Failed to delete resort. Please try again.", "Delete Error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            View Results
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Interactive map and download processed files
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {state.loadingMap && <LoadingSpinner size="sm" />}
          <ResortSelector 
            resorts={state.resorts}
            selectedResort={state.selectedResort}
            onResortChange={handleResortSelection}
          />
        </div>
      </div>

      {state.selectedResort && (
        <FileManagement 
          selectedResort={state.selectedResort}
          outputs={state.outputs}
          onDelete={handleDelete}
          deleting={state.deletingResort}
        />
      )}

      {state.featureStats && (
        <FeatureStatistics featureStats={state.featureStats} />
      )}

      {state.mapData && (
        <InteractiveMap 
          mapboxToken={state.mapboxToken}
          mapData={state.mapData}
          selectedResort={state.selectedResort}
          featureStats={state.featureStats}
          selectedFeature={state.selectedFeature}
          setSelectedFeature={actions.setSelectedFeature}
        />
      )}
    </div>
  );
};

// Export component
window.MapViewer = MapViewer;