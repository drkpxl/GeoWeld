const { useState, useEffect, useRef, createContext, useContext } = React;

const API_URL = "";

// Theme Context
const ThemeContext = createContext();

const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

const useTheme = () => useContext(ThemeContext);

// Button Component  
const Button = ({ children, variant = 'primary', size = 'md', className = '', disabled = false, onClick, ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-500',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500',
    success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    outline: 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-gray-500',
  };
  
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

// Card Component
const Card = ({ children, className = '' }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 ${className}`}>
      {children}
    </div>
  );
};

// InfoCard Component
const InfoCard = ({ title, value, icon, subtitle, onClick }) => {
  return (
    <Card className={`p-6 ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750' : ''}`} onClick={onClick}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className="text-3xl">{icon}</div>
        </div>
        <div className="ml-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </div>
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

// Header Component
const Header = ({ toggleSidebar }) => {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center">
          <button
            onClick={toggleSidebar}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors lg:hidden"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center ml-4 lg:ml-0">
            <span className="text-2xl mr-2">⛰️</span>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">
              GeoWeld Resort Processor
            </h1>
          </div>
        </div>

        <button
          onClick={toggleDarkMode}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
};

// Sidebar Component
const Sidebar = ({ isOpen, toggleSidebar, activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'upload', icon: '📁', label: 'Upload Data' },
    { id: 'configure', icon: '⚙️', label: 'Configure' },
    { id: 'process', icon: '🔄', label: 'Process' },
    { id: 'view', icon: '🗺️', label: 'View Results' },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={toggleSidebar}
        />
      )}
      
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-white dark:bg-gray-800 shadow-lg transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center h-16 px-6 border-b border-gray-200 dark:border-gray-700">
            <span className="text-2xl">⛰️</span>
            <span className="ml-2 text-xl font-bold text-gray-800 dark:text-white">
              GeoWeld
            </span>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (window.innerWidth < 1024) {
                    toggleSidebar();
                  }
                }}
                className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span className="text-xl mr-3">{tab.icon}</span>
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [resortName, setResortName] = useState("");
  const [resorts, setResorts] = useState([]);
  const [selectedResort, setSelectedResort] = useState("");
  const [config, setConfig] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processOutput, setProcessOutput] = useState([]);
  const [outputs, setOutputs] = useState({});
  const [mapboxToken, setMapboxToken] = useState("");
  const [mapData, setMapData] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [featureStats, setFeatureStats] = useState(null);
  const mapContainer = useRef(null);
  const map = useRef(null);
  const fileInput = useRef(null);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  useEffect(() => {
    loadResorts();
    loadOutputs();
    fetchMapboxToken();
  }, []);

  const fetchMapboxToken = async () => {
    try {
      const res = await fetch(`${API_URL}/api/mapbox-token`);
      const data = await res.json();
      setMapboxToken(data.token);
    } catch (err) {
      console.error("Error fetching Mapbox token:", err);
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
      setUploadError("Please enter a resort name first");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "resortName",
      resortName.toLowerCase().replace(/\s+/g, "_")
    );

    try {
      setUploadError("");
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setSelectedResort(data.resort);
        await loadResorts();
        await loadConfig(data.resort);
        setActiveTab('configure');
      } else {
        setUploadError(data.error || "Upload failed");
      }
    } catch (err) {
      setUploadError("Error uploading file: " + err.message);
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
    try {
      const res = await fetch(`${API_URL}/api/resort/${selectedResort}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        alert("Configuration updated successfully!");
      }
    } catch (err) {
      alert("Error updating config: " + err.message);
    }
  };

  const processResort = async () => {
    setProcessing(true);
    setProcessOutput([]);
    try {
      const eventSource = new EventSource(`${API_URL}/api/process/${selectedResort}`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setProcessOutput((prev) => [...prev, data]);
        
        if (data.type === 'done') {
          eventSource.close();
          setProcessing(false);
          if (data.code === 0) {
            loadOutputs();
            setActiveTab('view');
          }
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setProcessing(false);
      };
    } catch (error) {
      setProcessing(false);
    }
  };

  const loadMapData = async (resort) => {
    try {
      const res = await fetch(`${API_URL}/api/output/${resort}`);
      const data = await res.json();
      setMapData(data);
      setFeatureStats(calculateFeatureStats(data));
    } catch (err) {
      console.error("Error loading map data:", err);
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
      } else if (type === 'rock' && geomType === 'Polygon') {
        stats.rocks.total++;
        if (feature.properties.area_sq_meters) {
          stats.rocks.area_hectares += feature.properties.area_sq_meters / 10000;
        }
      }
    });

    return stats;
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar 
        isOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <div className="flex flex-col flex-1 lg:ml-64">
        <Header toggleSidebar={toggleSidebar} />

        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Dashboard
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Upload, configure, and process ski resort boundary data
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <InfoCard
                  title="Total Resorts"
                  value={resorts.length.toString()}
                  icon="⛰️"
                />
                <InfoCard
                  title="Processed"
                  value={Object.keys(outputs).length.toString()}
                  icon="✅"
                  subtitle={`${resorts.length - Object.keys(outputs).length} pending`}
                />
                <InfoCard
                  title="Map Viewer"
                  value="Ready"
                  icon="🗺️"
                  subtitle="Maps available"
                  onClick={() => setActiveTab('view')}
                />
                <InfoCard
                  title="Processing"
                  value={processing ? "Active" : "Idle"}
                  icon={processing ? "⏯️" : "⏸️"}
                  subtitle={processing ? "Processing..." : "Ready to process"}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Available Resorts
                  </h3>
                  {resorts.length > 0 ? (
                    <div className="space-y-2">
                      {resorts.map((resort) => (
                        <div key={resort} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="font-medium text-gray-900 dark:text-white">{resort}</span>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedResort(resort);
                                loadConfig(resort);
                                setActiveTab('configure');
                              }}
                            >
                              Configure
                            </Button>
                            {outputs[resort] && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedResort(resort);
                                  loadMapData(resort);
                                  setShowMap(true);
                                  setActiveTab('view');
                                }}
                              >
                                View
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-2">📁</div>
                      <p className="text-gray-500 dark:text-gray-400">
                        No resorts available. Upload boundaries to create a new resort.
                      </p>
                    </div>
                  )}
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Quick Actions
                  </h3>
                  <div className="space-y-3">
                    <Button
                      onClick={() => setActiveTab('upload')}
                      variant="success"
                      className="w-full justify-center"
                    >
                      📁 Upload New Resort Data
                    </Button>
                    <Button
                      onClick={() => setActiveTab('view')}
                      variant="primary"
                      className="w-full justify-center"
                      disabled={Object.keys(outputs).length === 0}
                    >
                      🗺️ Open Map Viewer
                    </Button>
                    <Button
                      onClick={() => setActiveTab('process')}
                      variant="secondary"
                      className="w-full justify-center"
                      disabled={!selectedResort || processing}
                    >
                      {processing ? '⏯️ Processing...' : '⚙️ Process Resort'}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Upload Resort Boundaries
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Start by uploading a GeoJSON file containing resort boundary data
                </p>
              </div>

              <Card className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Resort Name
                    </label>
                    <input
                      type="text"
                      value={resortName}
                      onChange={(e) => setResortName(e.target.value)}
                      placeholder="Enter resort name (e.g., Stratton Mountain)"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Boundary File (.geojson)
                    </label>
                    <input
                      ref={fileInput}
                      type="file"
                      accept=".geojson"
                      onChange={handleFileUpload}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                    />
                  </div>

                  {uploadError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-red-600 dark:text-red-400 text-sm">{uploadError}</p>
                    </div>
                  )}

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">File Requirements:</h4>
                    <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                      <li>• Must be a valid GeoJSON FeatureCollection</li>
                      <li>• Must contain features with ZoneType: "ski_area_boundary"</li>
                      <li>• Must contain features with ZoneType: "feature_boundary"</li>
                      <li>• File size limit: 50MB</li>
                    </ul>
                  </div>
                </div>
              </Card>

              {resorts.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Existing Resorts
                  </h3>
                  <div className="space-y-2">
                    {resorts.map((resort) => (
                      <div key={resort} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className="font-medium text-gray-900 dark:text-white">{resort}</span>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedResort(resort);
                            loadConfig(resort);
                            setActiveTab('configure');
                          }}
                        >
                          Configure
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'configure' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Configure Resort
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Select a resort and adjust tree generation parameters
                </p>
              </div>

              <Card className="p-6">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Resort
                    </label>
                    <select
                      value={selectedResort}
                      onChange={(e) => {
                        setSelectedResort(e.target.value);
                        if (e.target.value) {
                          loadConfig(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Choose a resort...</option>
                      {resorts.map(resort => (
                        <option key={resort} value={resort}>{resort}</option>
                      ))}
                    </select>
                  </div>

                  {selectedResort && config && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Tree Type</h4>
                        <select
                          value={config.default_tree_type}
                          onChange={(e) => setConfig({...config, default_tree_type: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="tree:mixed">Mixed Forest</option>
                          <option value="tree:needle">Needle/Coniferous</option>
                          <option value="tree:broad">Broad/Deciduous</option>
                        </select>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900 dark:text-white">Tree Density</h4>
                        
                        {Object.entries({
                          'Trees per Small Hectare': 'trees_per_small_hectare',
                          'Trees per Medium Hectare': 'trees_per_medium_hectare',
                          'Trees per Large Hectare': 'trees_per_large_hectare',
                          'Max Trees per Polygon': 'max_trees_per_polygon'
                        }).map(([label, key]) => (
                          <div key={key}>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {label}
                            </label>
                            <input
                              type="number"
                              value={config.tree_config[key]}
                              onChange={(e) => setConfig({
                                ...config,
                                tree_config: {
                                  ...config.tree_config,
                                  [key]: parseInt(e.target.value)
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedResort && config && (
                    <div className="flex space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <Button onClick={updateConfig}>
                        Save Configuration
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab('process')}
                      >
                        Proceed to Processing
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'process' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Process Resort
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Generate tree points and process the resort data
                </p>
              </div>

              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        Selected Resort: {selectedResort || 'None selected'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Click process to generate tree points and create output files
                      </p>
                    </div>
                    <Button
                      onClick={processResort}
                      disabled={processing || !selectedResort}
                      variant={processing ? "secondary" : "primary"}
                    >
                      {processing ? "Processing..." : "🔄 Process Resort"}
                    </Button>
                  </div>

                  {processOutput.length > 0 && (
                    <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
                      {processOutput.map((output, i) => (
                        <div key={i} className={`mb-1 ${
                          output.type === 'error' ? 'text-red-400' : 
                          output.type === 'success' ? 'text-green-400' : 
                          'text-gray-300'
                        }`}>
                          {output.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'view' && (
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
                    onChange={(e) => {
                      setSelectedResort(e.target.value);
                      if (e.target.value) {
                        loadMapData(e.target.value);
                        setShowMap(true);
                      }
                    }}
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
          )}
        </main>
      </div>
    </div>
  );
}

ReactDOM.render(
  <ThemeProvider>
    <App />
  </ThemeProvider>, 
  document.getElementById("root")
);