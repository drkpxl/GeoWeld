const { useState, useEffect, useRef } = React;

const API_URL = "";

function App() {
  // Navigation state - replaces step-based workflow
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'upload', 'configure', 'process', 'viewer'
  const [step, setStep] = useState(1); // Keep for upload workflow only
  
  // Resort and configuration state
  const [resortName, setResortName] = useState("");
  const [resorts, setResorts] = useState([]);
  const [selectedResort, setSelectedResort] = useState(""); // For processing
  const [viewingResort, setViewingResort] = useState(""); // For viewing maps
  const [config, setConfig] = useState(null);
  const [configSaved, setConfigSaved] = useState(false);
  
  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processOutput, setProcessOutput] = useState([]);
  const [outputs, setOutputs] = useState({});
  
  // Map state
  const [mapboxToken, setMapboxToken] = useState("");
  const [mapData, setMapData] = useState(null);
  const [showMap, setShowMap] = useState(false);
  
  // UI state
  const [uploadError, setUploadError] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [featureStats, setFeatureStats] = useState(null);
  
  // Refs
  const mapContainer = useRef(null);
  const map = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => {
    loadResorts();
    loadOutputs();
    fetchMapboxToken();
  }, []);

  const fetchMapboxToken = async () => {
    try {
      const res = await fetch(`${API_URL}/api/mapbox-token`);
      const data = await res.json();
      if (data.token && data.token !== 'your_mapbox_token_here') {
        setMapboxToken(data.token);
      } else {
        console.warn("Mapbox token not configured. Maps will not be available.");
        setMapboxToken(null);
      }
    } catch (err) {
      console.error("Error fetching Mapbox token:", err);
      setMapboxToken(null);
    }
  };

  const loadResorts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/resorts`);
      const data = await res.json();
      setResorts(data);
    } catch (err) {
      console.error("Error loading resorts:", err);
    }
  };

  const loadOutputs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/outputs`);
      const data = await res.json();
      setOutputs(data);
    } catch (err) {
      console.error("Error loading outputs:", err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !resortName.trim()) {
      alert("Please enter a resort name first");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "resortName",
      resortName.toLowerCase().replace(/\s+/g, "_")
    );

    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setSelectedResort(data.resort);
        await loadResorts();
        await loadConfig(data.resort);
        setStep(3);
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (err) {
      alert("Error uploading file: " + err.message);
    }
  };

  const loadConfig = async (resort) => {
    try {
      const res = await fetch(`${API_URL}/api/resort/${resort}`);
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      console.error("Error loading config:", err);
    }
  };

  const updateConfig = async () => {
    if (!selectedResort || !config) return;

    try {
      await fetch(`${API_URL}/api/resort/${selectedResort}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          tree_config: config.tree_config,
          default_tree_type: config.default_tree_type
        }),
      });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Error updating config:", err);
    }
  };

  const processResort = async () => {
    if (!selectedResort) return;

    setProcessing(true);
    setProcessOutput([]);
    setStep(4);

    const eventSource = new EventSource(
      `${API_URL}/api/process/${selectedResort}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "stdout" || data.type === "stderr") {
        setProcessOutput((prev) => [
          ...prev,
          { type: data.type, message: data.message },
        ]);
      } else if (data.type === "done") {
        setProcessing(false);
        eventSource.close();
        loadOutputs();
        loadProcessedData();
        if (data.code === 0) {
          setConfigSaved(false); // Reset config saved state after successful processing
        }
      } else if (data.type === "error") {
        setProcessing(false);
        eventSource.close();
        setProcessOutput((prev) => [
          ...prev,
          { type: "error", message: data.message },
        ]);
      }
    };

    eventSource.onerror = () => {
      setProcessing(false);
      eventSource.close();
    };
  };

  const loadProcessedData = async (resortName = selectedResort) => {
    if (!resortName) return;

    try {
      const res = await fetch(`${API_URL}/api/output/${resortName}`);
      if (res.ok) {
        const data = await res.json();
        setMapData(data);
      }
    } catch (err) {
      console.error("Error loading processed data:", err);
    }
  };

  // Load map data for viewing (separate from processing)
  const loadMapForViewing = async (resortName) => {
    if (!resortName) return;
    
    setViewingResort(resortName);
    try {
      const res = await fetch(`${API_URL}/api/output/${resortName}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.features) {
          setMapData(data);
          setCurrentView('viewer');
          // Delay showing map to ensure the container is mounted
          setTimeout(() => setShowMap(true), 100);
        } else {
          console.error("Invalid map data received:", data);
          alert(`Invalid map data received for ${resortName}. The processed data may be corrupted.`);
        }
      } else {
        const errorText = await res.text();
        console.error(`API error ${res.status}: ${errorText}`);
        alert(`No processed data found for ${resortName}. Process it first. (Status: ${res.status})`);
      }
    } catch (err) {
      console.error("Error loading map data:", err);
      alert(`Error loading map data for ${resortName}: ${err.message}`);
    }
  };

  // Clean up map when switching views
  useEffect(() => {
    if (currentView !== 'viewer') {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      setShowMap(false);
      setMapData(null);
    }
  }, [currentView]);

  useEffect(() => {
    if (showMap && mapData && mapboxToken && !map.current && mapContainer.current) {
      mapboxgl.accessToken = mapboxToken;

      // Calculate center from the data bounds
      const bounds = new mapboxgl.LngLatBounds();
      mapData.features.forEach((feature) => {
        if (feature.geometry.type === "Polygon") {
          feature.geometry.coordinates[0].forEach((coord) => {
            bounds.extend(coord);
          });
        } else if (feature.geometry.type === "Point") {
          bounds.extend(feature.geometry.coordinates);
        }
      });

      const center = bounds.getCenter();

      try {
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/outdoors-v12",
          center: [center.lng, center.lat],
          zoom: 14,
        });
      } catch (error) {
        console.error("Error initializing map:", error);
        alert(`Error initializing map: ${error.message}`);
        return;
      }

      map.current.on("load", () => {
        // Calculate feature statistics
        const stats = calculateFeatureStats(mapData);
        setFeatureStats(stats);

        // Add the GeoJSON source
        map.current.addSource("resort-data", {
          type: "geojson",
          data: mapData,
        });

        // Add layers for different feature types
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

        // Fit to bounds with padding
        map.current.fitBounds(bounds, { padding: 50 });
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [showMap, mapData, mapboxToken]);

  const downloadFile = (resort, file) => {
    window.open(`${API_URL}/api/download/${resort}/${file}`, "_blank");
  };

  const calculateFeatureStats = (geoJsonData) => {
    if (!geoJsonData?.features) return null;

    const stats = {
      total_features: 0,
      boundaries: { total: 0, ski_area: 0, feature: 0 },
      zones: { slow: 0, closed: 0, beginner: 0 },
      forests: { total: 0, area_hectares: 0 },
      trees: {
        total: 0,
        osm: 0,
        generated: 0,
        needle: 0,
        broad: 0,
        mixed: 0,
        unknown: 0
      },
      rocks: { total: 0, area_hectares: 0 }
    };

    geoJsonData.features.forEach(feature => {
      const type = feature.properties.type;
      const geomType = feature.geometry.type;

      stats.total_features++;

      if (type?.startsWith('boundary:')) {
        stats.boundaries.total++;
        if (type === 'boundary:ski') stats.boundaries.ski_area++;
        else if (type === 'boundary:feature') stats.boundaries.feature++;
      } else if (type?.startsWith('zone:')) {
        if (type === 'zone:slow') stats.zones.slow++;
        else if (type === 'zone:closed') stats.zones.closed++;
        else if (type === 'zone:beginner') stats.zones.beginner++;
      } else if (feature.properties.trees && geomType === 'Polygon') {
        stats.forests.total++;
        if (feature.properties.area_sq_meters) {
          stats.forests.area_hectares += feature.properties.area_sq_meters / 10000;
        }
      } else if (type?.startsWith('tree:') && geomType === 'Point') {
        stats.trees.total++;
        
        // Count by source
        if (feature.properties.source === 'osm') stats.trees.osm++;
        else stats.trees.generated++;

        // Count by type
        if (type === 'tree:needle') stats.trees.needle++;
        else if (type === 'tree:broad') stats.trees.broad++;
        else if (type === 'tree:mixed') stats.trees.mixed++;
        else stats.trees.unknown++;
      } else if (type === 'rock') {
        stats.rocks.total++;
        if (feature.properties.area_sq_meters) {
          stats.rocks.area_hectares += feature.properties.area_sq_meters / 10000;
        }
      }
    });

    // Round hectares to 2 decimal places
    stats.forests.area_hectares = Math.round(stats.forests.area_hectares * 100) / 100;
    stats.rocks.area_hectares = Math.round(stats.rocks.area_hectares * 100) / 100;

    return stats;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
            GeoWeld Resort Processor
          </h1>
          <p className="text-gray-600">
            Upload, configure, and process ski resort boundary data
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                currentView === 'dashboard'
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setCurrentView('viewer')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                currentView === 'viewer'
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🗺️ View Maps
            </button>
            <button
              onClick={() => setCurrentView('configure')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                currentView === 'configure'
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ⚙️ Configure
            </button>
            <button
              onClick={() => setCurrentView('upload')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                currentView === 'upload'
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📁 Upload New
            </button>
          </div>
        </div>

        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Resort Dashboard</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Available Resorts */}
              <div>
                <h3 className="text-lg font-medium mb-3 text-gray-800">Available Resorts</h3>
                {resorts.length > 0 ? (
                  <div className="space-y-2">
                    {resorts.map((resort) => (
                      <div key={resort} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <span className="font-medium">{resort}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadMapForViewing(resort)}
                            className={`px-3 py-1 rounded text-sm ${
                              !outputs[resort] || mapboxToken === null
                                ? 'bg-gray-400 text-white cursor-not-allowed'
                                : 'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                            disabled={!outputs[resort] || mapboxToken === null}
                            title={mapboxToken === null ? 'Mapbox token required for map viewing' : ''}
                          >
                            {!outputs[resort] ? '⏳ Not Processed' : mapboxToken === null ? '🚫 No Token' : '🗺️ View'}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedResort(resort);
                              loadConfig(resort);
                              setCurrentView('configure');
                            }}
                            className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                          >
                            ⚙️ Configure
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No resorts available. Upload boundaries to create a new resort.</p>
                )}
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="text-lg font-medium mb-3 text-gray-800">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setCurrentView('upload')}
                    className="w-full bg-green-500 text-white px-4 py-3 rounded-md hover:bg-green-600 font-medium"
                  >
                    📁 Upload New Resort Data
                  </button>
                  <button
                    onClick={() => setCurrentView('viewer')}
                    className={`w-full px-4 py-3 rounded-md font-medium ${
                      mapboxToken === null
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                    disabled={mapboxToken === null}
                    title={mapboxToken === null ? 'Mapbox token required for map viewing' : ''}
                  >
                    {mapboxToken === null ? '🚫 Map Viewer (No Token)' : '🗺️ Open Map Viewer'}
                  </button>
                  {resorts.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedResort(resorts[0]);
                        loadConfig(resorts[0]);
                        setCurrentView('configure');
                      }}
                      className="w-full bg-gray-500 text-white px-4 py-3 rounded-md hover:bg-gray-600 font-medium"
                    >
                      ⚙️ Configure Settings
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Processing Status */}
            {processing && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                  <span className="text-blue-800 font-medium">Processing {selectedResort}...</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Map Viewer */}
        {currentView === 'viewer' && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Map Viewer</h2>
            
            {/* Resort Selection for Viewing */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Resort to View
              </label>
              <div className="flex gap-2">
                <select
                  value={viewingResort}
                  onChange={(e) => {
                    if (e.target.value) {
                      loadMapForViewing(e.target.value);
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Choose a resort...</option>
                  {resorts.filter(resort => outputs[resort]).map((resort) => (
                    <option key={resort} value={resort}>
                      {resort}
                    </option>
                  ))}
                </select>
                {viewingResort && (
                  <button
                    onClick={() => {
                      setShowMap(false);
                      setMapData(null);
                      setViewingResort("");
                      if (map.current) {
                        map.current.remove();
                        map.current = null;
                      }
                    }}
                    className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                  >
                    Clear Map
                  </button>
                )}
              </div>
            </div>

            {/* Map Display */}
            {showMap && mapData && (
              <div className="space-y-6">
                {/* Feature Statistics Dashboard */}
                {featureStats && (
                  <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">Feature Statistics - {viewingResort}</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      {/* Total Features */}
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-2xl font-bold text-blue-600">{featureStats.total_features}</div>
                        <div className="text-sm text-gray-600">Total Features</div>
                      </div>

                      {/* Boundaries */}
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-2xl font-bold text-purple-600">{featureStats.boundaries.total}</div>
                        <div className="text-sm text-gray-600">Boundaries</div>
                        <div className="text-xs text-gray-500">
                          {featureStats.boundaries.ski_area} ski • {featureStats.boundaries.feature} feature
                        </div>
                      </div>

                      {/* Forests */}
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-2xl font-bold text-green-600">{featureStats.forests.total}</div>
                        <div className="text-sm text-gray-600">Forest Areas</div>
                        <div className="text-xs text-gray-500">
                          {featureStats.forests.area_hectares} hectares
                        </div>
                      </div>

                      {/* Total Trees */}
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-2xl font-bold text-emerald-600">{featureStats.trees.total}</div>
                        <div className="text-sm text-gray-600">Tree Points</div>
                        <div className="text-xs text-gray-500">
                          {featureStats.trees.osm} OSM • {featureStats.trees.generated} generated
                        </div>
                      </div>
                    </div>

                    {/* Tree Type Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="flex items-center mb-2">
                          <div className="w-3 h-3 rounded-full bg-green-800 mr-2"></div>
                          <span className="text-sm font-medium text-gray-700">Needle Trees</span>
                        </div>
                        <div className="text-lg font-bold text-green-800">{featureStats.trees.needle}</div>
                      </div>
                      
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="flex items-center mb-2">
                          <div className="w-3 h-3 rounded-full bg-green-400 mr-2"></div>
                          <span className="text-sm font-medium text-gray-700">Broad Trees</span>
                        </div>
                        <div className="text-lg font-bold text-green-400">{featureStats.trees.broad}</div>
                      </div>
                      
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="flex items-center mb-2">
                          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                          <span className="text-sm font-medium text-gray-700">Mixed Trees</span>
                        </div>
                        <div className="text-lg font-bold text-green-500">{featureStats.trees.mixed}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Enhanced Map */}
                <div className="relative">
                  <div
                    ref={mapContainer}
                    className="w-full h-128 rounded-lg mb-4 border-2 border-gray-200"
                    style={{ height: '32rem' }}
                  ></div>
                  
                  {/* Click instruction */}
                  <div className="absolute top-2 left-2 bg-white bg-opacity-90 px-3 py-1 rounded-md text-xs text-gray-600">
                    💡 Click on features to inspect details
                  </div>
                </div>

                {/* Enhanced Legend */}
                <div className="bg-white p-4 rounded-lg border">
                  <h4 className="font-medium text-gray-800 mb-3">Map Legend</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-blue-200 border border-blue-500 mr-2 rounded"></div>
                      <span>Boundaries ({featureStats?.boundaries.total || 0})</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-yellow-300 border border-yellow-600 mr-2 rounded"></div>
                      <span>Slow Zones ({featureStats?.zones.slow || 0})</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-red-300 border border-red-600 mr-2 rounded"></div>
                      <span>Closed Areas ({featureStats?.zones.closed || 0})</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-300 border border-green-600 mr-2 rounded"></div>
                      <span>Beginner Areas ({featureStats?.zones.beginner || 0})</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-600 mr-2 rounded"></div>
                      <span>Forests ({featureStats?.forests.total || 0})</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-gray-500 mr-2 rounded"></div>
                      <span>Rocks ({featureStats?.rocks.total || 0})</span>
                    </div>
                  </div>
                  
                  {/* Tree Legend */}
                  <div className="mt-4 pt-4 border-t">
                    <h5 className="font-medium text-gray-700 mb-2">Tree Types</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-green-900 mr-2"></div>
                        <span>Needle ({featureStats?.trees.needle || 0})</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-green-400 mr-2"></div>
                        <span>Broad ({featureStats?.trees.broad || 0})</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                        <span>Mixed ({featureStats?.trees.mixed || 0})</span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Larger circles = OSM data • Smaller circles = Generated points
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!showMap && (
              <div className="text-center py-12">
                {mapboxToken === null ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <div className="flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-yellow-800 mb-2">Map Viewer Not Available</h3>
                    <p className="text-yellow-700 mb-4">
                      Mapbox token is not configured. Maps cannot be displayed without a valid Mapbox access token.
                    </p>
                    <div className="text-sm text-yellow-600 bg-yellow-100 rounded-md p-3">
                      <p className="font-medium mb-1">To enable map viewing:</p>
                      <ol className="text-left list-decimal list-inside space-y-1">
                        <li>Get a free token at <code>https://account.mapbox.com/access-tokens/</code></li>
                        <li>Copy <code>.env.example</code> to <code>.env</code></li>
                        <li>Set <code>MAPBOX_TOKEN=your_token_here</code> in the .env file</li>
                        <li>Restart the server</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-500 mb-4">Select a processed resort from the dropdown above to view its map</p>
                    <div className="text-sm text-gray-400">
                      Available resorts: {resorts.filter(resort => outputs[resort]).join(', ') || 'None processed yet'}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Upload New Resort */}
        {currentView === 'upload' && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              Step 1 & 2: Upload Boundaries & Name Resort
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resort Name
              </label>
              <input
                type="text"
                value={resortName}
                onChange={(e) => setResortName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., stratton, mammoth, steamboat"
              />
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                ref={fileInput}
                type="file"
                accept=".geojson"
                onChange={handleFileUpload}
                className="hidden"
                disabled={!resortName.trim()}
              />
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <button
                onClick={() => fileInput.current?.click()}
                disabled={!resortName.trim()}
                className={`px-4 py-2 rounded-md font-medium ${
                  resortName.trim()
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Choose boundaries.geojson
              </button>
              <p className="text-sm text-gray-500 mt-2">
                {resortName.trim()
                  ? "Click to upload your boundaries.geojson file"
                  : "Enter a resort name first"}
              </p>
              
              {/* Upload error feedback */}
              {uploadError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex">
                    <svg className="flex-shrink-0 h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{uploadError}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex">
                    <svg className="flex-shrink-0 h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-800 font-medium">File validation warnings:</p>
                      <ul className="mt-1 text-sm text-yellow-700 list-disc list-inside">
                        {validationErrors.map((error, i) => <li key={i}>{error}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {resorts.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">
                  Or select existing resort:
                </p>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedResort(e.target.value);
                      loadConfig(e.target.value);
                      setStep(3);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select a resort...</option>
                  {resorts.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Configure Resort */}
        {currentView === 'configure' && (
          <div>
            {!selectedResort ? (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Select Resort to Configure</h2>
                <p className="text-gray-600 mb-4">Choose a resort to modify its tree generation settings.</p>
                
                <div className="space-y-2">
                  {resorts.map((resort) => (
                    <button
                      key={resort}
                      onClick={() => {
                        setSelectedResort(resort);
                        loadConfig(resort);
                      }}
                      className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-md transition-all"
                    >
                      <div className="font-medium">{resort}</div>
                      <div className="text-sm text-gray-500">
                        {outputs[resort] ? 'Processed' : 'Not processed yet'}
                      </div>
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                  Back to Dashboard
                </button>
              </div>
            ) : config ? (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              Configure Tree Generation
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Configuring: {selectedResort}
            </p>
            
            {configSaved && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-green-800 font-medium">Configuration saved successfully!</span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Tree Type
                </label>
                <select
                  value={config.default_tree_type || 'tree:mixed'}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      default_tree_type: e.target.value,
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="tree:mixed">Mixed (deciduous + coniferous)</option>
                  <option value="tree:needle">Needle (coniferous/evergreen)</option>
                  <option value="tree:broad">Broad (deciduous/broadleaved)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Used when OSM data doesn't specify tree type. Choose based on your resort's typical forest ecology.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Small Area Trees (per hectare):{" "}
                  {config.tree_config.trees_per_small_hectare}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={config.tree_config.trees_per_small_hectare}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      tree_config: {
                        ...config.tree_config,
                        trees_per_small_hectare: parseInt(e.target.value),
                      },
                    });
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medium Area Trees (per hectare):{" "}
                  {config.tree_config.trees_per_medium_hectare}
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={config.tree_config.trees_per_medium_hectare}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      tree_config: {
                        ...config.tree_config,
                        trees_per_medium_hectare: parseInt(e.target.value),
                      },
                    });
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Large Area Trees (per hectare):{" "}
                  {config.tree_config.trees_per_large_hectare}
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={config.tree_config.trees_per_large_hectare}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      tree_config: {
                        ...config.tree_config,
                        trees_per_large_hectare: parseInt(e.target.value),
                      },
                    });
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Trees per Polygon:{" "}
                  {config.tree_config.max_trees_per_polygon}
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={config.tree_config.max_trees_per_polygon}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      tree_config: {
                        ...config.tree_config,
                        max_trees_per_polygon: parseInt(e.target.value),
                      },
                    });
                  }}
                  className="w-full"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={updateConfig}
                className={`flex-1 px-4 py-3 rounded-md font-medium text-sm sm:text-base transition-all ${
                  configSaved
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-500 text-white hover:bg-gray-600'
                }`}
              >
                {configSaved ? '✓ Settings Saved' : '💾 Save Settings'}
              </button>
              <button
                onClick={() => {
                  setCurrentView('process');
                  processResort();
                }}
                className="flex-1 bg-blue-500 text-white px-4 py-3 rounded-md hover:bg-blue-600 font-medium text-sm sm:text-base"
              >
                🚀 Process Resort
              </button>
              <button
                onClick={() => setCurrentView('dashboard')}
                className="px-4 py-3 border border-gray-300 rounded-md hover:bg-gray-50 text-sm sm:text-base"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Loading Configuration...</h2>
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Processing View */}
        {currentView === 'process' && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              Step 4: Processing Resort
            </h2>

            {/* Progress indicator */}
            {processing && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Processing...</span>
                  <span className="text-sm text-gray-500">This may take a few minutes</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full animate-pulse" style={{width: '45%'}}></div>
                </div>
              </div>
            )}

            {/* Status message */}
            {processOutput.length > 0 && (
              <div className="mb-4">
                {processing ? (
                  <div className="flex items-center text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    <span className="text-sm">Processing resort data...</span>
                  </div>
                ) : (
                  <div className="flex items-center text-green-600">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">Processing completed successfully</span>
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
              {processOutput.map((line, i) => (
                <div
                  key={i}
                  className={`${line.type === "stderr" ? "text-yellow-400" : ""} ${line.type === "error" ? "text-red-400" : ""}`}
                >
                  {line.message}
                </div>
              ))}
              {processing && processOutput.length === 0 && (
                <div className="animate-pulse-slow">Starting processing...</div>
              )}
            </div>

            {!processing && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => {
                    loadProcessedData();
                    setCurrentView('viewer');
                  }}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  🗺️ View Results
                </button>
                <button
                  onClick={() => setCurrentView('configure')}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  ⚙️ Adjust Settings
                </button>
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
                >
                  📊 Dashboard
                </button>
              </div>
            )}
          </div>
        )}

        {/* Downloads section - now integrated into dashboard */}
        {currentView === 'dashboard' && Object.keys(outputs).length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Download Processed Files</h2>

            {Object.entries(outputs).map(([resort, files]) => (
              <div key={resort} className="mb-4">
                <h3 className="font-medium text-gray-700 mb-2">{resort}</h3>
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <span className="text-sm">{file}</span>
                      <button
                        onClick={() => downloadFile(resort, file)}
                        className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Feature Inspection Modal - Simple Version */}
        {selectedFeature && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-800">Feature Details</h3>
                <button
                  onClick={() => setSelectedFeature(null)}
                  className="text-gray-500 hover:text-gray-700 text-xl font-bold"
                >
                  ×
                </button>
              </div>
              <div className="p-4">
                <div className="mb-2">
                  <strong>Type:</strong> {selectedFeature.properties?.type || 'Unknown'}
                </div>
                <div className="mb-2">
                  <strong>Layer:</strong> {selectedFeature.layerId || 'Unknown'}
                </div>
                <div className="mb-2">
                  <strong>Geometry:</strong> {selectedFeature.geometry?.type || 'Unknown'}
                </div>
                <div className="mb-4">
                  <strong>Properties:</strong>
                  <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
{JSON.stringify(selectedFeature.properties || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));
