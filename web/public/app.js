// Main App Component - GeoWeld Resort Processor
// Uses modular components loaded from separate files
const { useState, useEffect, useRef } = React;

// Import components and services (loaded from separate script tags)
const { ThemeProvider, Header, Sidebar } = window.Components;
const { 
  loadResorts, 
  fetchMapboxToken, 
  loadOutputs, 
  loadConfig 
} = window.ApiServices;

function App() {
  // Core application state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [resorts, setResorts] = useState([]);
  const [outputs, setOutputs] = useState({});
  const [mapboxToken, setMapboxToken] = useState("");
  
  // Selected resort and configuration state
  const [selectedResort, setSelectedResort] = useState("");
  const [config, setConfig] = useState(null);

  // URL parameter parsing and state synchronization
  const parseUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      tab: urlParams.get('tab'),
      resort: urlParams.get('resort')
    };
  };

  const updateUrl = (tab, resort = null) => {
    const url = new URL(window.location);
    if (tab) url.searchParams.set('tab', tab);
    if (resort) url.searchParams.set('resort', resort);
    else url.searchParams.delete('resort');
    window.history.pushState({}, '', url.toString());
  };
  
  // Upload state
  const [resortName, setResortName] = useState("");
  const [uploadError, setUploadError] = useState("");
  
  // Map viewer state
  const [mapData, setMapData] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [featureStats, setFeatureStats] = useState(null);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  // Enhanced state setters that also update URL
  const setActiveTabWithUrl = (tab) => {
    setActiveTab(tab);
    updateUrl(tab, selectedResort || null);
  };

  const setSelectedResortWithUrl = (resort) => {
    setSelectedResort(resort);
    updateUrl(activeTab, resort || null);
  };

  // Update document title based on active tab
  useEffect(() => {
    const titles = {
      dashboard: 'Dashboard',
      upload: 'Upload Data',
      configure: 'Configure & Process',
      view: 'View Results',
    };
    const section = titles[activeTab];
    document.title = section ? `GeoWeld Resort Processor - ${section}` : 'GeoWeld Resort Processor';
  }, [activeTab]);

  // Load initial data and handle URL parameters
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const [resortsData, outputsData, token] = await Promise.all([
          loadResorts(),
          loadOutputs(), 
          fetchMapboxToken()
        ]);
        setResorts(resortsData);
        setOutputs(outputsData);
        setMapboxToken(token);
        
        // Parse URL parameters and set initial state
        const { tab, resort } = parseUrlParams();
        if (tab && ['dashboard', 'upload', 'configure', 'view'].includes(tab)) {
          setActiveTab(tab);
        }
        if (resort && resortsData.includes(resort)) {
          setSelectedResort(resort);
          // If we have a resort parameter and we're on the view tab, load map data
          if (tab === 'view' && outputsData[resort]) {
            try {
              const { loadMapData, calculateFeatureStats } = window.ApiServices;
              const data = await loadMapData(resort);
              setMapData(data);
              setFeatureStats(calculateFeatureStats(data));
              setShowMap(true);
            } catch (err) {
              console.error("Error loading map data from URL:", err);
            }
          }
        }
      } catch (err) {
        console.error("Error initializing app:", err);
      }
    };
    initializeApp();
  }, []);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const { tab, resort } = parseUrlParams();
      if (tab && ['dashboard', 'upload', 'configure', 'view'].includes(tab)) {
        setActiveTab(tab);
      }
      if (resort && resorts.includes(resort)) {
        setSelectedResort(resort);
      } else if (!resort) {
        setSelectedResort('');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [resorts]);

  // Helper function to reload data after changes
  const reloadData = async () => {
    try {
      const [resortsData, outputsData] = await Promise.all([
        loadResorts(),
        loadOutputs()
      ]);
      setResorts(resortsData);
      setOutputs(outputsData);
    } catch (err) {
      console.error("Error reloading data:", err);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar
        isOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        activeTab={activeTab}
        setActiveTab={setActiveTabWithUrl}
      />

      <div className="flex flex-col flex-1 lg:ml-64">
        <Header toggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />

        <main id="main-content" tabIndex="-1" className="flex-1 overflow-y-auto p-6">
          {activeTab === 'dashboard' && (
            <window.Dashboard 
              resorts={resorts}
              outputs={outputs}
              setActiveTab={setActiveTabWithUrl}
              setSelectedResort={setSelectedResortWithUrl}
              setConfig={setConfig}
              setMapData={setMapData}
              setFeatureStats={setFeatureStats}
              setShowMap={setShowMap}
              refreshData={reloadData}
            />
          )}

          {activeTab === 'upload' && (
            <window.DataManagement.UploadTab
              resortName={resortName}
              setResortName={setResortName}
              uploadError={uploadError}
              setUploadError={setUploadError}
              setSelectedResort={setSelectedResortWithUrl}
              loadResorts={reloadData}
              setConfig={setConfig}
              setActiveTab={setActiveTabWithUrl}
              resorts={resorts}
            />
          )}

          {activeTab === 'configure' && (
            <window.DataManagement.ConfigureTab
              resorts={resorts}
              selectedResort={selectedResort}
              setSelectedResort={setSelectedResortWithUrl}
              config={config}
              setConfig={setConfig}
              setActiveTab={setActiveTabWithUrl}
              loadOutputs={reloadData}
            />
          )}


          {activeTab === 'view' && (
            <window.MapViewer
              resorts={resorts}
              selectedResort={selectedResort}
              setSelectedResort={setSelectedResortWithUrl}
              outputs={outputs}
              mapboxToken={mapboxToken}
              mapData={mapData}
              setMapData={setMapData}
              showMap={showMap}
              setShowMap={setShowMap}
              featureStats={featureStats}
              setFeatureStats={setFeatureStats}
              selectedFeature={selectedFeature}
              setSelectedFeature={setSelectedFeature}
              refreshData={reloadData}
            />
          )}
        </main>
      </div>
    </div>
  );
}

ReactDOM.render(
  <window.Components.ThemeProvider>
    <window.NotificationSystem.NotificationProvider>
      <App />
    </window.NotificationSystem.NotificationProvider>
  </window.Components.ThemeProvider>, 
  document.getElementById("root")
);