// Dashboard Tab Component for GeoWeld Resort Processor
const { Button, Card, InfoCard } = window.Components;
const { loadConfig, loadMapData, deleteEntireResort } = window.ApiServices;

const Dashboard = ({ 
  resorts, 
  outputs, 
  processing, 
  setActiveTab, 
  setSelectedResort, 
  setConfig,
  setMapData,
  setFeatureStats,
  setShowMap,
  refreshData
}) => {
  const handleConfigureResort = async (resort) => {
    try {
      setSelectedResort(resort);
      const configData = await loadConfig(resort);
      setConfig(configData);
      setActiveTab('configure');
    } catch (err) {
      console.error("Error configuring resort:", err);
    }
  };

  const handleViewResort = async (resort) => {
    try {
      setSelectedResort(resort);
      const mapData = await loadMapData(resort);
      setMapData(mapData);
      setFeatureStats(window.ApiServices.calculateFeatureStats(mapData));
      setShowMap(true);
      setActiveTab('view');
    } catch (err) {
      console.error("Error loading map data:", err);
    }
  };

  const handleDelete = async (resort, type, confirmMessage) => {
    if (!confirm(`${confirmMessage}\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      if (type === 'entire') {
        await deleteEntireResort(resort);
      }
      
      // Refresh data after successful delete
      if (refreshData) {
        refreshData();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
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

      <div className="w-full">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Available Resorts
          </h3>
          {resorts.length > 0 ? (
            <div className="space-y-3">
              {resorts.map((resort) => (
                <div key={resort} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900 dark:text-white text-lg">{resort}</span>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConfigureResort(resort)}
                      >
                        ⚙️ Configure
                      </Button>
                      {outputs[resort] && (
                        <Button
                          size="sm"
                          onClick={() => handleViewResort(resort)}
                        >
                          🗺️ View Map
                        </Button>
                      )}
                      {outputs[resort] && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handleViewResort(resort)}
                        >
                          📄 Download
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(resort, 'entire', `Delete entire resort "${resort}" including all files and configuration?`)}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                      >
                        🗑️ Delete Resort
                      </Button>
                    </div>
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

      </div>
    </div>
  );
};

// Export component
window.Dashboard = Dashboard;