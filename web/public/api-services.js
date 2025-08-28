// API Services for GeoWeld Resort Processor
const API_URL = "";

// Resort Management
const loadResorts = async () => {
  try {
    const res = await fetch(`${API_URL}/api/resorts`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error loading resorts:", err);
    throw err;
  }
};

const loadConfig = async (resort) => {
  try {
    const res = await fetch(`${API_URL}/api/resort/${resort}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error loading config:", err);
    throw err;
  }
};

const updateConfig = async (selectedResort, config) => {
  try {
    const res = await fetch(`${API_URL}/api/resort/${selectedResort}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (res.ok) {
      return { success: true };
    }
    throw new Error('Failed to update config');
  } catch (err) {
    console.error("Error updating config:", err);
    throw err;
  }
};

// File Management
const handleFileUpload = async (file, resortName) => {
  if (!file || !resortName.trim()) {
    throw new Error("Please enter a resort name first");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("resortName", resortName.toLowerCase().replace(/\s+/g, "_"));

  try {
    const res = await fetch(`${API_URL}/api/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (data.success) {
      return data;
    } else {
      throw new Error(data.error || "Upload failed");
    }
  } catch (err) {
    throw new Error("Error uploading file: " + err.message);
  }
};

const loadOutputs = async () => {
  try {
    const res = await fetch(`${API_URL}/api/outputs`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error loading outputs:", err);
    throw err;
  }
};

const downloadFile = (resort, file) => {
  window.open(`${API_URL}/api/download/${resort}/${file}`, "_blank");
};

// Delete Functions
const deleteProcessedFiles = async (resort) => {
  try {
    const res = await fetch(`${API_URL}/api/resort/${resort}/processed`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.success) {
      return data;
    } else {
      throw new Error(data.error || "Delete failed");
    }
  } catch (err) {
    throw new Error("Error deleting processed files: " + err.message);
  }
};

const deleteOsmFiles = async (resort) => {
  try {
    const res = await fetch(`${API_URL}/api/resort/${resort}/osm`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.success) {
      return data;
    } else {
      throw new Error(data.error || "Delete failed");
    }
  } catch (err) {
    throw new Error("Error deleting OSM files: " + err.message);
  }
};

const deleteBoundaryFiles = async (resort) => {
  try {
    const res = await fetch(`${API_URL}/api/resort/${resort}/boundaries`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.success) {
      return data;
    } else {
      throw new Error(data.error || "Delete failed");
    }
  } catch (err) {
    throw new Error("Error deleting boundary files: " + err.message);
  }
};

const deleteEntireResort = async (resort) => {
  try {
    const res = await fetch(`${API_URL}/api/resort/${resort}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.success) {
      return data;
    } else {
      throw new Error(data.error || "Delete failed");
    }
  } catch (err) {
    throw new Error("Error deleting resort: " + err.message);
  }
};

// Processing
const createProcessStream = (selectedResort, onMessage, onComplete, onError) => {
  const eventSource = new EventSource(`${API_URL}/api/process/${selectedResort}`);
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
    
    if (data.type === 'done') {
      eventSource.close();
      onComplete(data);
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
    onError();
  };

  return eventSource;
};

// Map Data
const loadMapData = async (resort) => {
  try {
    const res = await fetch(`${API_URL}/api/output/${resort}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error loading map data:", err);
    throw err;
  }
};

const fetchMapboxToken = async () => {
  try {
    const res = await fetch(`${API_URL}/api/mapbox-token`);
    const data = await res.json();
    return data.token;
  } catch (err) {
    console.error("Error fetching Mapbox token:", err);
    throw err;
  }
};

const loadConstants = async () => {
  try {
    const res = await fetch(`${API_URL}/api/constants`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error loading constants:", err);
    throw err;
  }
};

// Feature Statistics Calculation
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
      
      if (feature.properties.source === 'osm') stats.trees.osm++;
      else stats.trees.generated++;

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

// Export all functions
window.ApiServices = {
  loadResorts,
  loadConfig,
  updateConfig,
  handleFileUpload,
  loadOutputs,
  downloadFile,
  deleteProcessedFiles,
  deleteOsmFiles,
  deleteBoundaryFiles,
  deleteEntireResort,
  createProcessStream,
  loadMapData,
  fetchMapboxToken,
  loadConstants,
  calculateFeatureStats
};