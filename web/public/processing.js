// Processing Tab Component for GeoWeld Resort Processor
const { useState } = React;
const { Button, Card } = window.Components;
const { createProcessStream } = window.ApiServices;

const ProcessingTab = ({ 
  selectedResort, 
  processing, 
  setProcessing, 
  processOutput, 
  setProcessOutput,
  loadOutputs,
  setActiveTab 
}) => {
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
        setActiveTab('view');
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

  return (
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
  );
};

// Export component
window.ProcessingTab = ProcessingTab;