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
  
  // Upload state
  const [resortName, setResortName] = useState("");
  const [uploadError, setUploadError] = useState("");
  
  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processOutput, setProcessOutput] = useState([]);
  
  // Map viewer state
  const [mapData, setMapData] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [featureStats, setFeatureStats] = useState(null);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

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

  // Load initial data
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
      } catch (err) {
        console.error("Error initializing app:", err);
      }
    };
    initializeApp();
  }, []);

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
        setActiveTab={setActiveTab}
      />

      <div className="flex flex-col flex-1 lg:ml-64">
        <Header toggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />

        <main id="main-content" tabIndex="-1" className="flex-1 overflow-y-auto p-6">
          {activeTab === 'dashboard' && (
            <window.Dashboard 
              resorts={resorts}
              outputs={outputs}
              processing={processing}
              setActiveTab={setActiveTab}
              setSelectedResort={setSelectedResort}
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
              setSelectedResort={setSelectedResort}
              loadResorts={reloadData}
              setConfig={setConfig}
              setActiveTab={setActiveTab}
              resorts={resorts}
            />
          )}

          {activeTab === 'configure' && (
            <window.DataManagement.ConfigureTab
              resorts={resorts}
              selectedResort={selectedResort}
              setSelectedResort={setSelectedResort}
              config={config}
              setConfig={setConfig}
              setActiveTab={setActiveTab}
              processing={processing}
              setProcessing={setProcessing}
              processOutput={processOutput}
              setProcessOutput={setProcessOutput}
              loadOutputs={reloadData}
            />
          )}


          {activeTab === 'view' && (
            <window.MapViewer
              resorts={resorts}
              selectedResort={selectedResort}
              setSelectedResort={setSelectedResort}
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
    <App />
  </window.Components.ThemeProvider>, 
  document.getElementById("root")
);