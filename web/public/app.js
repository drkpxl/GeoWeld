const { useState, useEffect, useRef } = React;

const API_URL = "";

function App() {
  const [step, setStep] = useState(1);
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
        body: JSON.stringify({ tree_config: config.tree_config }),
      });
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
          setTimeout(() => setStep(5), 1000);
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

  const loadProcessedData = async () => {
    if (!selectedResort) return;

    try {
      const res = await fetch(`${API_URL}/api/output/${selectedResort}`);
      if (res.ok) {
        const data = await res.json();
        setMapData(data);
      }
    } catch (err) {
      console.error("Error loading processed data:", err);
    }
  };

  useEffect(() => {
    if (showMap && mapData && mapboxToken && !map.current) {
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

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/alterramtnco/cmej0nr37002j01sigk347cuh",
        center: [center.lng, center.lat],
        zoom: 14,
      });

      map.current.on("load", () => {
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

        // Individual trees (points)
        map.current.addLayer({
          id: "trees",
          type: "circle",
          source: "resort-data",
          filter: [
            "all",
            ["==", ["get", "type"], "tree:mixed"],
            ["==", ["geometry-type"], "Point"]
          ],
          paint: {
            "circle-radius": 3,
            "circle-color": "#1B5E20",
            "circle-opacity": 0.7,
          },
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            GeoWeld Resort Processor
          </h1>
          <p className="text-gray-600">
            Upload, configure, and process ski resort boundary data
          </p>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step >= s
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {s}
                </div>
                {s < 6 && (
                  <div
                    className={`w-full h-1 mx-2 ${
                      step > s ? "bg-blue-500" : "bg-gray-200"
                    }`}
                    style={{ width: "60px" }}
                  ></div>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-2 text-xs text-center">
            <div>Upload</div>
            <div>Name</div>
            <div>Configure</div>
            <div>Process</div>
            <div>Preview</div>
            <div>Download</div>
          </div>
        </div>

        {/* Step 1 & 2: Upload and Name */}
        {step <= 2 && (
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

        {/* Step 3: Configure */}
        {step === 3 && config && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              Step 3: Configure Tree Generation
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Processing: {selectedResort}
            </p>

            <div className="space-y-4">
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

            <div className="mt-6 flex gap-3">
              <button
                onClick={async () => {
                  await updateConfig();
                  processResort();
                }}
                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 font-medium"
              >
                Save & Process Resort
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Processing */}
        {step === 4 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              Step 4: Processing Resort
            </h2>

            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
              {processOutput.map((line, i) => (
                <div
                  key={i}
                  className={line.type === "stderr" ? "text-yellow-400" : ""}
                >
                  {line.message}
                </div>
              ))}
              {processing && (
                <div className="animate-pulse-slow">Processing...</div>
              )}
            </div>

            {!processing && (
              <button
                onClick={() => setStep(5)}
                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
              >
                Continue to Preview
              </button>
            )}
          </div>
        )}

        {/* Step 5: Preview */}
        {step === 5 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              Step 5: Preview Processed Data
            </h2>

            {!showMap && (
              <button
                onClick={() => setShowMap(true)}
                className="w-full bg-blue-500 text-white px-4 py-3 rounded-md hover:bg-blue-600 font-medium"
              >
                Load Map Preview
              </button>
            )}

            {showMap && (
              <div>
                <div
                  ref={mapContainer}
                  className="w-full h-96 rounded-lg mb-4"
                ></div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-blue-200 border border-blue-500 mr-2"></div>
                    <span>Ski Area Boundary</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-yellow-300 border border-yellow-600 mr-2"></div>
                    <span>Slow Zones</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-red-300 border border-red-600 mr-2"></div>
                    <span>Closed Areas</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-green-300 border border-green-600 mr-2"></div>
                    <span>Beginner Areas</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-green-600 mr-2"></div>
                    <span>Forests</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-gray-500 mr-2"></div>
                    <span>Rocks</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setStep(6)}
              className="mt-4 w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
            >
              Continue to Download
            </button>
          </div>
        )}

        {/* Step 6: Download */}
        {step === 6 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              Step 6: Download Processed Files
            </h2>

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

            <button
              onClick={() => {
                setStep(1);
                setResortName("");
                setSelectedResort("");
                setConfig(null);
                setProcessOutput([]);
                setShowMap(false);
                setMapData(null);
              }}
              className="mt-4 w-full bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
            >
              Process Another Resort
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));
