// Map Viewer Tab Component for GeoWeld Resort Processor
// Refactored into smaller, focused components
const { useState, useEffect, useRef } = React;
const { Button, Card, InfoCard, LoadingSpinner } = window.Components;
const { loadMapData, downloadFile, calculateFeatureStats, deleteEntireResort } = window.ApiServices;
const { useNotifications } = window.NotificationSystem;

// Custom hook for map management
const useMapbox = (mapboxToken, mapData, showMap, setSelectedFeature) => {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (!showMap || !mapboxToken || !mapData || !mapContainer.current) return;

    if (map.current) {
      map.current.remove();
    }

    // Ensure container has proper dimensions before initializing map
    const container = mapContainer.current;
    container.style.minHeight = '560px';
    container.style.height = '560px';
    container.style.width = '100%';
    
    // Small delay to ensure container is rendered with proper dimensions
    const initTimeout = setTimeout(() => {
      mapboxgl.accessToken = mapboxToken;
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        center: [-72.908, 43.117],
        zoom: 12
      });

      // Immediately resize after creation
      setTimeout(() => {
        if (map.current) {
          map.current.resize();
        }
      }, 50);

      map.current.on('load', () => {
        // Force map resize to ensure proper container dimensions
        setTimeout(() => {
          if (map.current) {
            map.current.resize();
          }
        }, 100);

        // Add data and layers
        setupMapLayers(map.current, mapData);
        setupMapInteractions(map.current, setSelectedFeature);
        fitMapToBounds(map.current, mapData);
        
        // Additional resize call after everything is loaded
        setTimeout(() => {
          if (map.current) {
            map.current.resize();
          }
        }, 500);
      });

      return () => {
        if (map.current) {
          map.current.remove();
          map.current = null;
        }
      };
    }, 100);

    return () => clearTimeout(initTimeout);
  }, [showMap, mapData, mapboxToken, setSelectedFeature]);

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
  const clickableLayers = ['boundaries', 'slow-zones', 'closed-areas', 'beginner-areas', 'forests', 'trees', 'rocks'];
  
  clickableLayers.forEach(layerId => {
    map.on('click', layerId, (e) => {
      try {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          console.log('Feature clicked:', { layerId, feature, coordinates: e.lngLat });
          setSelectedFeature({
            ...feature,
            layerId: layerId,
            coordinates: e.lngLat
          });
        }
      } catch (error) {
        console.error('Error handling click:', error);
      }
    });

    // Change cursor on hover
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  });
};

// Calculate and fit map to bounds
const fitMapToBounds = (map, mapData) => {
  const bounds = new mapboxgl.LngLatBounds();
  let hasValidBounds = false;

  if (mapData && mapData.features && mapData.features.length > 0) {
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
        console.warn('Error processing feature bounds:', error);
      }
    });
  }

  // Fit map to actual data bounds if available
  if (hasValidBounds) {
    try {
      map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 15
      });
    } catch (error) {
      console.warn('Error fitting bounds, using fallback coordinates');
      // Fallback to center of data or default coordinates
      const center = bounds.getCenter();
      if (center && !isNaN(center.lng) && !isNaN(center.lat)) {
        map.setCenter([center.lng, center.lat]);
        map.setZoom(13);
      } else {
        map.setCenter([-105.8717, 39.6403]); // A-Basin fallback
        map.setZoom(13);
      }
    }
  } else {
    map.setCenter([-105.8717, 39.6403]); // A-Basin fallback
    map.setZoom(13);
  }
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

  return (
    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg" aria-live="polite">
      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Selected Feature</h4>
      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
        <div><strong>Type:</strong> {selectedFeature.properties.type || 'Unknown'}</div>
        <div><strong>Layer:</strong> {selectedFeature.layerId}</div>
        {selectedFeature.properties.source && (
          <div><strong>Source:</strong> {selectedFeature.properties.source}</div>
        )}
        {selectedFeature.properties.area_sq_meters && (
          <div><strong>Area:</strong> {(selectedFeature.properties.area_sq_meters / 10000).toFixed(2)} hectares</div>
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