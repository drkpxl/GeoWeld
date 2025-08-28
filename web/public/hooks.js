// Shared React Hooks for GeoWeld Resort Processor
const { useState } = React;
const { createProcessStream } = window.ApiServices;

// Processing hook - extracted from duplicate logic
const useProcessing = (selectedResort, loadOutputs, setActiveTab) => {
  const [processing, setProcessing] = useState(false);
  const [processOutput, setProcessOutput] = useState([]);

  const processResort = async () => {
    if (!selectedResort) return;
    
    setProcessing(true);
    setProcessOutput([]);
    
    const onMessage = (data) => {
      setProcessOutput((prev) => [...prev, data]);
    };
    
    const onComplete = (data) => {
      setProcessing(false);
      if (data.code === 0) {
        loadOutputs();
        if (setActiveTab) {
          setActiveTab('view');
        }
      }
    };
    
    const onError = () => {
      setProcessing(false);
    };

    try {
      createProcessStream(selectedResort, onMessage, onComplete, onError);
    } catch (error) {
      setProcessing(false);
    }
  };

  return {
    processing,
    processOutput,
    processResort
  };
};

// Export hooks
window.Hooks = {
  useProcessing
};