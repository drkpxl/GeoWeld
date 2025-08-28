// Main App Component - GeoWeld Resort Processor
// Uses centralized state management and modular components
const { useEffect } = React;

// Import components and services (loaded from separate script tags)
const { Header, Sidebar } = window.Components;
const { 
  loadResorts, 
  fetchMapboxToken, 
  loadOutputs, 
  loadConfig 
} = window.ApiServices;
const { useAppState, parseUrlParams, createSelectors } = window.AppState;

function App() {
  const { state, actions } = useAppState();
  
  // Create selectors for derived state
  const selectors = createSelectors(state);

  // Update document title based on active tab
  useEffect(() => {
    const titles = {
      dashboard: 'Dashboard',
      upload: 'Upload Data',
      configure: 'Configure & Process',
      view: 'View Results',
    };
    const section = titles[state.activeTab];
    document.title = section ? `GeoWeld Resort Processor - ${section}` : 'GeoWeld Resort Processor';
  }, [state.activeTab]);

  // Load initial data and handle URL parameters
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const [resortsData, outputsData, token] = await Promise.all([
          loadResorts(),
          loadOutputs(), 
          fetchMapboxToken()
        ]);
        
        // Initialize app data in one action
        actions.initializeAppData({ resorts: resortsData, outputs: outputsData, mapboxToken: token });
        
        // Parse URL parameters and set initial state
        const { tab, resort } = parseUrlParams();
        if (tab && ['dashboard', 'upload', 'configure', 'view'].includes(tab)) {
          actions.setActiveTab(tab);
        }
        if (resort && resortsData.includes(resort)) {
          actions.setSelectedResort(resort);
          // If we have a resort parameter and we're on the view tab, load map data
          if (tab === 'view' && outputsData[resort]) {
            try {
              const { loadMapData, calculateFeatureStats } = window.ApiServices;
              actions.setLoadingMap(true);
              const data = await loadMapData(resort);
              actions.setMapData(data);
              actions.setFeatureStats(calculateFeatureStats(data));
              actions.setShowMap(true);
            } catch (err) {
              console.error("Error loading map data from URL:", err);
            } finally {
              actions.setLoadingMap(false);
            }
          }
        } else if (resort && !resortsData.includes(resort)) {
          // If resort in URL doesn't exist, clear it from URL
          const url = new URL(window.location);
          url.searchParams.delete('resort');
          window.history.replaceState({}, '', url.toString());
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
        actions.setActiveTab(tab);
      }
      if (resort && state.resorts.includes(resort)) {
        actions.setSelectedResort(resort);
      } else if (!resort) {
        actions.setSelectedResort('');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [state.resorts]);

  // Helper function to reload data after changes
  const reloadData = async () => {
    try {
      const [resortsData, outputsData] = await Promise.all([
        loadResorts(),
        loadOutputs()
      ]);
      actions.setResorts(resortsData);
      actions.setOutputs(outputsData);
    } catch (err) {
      console.error("Error reloading data:", err);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar
        isOpen={state.sidebarOpen}
        toggleSidebar={actions.toggleSidebar}
        activeTab={state.activeTab}
        setActiveTab={actions.setActiveTabWithUrl}
      />

      <div className="flex flex-col flex-1 lg:ml-64">
        <Header toggleSidebar={actions.toggleSidebar} sidebarOpen={state.sidebarOpen} />

        <main id="main-content" tabIndex="-1" className="flex-1 overflow-y-auto p-6">
          {state.activeTab === 'dashboard' && (
            <window.Dashboard 
              refreshData={reloadData}
            />
          )}

          {state.activeTab === 'upload' && (
            <window.DataManagement.UploadTab
              refreshData={reloadData}
            />
          )}

          {state.activeTab === 'configure' && (
            <window.DataManagement.ConfigureTab
              loadOutputs={reloadData}
            />
          )}

          {state.activeTab === 'view' && (
            <window.MapViewer
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
      <window.AppState.AppStateProvider>
        <App />
      </window.AppState.AppStateProvider>
    </window.NotificationSystem.NotificationProvider>
  </window.Components.ThemeProvider>, 
  document.getElementById("root")
);