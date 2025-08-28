// Data Management Components (Upload & Configure) for GeoWeld Resort Processor
const { useState, useRef } = React;
const { Button, Card } = window.Components;
const { handleFileUpload, loadConfig, updateConfig, loadConstants } = window.ApiServices;
const { useProcessing } = window.Hooks;

// Upload Tab Component
const UploadTab = ({ refreshData }) => {
  const { state, actions } = window.AppState.useAppState();
  const fileInput = useRef(null);

  const handleFileUploadWrapper = async (e) => {
    const file = e.target.files[0];
    try {
      actions.setUploadError("");
      const data = await handleFileUpload(file, state.resortName);
      actions.setSelectedResortWithUrl(data.resort);
      await refreshData();
      const configData = await loadConfig(data.resort);
      actions.setConfig(configData);
      actions.setActiveTabWithUrl('configure');
    } catch (err) {
      actions.setUploadError(err.message);
    }
  };

  const handleConfigureResort = async (resort) => {
    try {
      actions.setSelectedResortWithUrl(resort);
      const configData = await loadConfig(resort);
      actions.setConfig(configData);
      actions.setActiveTabWithUrl('configure');
    } catch (err) {
      console.error("Error configuring resort:", err);
    }
  };

  return (
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
            <label htmlFor="resort-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Resort Name
            </label>
            <input
              id="resort-name"
              type="text"
              value={state.resortName}
              onChange={(e) => actions.setResortName(e.target.value)}
              placeholder="Enter resort name (e.g., Stratton Mountain)"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="boundary-file" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Boundary File (.geojson)
            </label>
            <input
              id="boundary-file"
              ref={fileInput}
              type="file"
              accept=".geojson"
              onChange={handleFileUploadWrapper}
              required
              aria-describedby="file-requirements"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
          </div>

          {state.uploadError && (
            <div role="alert" aria-live="polite" className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{state.uploadError}</p>
            </div>
          )}

          <div id="file-requirements" className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
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

      {state.resorts.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Existing Resorts
          </h3>
          <div className="space-y-2">
            {state.resorts.map((resort) => (
              <div key={resort} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="font-medium text-gray-900 dark:text-white">{resort}</span>
                <Button
                  size="sm"
                  onClick={() => handleConfigureResort(resort)}
                >
                  Configure
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// Configure Tab Component
const ConfigureTab = ({ loadOutputs }) => {
  const { state, actions } = window.AppState.useAppState();
  const [configSaved, setConfigSaved] = useState(false);
  const [constants, setConstants] = useState(null);
  
  // Use shared processing hook
  const { processing, processOutput, processResort } = useProcessing(
    state.selectedResort,
    loadOutputs,
    (tab) => actions.setActiveTabWithUrl(tab)
  );

  // Load constants on component mount
  React.useEffect(() => {
    const loadConstantsData = async () => {
      try {
        const constantsData = await loadConstants();
        setConstants(constantsData);
      } catch (err) {
        console.error('Error loading constants:', err);
      }
    };
    loadConstantsData();
  }, []);

  // Load config when selectedResort changes (handles URL parameter initialization)
  React.useEffect(() => {
    const loadResortConfig = async () => {
      if (state.selectedResort && (!state.config || state.config.name !== state.selectedResort)) {
        try {
          setConfigSaved(false); // Reset saved status when loading new config
          const configData = await loadConfig(state.selectedResort);
          actions.setConfig(configData);
        } catch (err) {
          console.error("Error loading config for resort:", state.selectedResort, err);
        }
      } else if (!state.selectedResort) {
        // Clear config when no resort is selected
        actions.setConfig(null);
        setConfigSaved(false);
      }
    };
    loadResortConfig();
  }, [state.selectedResort]);

  const handleUpdateConfig = async () => {
    try {
      await updateConfig(state.selectedResort, state.config);
      setConfigSaved(true);
      // Don't show alert, just enable the process button
    } catch (err) {
      alert("Error updating config: " + err.message);
    }
  };

  const handleResortChange = (e) => {
    const resort = e.target.value;
    actions.setSelectedResortWithUrl(resort);
    // Config loading is now handled by useEffect when selectedResort changes
  };


  // Reset config saved status when config changes
  const handleConfigChange = (newConfig) => {
    actions.setConfig(newConfig);
    setConfigSaved(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Configure & Process Resort
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure tree generation parameters and process the resort data
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          <div>
            <label htmlFor="config-resort" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Resort
            </label>
            <select
              id="config-resort"
              value={state.selectedResort}
              onChange={handleResortChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Choose a resort...</option>
              {state.resorts.map(resort => (
                <option key={resort} value={resort}>{resort}</option>
              ))}
            </select>
          </div>

          {state.selectedResort && state.config && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="tree-type" className="block font-medium text-gray-900 dark:text-white mb-3">Tree Type</label>
                <select
                  id="tree-type"
                  value={state.config.default_tree_type}
                  onChange={(e) => handleConfigChange({...state.config, default_tree_type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="tree:mixed">Mixed Forest</option>
                  <option value="tree:needle">Needle/Coniferous</option>
                  <option value="tree:broad">Broad/Deciduous</option>
                </select>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 dark:text-white">Tree Density</h4>
                
                {constants && Object.entries({
                  [`Trees per Small Hectare (< ${(constants.area_thresholds.medium_area_threshold / 10000).toFixed(1)} ha)`]: 'trees_per_small_hectare',
                  [`Trees per Medium Hectare (${(constants.area_thresholds.medium_area_threshold / 10000).toFixed(1)}-${(constants.area_thresholds.large_area_threshold / 10000).toFixed(1)} ha)`]: 'trees_per_medium_hectare',
                  [`Trees per Large Hectare (${(constants.area_thresholds.large_area_threshold / 10000).toFixed(1)}-${(constants.area_thresholds.extra_large_area_threshold / 10000).toFixed(1)} ha)`]: 'trees_per_large_hectare',
                  [`Trees per Extra Large Hectare (> ${(constants.area_thresholds.extra_large_area_threshold / 10000).toFixed(1)} ha)`]: 'trees_per_extra_large_hectare',
                  'Max Trees per Polygon': 'max_trees_per_polygon'
                }).map(([label, key]) => (
                  <div key={key}>
                    <label htmlFor={`density-${key}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {label}
                    </label>
                    <input
                      id={`density-${key}`}
                      type="number"
                      value={state.config.tree_config[key]}
                      onChange={(e) => handleConfigChange({
                        ...state.config,
                        tree_config: {
                          ...state.config.tree_config,
                          [key]: parseInt(e.target.value)
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                ))}
                
                {!constants && (
                  <div className="text-gray-500 dark:text-gray-400">Loading configuration options...</div>
                )}
              </div>
            </div>
          )}

          {state.selectedResort && state.config && (
            <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex space-x-4">
                  <Button onClick={handleUpdateConfig} disabled={configSaved}>
                    {configSaved ? '✓ Configuration Saved' : 'Save Configuration'}
                  </Button>
                  <Button
                    onClick={processResort}
                    disabled={processing || !configSaved}
                    variant={processing ? "secondary" : "primary"}
                    aria-busy={processing}
                  >
                    {processing ? "Processing..." : "🔄 Process Resort"}
                  </Button>
                </div>
                {!configSaved && (
                  <span className="text-sm text-orange-600 dark:text-orange-400">
                    Save configuration to enable processing
                  </span>
                )}
              </div>

              {processOutput.length > 0 && (
                <div
                  className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto"
                  role="log"
                  aria-live="polite"
                >
                  {processOutput.map((output, i) => (
                    <div
                      key={i}
                      className={`mb-1 ${
                        output.type === 'error' ? 'text-red-400' :
                        output.type === 'success' ? 'text-green-400' :
                        'text-gray-300'
                      }`}
                    >
                      {output.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

// Export components
window.DataManagement = {
  UploadTab,
  ConfigureTab
};