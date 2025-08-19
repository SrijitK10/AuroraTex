import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAutoCompileEnabled: boolean;
  onToggleAutoCompile: (enabled: boolean) => void;
  autoCompileDelay: number;
  onAutoCompileDelayChange: (delay: number) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isAutoCompileEnabled,
  onToggleAutoCompile,
  autoCompileDelay,
  onAutoCompileDelayChange,
}) => {
  const [localAutoCompileEnabled, setLocalAutoCompileEnabled] = useState(isAutoCompileEnabled);
  const [localAutoCompileDelay, setLocalAutoCompileDelay] = useState(autoCompileDelay);

  useEffect(() => {
    setLocalAutoCompileEnabled(isAutoCompileEnabled);
    setLocalAutoCompileDelay(autoCompileDelay);
  }, [isAutoCompileEnabled, autoCompileDelay]);

  const handleSave = () => {
    onToggleAutoCompile(localAutoCompileEnabled);
    onAutoCompileDelayChange(localAutoCompileDelay);
    onClose();
  };

  const handleCancel = () => {
    setLocalAutoCompileEnabled(isAutoCompileEnabled);
    setLocalAutoCompileDelay(autoCompileDelay);
    onClose();
  };

  const handleDelayChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 100 && numValue <= 10000) {
      setLocalAutoCompileDelay(numValue);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Compilation Settings Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Compilation</h3>
            
            {/* Auto-compile Toggle */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="autoCompile" className="text-sm font-medium text-gray-700">
                    Auto-compile
                  </label>
                  <p className="text-sm text-gray-500">
                    Automatically compile when .tex files are saved
                  </p>
                </div>
                <button
                  id="autoCompile"
                  onClick={() => setLocalAutoCompileEnabled(!localAutoCompileEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    localAutoCompileEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      localAutoCompileEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Auto-compile Delay */}
              {localAutoCompileEnabled && (
                <div className="ml-4 space-y-2">
                  <label htmlFor="autoCompileDelay" className="text-sm font-medium text-gray-700">
                    Auto-compile delay
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      id="autoCompileDelay"
                      type="range"
                      min="100"
                      max="5000"
                      step="50"
                      value={localAutoCompileDelay}
                      onChange={(e) => handleDelayChange(e.target.value)}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="100"
                        max="10000"
                        value={localAutoCompileDelay}
                        onChange={(e) => handleDelayChange(e.target.value)}
                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-sm text-gray-500">ms</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Delay before triggering compilation after saving (100-10000ms)
                  </p>
                </div>
              )}

              {/* Compilation Mode Indicator */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${localAutoCompileEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-sm font-medium text-gray-700">
                    {localAutoCompileEnabled ? 'Automatic compilation enabled' : 'Manual compilation only'}
                  </span>
                </div>
                {localAutoCompileEnabled && (
                  <p className="text-xs text-gray-500 mt-1">
                    Files will be compiled automatically {localAutoCompileDelay}ms after saving
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
