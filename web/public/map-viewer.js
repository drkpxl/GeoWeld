// Map Viewer Tab Component for GeoWeld Resort Processor
const { useState, useEffect, useRef } = React;
const { Button, Card, InfoCard } = window.Components;
const { loadMapData, downloadFile, calculateFeatureStats } = window.ApiServices;

const MapViewer = ({ 
  resorts,
  selectedResort, 
  setSelectedResort,
  outputs,
  mapboxToken,
  mapData,
  setMapData,
  showMap,
  setShowMap,
  featureStats,
  setFeatureStats,
  selectedFeature,
  setSelectedFeature
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);

  const handleResortSelection = async (e) => {
    const resort = e.target.value;
    setSelectedResort(resort);
    if (resort) {
      try {
        const data = await loadMapData(resort);
        setMapData(data);
        setFeatureStats(calculateFeatureStats(data));
        setShowMap(true);
      } catch (err) {
        console.error("Error loading map data:", err);
      }
    }
  };

  // Map setup with proper styling
  useEffect(() => {
    if (!showMap || !mapboxToken || !mapData || !mapContainer.current) return;

    if (map.current) {
      map.current.remove();
    }

    // Ensure container has proper dimensions before initializing map
    const container = mapContainer.current;
    container.style.minHeight = '400px';
    container.style.height = '400px';
    container.style.width = '100%';
    
    // Small delay to ensure container is rendered with proper dimensions
    setTimeout(() => {
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

        // Calculate bounds with proper validation
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

        // Add the data source
        map.current.addSource('resort-data', {
          type: 'geojson',
          data: mapData,
        });

        // Boundaries (ski area and feature boundaries)
        map.current.addLayer({
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
        map.current.addLayer({
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
        map.current.addLayer({
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
        map.current.addLayer({
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
        map.current.addLayer({
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

        // Individual trees (points) - using custom sprites
        map.current.addLayer({
          id: "trees",
          type: "symbol",
          source: "resort-data",
          filter: [
            "all",
            ["in", ["get", "type"], ["literal", ["tree:needle", "tree:broad", "tree:mixed"]]],
            ["==", ["geometry-type"], "Point"]
          ],
          layout: {
            "icon-image": [
              "case",
              ["==", ["get", "type"], "tree:needle"], "tree-needle-001",
              ["==", ["get", "type"], "tree:broad"], "tree-broad-snow-001", 
              ["==", ["get", "type"], "tree:mixed"], "tree-needle-001", // Use needle as default for mixed
              "tree-needle-001" // Default fallback
            ],
            "icon-size": [
              "case",
              ["==", ["get", "source"], "osm"], 1.2, // OSM trees slightly larger
              1.0 // Generated trees normal size
            ],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true
          }
        });

        // Rocks
        map.current.addLayer({
          id: "rocks",
          type: "fill",
          source: "resort-data",
          filter: ["==", ["get", "type"], "rock"],
          paint: {
            "fill-color": "rgba(158, 158, 158, 0.6)",
            "fill-outline-color": "#616161",
          },
        });

        // Add click handlers for interactive features
        const clickableLayers = ['boundaries', 'slow-zones', 'closed-areas', 'beginner-areas', 'forests', 'trees', 'rocks'];
        
        clickableLayers.forEach(layerId => {
          map.current.on('click', layerId, (e) => {
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
          map.current.on('mouseenter', layerId, () => {
            map.current.getCanvas().style.cursor = 'pointer';
          });

          map.current.on('mouseleave', layerId, () => {
            map.current.getCanvas().style.cursor = '';
          });
        });

        // Use default A-Basin coordinates instead of automatic bounds fitting
        // This prevents the "narrow silver" display issue
        console.log('Setting default A-Basin view');
        map.current.setCenter([-105.8717, 39.6403]); // A-Basin coordinates
        map.current.setZoom(13);
        
        // Additional resize call after everything is loaded
        setTimeout(() => {
          if (map.current) {
            map.current.resize();
            map.current.setCenter([-105.8717, 39.6403]);
            map.current.setZoom(13);
          }
        }, 500);
      });

      return () => {
        if (map.current) {
          map.current.remove();
          map.current = null;
        }
      };
    }, 100); // Close the main setTimeout
  }, [showMap, mapData, mapboxToken]);

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
        
        <div className="flex space-x-4">
          <select
            value={selectedResort}
            onChange={handleResortSelection}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select Resort</option>
            {resorts.map(resort => (
              <option key={resort} value={resort}>{resort}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedResort && outputs[selectedResort] && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Download Files - {selectedResort}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {outputs[selectedResort].map((file) => (
              <Button
                key={file}
                variant="outline"
                onClick={() => downloadFile(selectedResort, file)}
                className="justify-start"
              >
                📄 {file}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {featureStats && (
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
      )}

      {mapData && (
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
          
          <div ref={mapContainer} className="w-full h-96 rounded-lg border border-gray-200 dark:border-gray-700" />
          
          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
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
          
          {selectedFeature && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
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
          )}
        </Card>
      )}
    </div>
  );
};

// Export component
window.MapViewer = MapViewer;