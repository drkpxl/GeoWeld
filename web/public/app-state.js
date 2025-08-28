// Centralized State Management for GeoWeld Resort Processor
const { createContext, useContext, useReducer } = React;

// Action Types
const ActionTypes = {
  // Resort Management
  SET_RESORTS: 'SET_RESORTS',
  SET_SELECTED_RESORT: 'SET_SELECTED_RESORT',
  SET_CONFIG: 'SET_CONFIG',
  
  // UI State
  SET_ACTIVE_TAB: 'SET_ACTIVE_TAB',
  SET_SIDEBAR_OPEN: 'SET_SIDEBAR_OPEN',
  
  // Upload State
  SET_RESORT_NAME: 'SET_RESORT_NAME',
  SET_UPLOAD_ERROR: 'SET_UPLOAD_ERROR',
  
  // Map State
  SET_MAP_DATA: 'SET_MAP_DATA',
  SET_SHOW_MAP: 'SET_SHOW_MAP',
  SET_FEATURE_STATS: 'SET_FEATURE_STATS',
  SET_SELECTED_FEATURE: 'SET_SELECTED_FEATURE',
  
  // Output State
  SET_OUTPUTS: 'SET_OUTPUTS',
  SET_MAPBOX_TOKEN: 'SET_MAPBOX_TOKEN',
  
  // Loading States
  SET_LOADING_MAP: 'SET_LOADING_MAP',
  SET_DELETING_RESORT: 'SET_DELETING_RESORT',
  
  // Bulk Updates
  RESET_MAP_STATE: 'RESET_MAP_STATE',
  INITIALIZE_APP_DATA: 'INITIALIZE_APP_DATA'
};

// Initial State
const initialState = {
  // Core Data
  resorts: [],
  selectedResort: "",
  config: null,
  outputs: {},
  mapboxToken: "",
  
  // UI State
  activeTab: 'dashboard',
  sidebarOpen: false,
  
  // Upload State
  resortName: "",
  uploadError: "",
  
  // Map State
  mapData: null,
  showMap: false,
  selectedFeature: null,
  featureStats: null,
  
  // Loading States
  loadingMap: false,
  deletingResort: false
};

// Reducer Function
const appReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_RESORTS:
      return { ...state, resorts: action.payload };
    
    case ActionTypes.SET_SELECTED_RESORT:
      return { ...state, selectedResort: action.payload };
    
    case ActionTypes.SET_CONFIG:
      return { ...state, config: action.payload };
    
    case ActionTypes.SET_ACTIVE_TAB:
      return { ...state, activeTab: action.payload };
    
    case ActionTypes.SET_SIDEBAR_OPEN:
      return { ...state, sidebarOpen: action.payload };
    
    case ActionTypes.SET_RESORT_NAME:
      return { ...state, resortName: action.payload };
    
    case ActionTypes.SET_UPLOAD_ERROR:
      return { ...state, uploadError: action.payload };
    
    case ActionTypes.SET_MAP_DATA:
      return { ...state, mapData: action.payload };
    
    case ActionTypes.SET_SHOW_MAP:
      return { ...state, showMap: action.payload };
    
    case ActionTypes.SET_FEATURE_STATS:
      return { ...state, featureStats: action.payload };
    
    case ActionTypes.SET_SELECTED_FEATURE:
      return { ...state, selectedFeature: action.payload };
    
    case ActionTypes.SET_OUTPUTS:
      return { ...state, outputs: action.payload };
    
    case ActionTypes.SET_MAPBOX_TOKEN:
      return { ...state, mapboxToken: action.payload };
    
    case ActionTypes.SET_LOADING_MAP:
      return { ...state, loadingMap: action.payload };
    
    case ActionTypes.SET_DELETING_RESORT:
      return { ...state, deletingResort: action.payload };
    
    case ActionTypes.RESET_MAP_STATE:
      return {
        ...state,
        mapData: null,
        featureStats: null,
        showMap: false,
        selectedFeature: null
      };
    
    case ActionTypes.INITIALIZE_APP_DATA:
      const { resorts, outputs, mapboxToken } = action.payload;
      return {
        ...state,
        resorts,
        outputs,
        mapboxToken
      };
    
    default:
      return state;
  }
};

// Action Creators
const createActions = (dispatch) => ({
  // Resort Management
  setResorts: (resorts) => dispatch({ type: ActionTypes.SET_RESORTS, payload: resorts }),
  setSelectedResort: (resort) => dispatch({ type: ActionTypes.SET_SELECTED_RESORT, payload: resort }),
  setConfig: (config) => dispatch({ type: ActionTypes.SET_CONFIG, payload: config }),
  
  // UI State
  setActiveTab: (tab) => dispatch({ type: ActionTypes.SET_ACTIVE_TAB, payload: tab }),
  setSidebarOpen: (open) => dispatch({ type: ActionTypes.SET_SIDEBAR_OPEN, payload: open }),
  toggleSidebar: () => dispatch({ type: ActionTypes.SET_SIDEBAR_OPEN, payload: undefined }), // Special case for toggle
  
  // Upload State
  setResortName: (name) => dispatch({ type: ActionTypes.SET_RESORT_NAME, payload: name }),
  setUploadError: (error) => dispatch({ type: ActionTypes.SET_UPLOAD_ERROR, payload: error }),
  
  // Map State
  setMapData: (data) => dispatch({ type: ActionTypes.SET_MAP_DATA, payload: data }),
  setShowMap: (show) => dispatch({ type: ActionTypes.SET_SHOW_MAP, payload: show }),
  setFeatureStats: (stats) => dispatch({ type: ActionTypes.SET_FEATURE_STATS, payload: stats }),
  setSelectedFeature: (feature) => dispatch({ type: ActionTypes.SET_SELECTED_FEATURE, payload: feature }),
  
  // Output State
  setOutputs: (outputs) => dispatch({ type: ActionTypes.SET_OUTPUTS, payload: outputs }),
  setMapboxToken: (token) => dispatch({ type: ActionTypes.SET_MAPBOX_TOKEN, payload: token }),
  
  // Loading States
  setLoadingMap: (loading) => dispatch({ type: ActionTypes.SET_LOADING_MAP, payload: loading }),
  setDeletingResort: (deleting) => dispatch({ type: ActionTypes.SET_DELETING_RESORT, payload: deleting }),
  
  // Bulk Actions
  resetMapState: () => dispatch({ type: ActionTypes.RESET_MAP_STATE }),
  initializeAppData: (data) => dispatch({ type: ActionTypes.INITIALIZE_APP_DATA, payload: data })
});

// Handle special toggle case in reducer
const enhancedReducer = (state, action) => {
  if (action.type === ActionTypes.SET_SIDEBAR_OPEN && action.payload === undefined) {
    return { ...state, sidebarOpen: !state.sidebarOpen };
  }
  return appReducer(state, action);
};

// Context
const AppStateContext = createContext();

// Provider Component
const AppStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(enhancedReducer, initialState);
  const actions = createActions(dispatch);

  // Enhanced actions with URL synchronization
  const enhancedActions = {
    ...actions,
    
    // URL-synced tab changes
    setActiveTabWithUrl: (tab) => {
      actions.setActiveTab(tab);
      updateUrl(tab, state.selectedResort || null);
    },
    
    // URL-synced resort changes
    setSelectedResortWithUrl: (resort) => {
      actions.setSelectedResort(resort);
      updateUrl(state.activeTab, resort || null);
    },
    
    // Combined resort selection and map loading
    selectResortAndLoadMap: async (resort) => {
      actions.setSelectedResort(resort);
      if (resort) {
        actions.setLoadingMap(true);
        try {
          const { loadMapData, calculateFeatureStats } = window.ApiServices;
          const data = await loadMapData(resort);
          actions.setMapData(data);
          actions.setFeatureStats(calculateFeatureStats(data));
          actions.setShowMap(true);
          updateUrl(state.activeTab, resort);
        } catch (err) {
          console.error("Error loading map data:", err);
          // Note: We can't use the hook here, notifications should be handled in components
        } finally {
          actions.setLoadingMap(false);
        }
      }
    },
    
    // Combined resort deletion with cleanup  
    deleteResortAndCleanup: async (resort) => {
      if (!resort || state.deletingResort) return false;
      
      if (!confirm(`Delete entire resort "${resort}" including all files and configuration?\n\nThis action cannot be undone.`)) {
        return false;
      }

      actions.setDeletingResort(true);
      try {
        const { deleteEntireResort } = window.ApiServices;
        await deleteEntireResort(resort);
        
        // Clean up state if this was the selected resort
        if (state.selectedResort === resort) {
          actions.resetMapState();
          actions.setSelectedResort('');
        }
        
        return true;
      } catch (err) {
        console.error("Delete error:", err);
        return false;
      } finally {
        actions.setDeletingResort(false);
      }
    }
  };

  const value = {
    state,
    actions: enhancedActions
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};

// Custom Hook
const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};

// URL Management Helper (moved from app.js)
const updateUrl = (tab, resort = null) => {
  const url = new URL(window.location);
  if (tab) url.searchParams.set('tab', tab);
  if (resort) url.searchParams.set('resort', resort);
  else url.searchParams.delete('resort');
  window.history.pushState({}, '', url.toString());
};

// URL Parameter Parsing Helper
const parseUrlParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    tab: urlParams.get('tab'),
    resort: urlParams.get('resort')
  };
};

// Selectors (derived state)
const createSelectors = (state) => ({
  // UI Selectors
  isResortSelected: !!state.selectedResort,
  hasOutputs: Object.keys(state.outputs).length > 0,
  hasMapData: !!state.mapData,
  
  // Data Selectors
  selectedResortOutputs: state.selectedResort ? state.outputs[state.selectedResort] : null,
  resortCount: state.resorts.length,
  processedCount: Object.keys(state.outputs).length,
  
  // Loading States
  isAnyLoading: state.loadingMap || state.deletingResort
});

// Export everything
window.AppState = {
  AppStateProvider,
  useAppState,
  ActionTypes,
  parseUrlParams,
  createSelectors
};