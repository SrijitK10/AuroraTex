import React, { useState, useEffect } from 'react';

interface TeXBinary {
  path: string | null;
  version: string | null;
  isValid: boolean;
  source: 'bundled' | 'system' | 'custom';
}

interface TeXDistribution {
  name: string;
  latexmk: TeXBinary;
  pdflatex: TeXBinary;
  xelatex: TeXBinary;
  lualatex: TeXBinary;
  biber: TeXBinary;
  bibtex: TeXBinary;
  isBundled: boolean;
  isValid: boolean;
  isActive: boolean;
}

interface TeXSettings {
  distributions: TeXDistribution[];
  activeDistribution: string;
  engineDefault: 'pdflatex' | 'xelatex' | 'lualatex';
  timeoutMs: number;
  maxLogSizeKB: number;
  shellEscapeEnabled: boolean;
}

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
  const [texSettings, setTexSettings] = useState<TeXSettings | null>(null);
  const [isLoadingTeX, setIsLoadingTeX] = useState(false);
  const [isRedetecting, setIsRedetecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'compilation' | 'tex'>('compilation');
  const [customDistributionName, setCustomDistributionName] = useState('');
  const [customPaths, setCustomPaths] = useState<Record<string, string>>({});
  const [showAddCustom, setShowAddCustom] = useState(false);

  useEffect(() => {
    setLocalAutoCompileEnabled(isAutoCompileEnabled);
    setLocalAutoCompileDelay(autoCompileDelay);
  }, [isAutoCompileEnabled, autoCompileDelay]);

  useEffect(() => {
    if (isOpen) {
      loadTexSettings();
    }
  }, [isOpen]);

  const loadTexSettings = async () => {
    setIsLoadingTeX(true);
    try {
      const settings = await window.electronAPI.settingsGetTexSettings();
      setTexSettings(settings);
    } catch (error) {
      console.error('Failed to load TeX settings:', error);
    } finally {
      setIsLoadingTeX(false);
    }
  };

  const handleRedetectTeX = async () => {
    setIsRedetecting(true);
    try {
      const newSettings = await window.electronAPI.settingsRedetectTeX();
      setTexSettings(newSettings);
    } catch (error) {
      console.error('Failed to re-detect TeX:', error);
    } finally {
      setIsRedetecting(false);
    }
  };

  const handleSetActiveDistribution = async (distributionName: string) => {
    if (!texSettings) return;
    
    try {
      await window.electronAPI.settingsSetActiveDistribution({ distributionName });
      // Update local state
      const updatedSettings = { ...texSettings };
      updatedSettings.distributions.forEach(d => d.isActive = d.name === distributionName);
      updatedSettings.activeDistribution = distributionName;
      setTexSettings(updatedSettings);
    } catch (error) {
      console.error('Failed to set active distribution:', error);
    }
  };

  const handleTexSettingChange = (key: keyof TeXSettings, value: any) => {
    if (!texSettings) return;
    
    const updatedSettings = { ...texSettings, [key]: value };
    setTexSettings(updatedSettings);
  };

  const handleAddCustomDistribution = async () => {
    if (!customDistributionName || !texSettings) return;
    
    try {
      await window.electronAPI.settingsAddCustomDistribution({
        name: customDistributionName,
        paths: customPaths
      });
      
      // Reload settings to get the updated list
      await loadTexSettings();
      
      // Reset form
      setCustomDistributionName('');
      setCustomPaths({});
      setShowAddCustom(false);
    } catch (error) {
      console.error('Failed to add custom distribution:', error);
    }
  };

  const handleSave = async () => {
    onToggleAutoCompile(localAutoCompileEnabled);
    onAutoCompileDelayChange(localAutoCompileDelay);
    
    // Save TeX settings if they were modified
    if (texSettings) {
      try {
        await window.electronAPI.settingsUpdateTexSettings({ settings: texSettings });
      } catch (error) {
        console.error('Failed to save TeX settings:', error);
      }
    }
    
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

  const renderDistributionCard = (distribution: TeXDistribution) => (
    <div
      key={distribution.name}
      className={`border rounded-lg p-4 cursor-pointer transition-all ${
        distribution.isActive
          ? 'border-blue-500 bg-blue-50'
          : distribution.isValid
          ? 'border-green-300 bg-green-50 hover:bg-green-100'
          : 'border-red-300 bg-red-50'
      }`}
      onClick={() => distribution.isValid && handleSetActiveDistribution(distribution.name)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`w-4 h-4 rounded-full ${
            distribution.isActive ? 'bg-blue-500' : distribution.isValid ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          <div>
            <h4 className="font-medium text-gray-900">{distribution.name}</h4>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              {distribution.isBundled && (
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">Bundled</span>
              )}
              <span className={`px-2 py-1 text-xs rounded ${
                distribution.isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {distribution.isValid ? 'Valid' : 'Invalid'}
              </span>
              {distribution.isActive && (
                <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">Active</span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        {Object.entries(distribution).map(([key, binary]) => {
          if (key === 'name' || key === 'isBundled' || key === 'isValid' || key === 'isActive' || typeof binary !== 'object') return null;
          const binaryInfo = binary as TeXBinary;
          
          return (
            <div key={key} className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${binaryInfo.isValid ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-gray-700 font-mono">{key}</span>
              {binaryInfo.version && (
                <span className="text-gray-500">({binaryInfo.version})</span>
              )}
            </div>
          );
        })}
      </div>
      
      {!distribution.isBundled && (
        <div className="mt-2 text-xs text-gray-500 font-mono truncate">
          {distribution.pdflatex.path || 'Path not found'}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
          <div className="flex space-x-4 mt-2">
            <button
              onClick={() => setActiveTab('compilation')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                activeTab === 'compilation' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Compilation
            </button>
            <button
              onClick={() => setActiveTab('tex')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                activeTab === 'tex' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              TeX Distribution
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {activeTab === 'compilation' && (
            <div className="space-y-6">
              {/* Auto-compile Toggle */}
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
                <div className="space-y-3">
                  <label htmlFor="autoCompileDelay" className="text-sm font-medium text-gray-700">
                    Auto-compile delay: {localAutoCompileDelay}ms
                  </label>
                  <input
                    id="autoCompileDelay"
                    type="range"
                    min="100"
                    max="5000"
                    step="50"
                    value={localAutoCompileDelay}
                    onChange={(e) => handleDelayChange(e.target.value)}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>100ms</span>
                    <span>5000ms</span>
                  </div>
                </div>
              )}

              {/* Advanced Compilation Settings */}
              {texSettings && (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-medium text-gray-900">Advanced Settings</h3>
                  
                  {/* Default Engine */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Default Engine</label>
                    <select
                      value={texSettings.engineDefault}
                      onChange={(e) => handleTexSettingChange('engineDefault', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="pdflatex">pdfLaTeX</option>
                      <option value="xelatex">XeLaTeX</option>
                      <option value="lualatex">LuaLaTeX</option>
                    </select>
                  </div>

                  {/* Timeout */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Compile Timeout: {Math.floor(texSettings.timeoutMs / 1000)}s
                    </label>
                    <input
                      type="range"
                      min="30"
                      max="600"
                      step="30"
                      value={Math.floor(texSettings.timeoutMs / 1000)}
                      onChange={(e) => handleTexSettingChange('timeoutMs', parseInt(e.target.value) * 1000)}
                      className="mt-1 w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>30s</span>
                      <span>10min</span>
                    </div>
                  </div>

                  {/* Max Log Size */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Max Log Size: {texSettings.maxLogSizeKB}KB
                    </label>
                    <input
                      type="range"
                      min="100"
                      max="5000"
                      step="100"
                      value={texSettings.maxLogSizeKB}
                      onChange={(e) => handleTexSettingChange('maxLogSizeKB', parseInt(e.target.value))}
                      className="mt-1 w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>100KB</span>
                      <span>5MB</span>
                    </div>
                  </div>

                  {/* Shell Escape */}
                  <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Shell Escape</label>
                      <p className="text-sm text-yellow-700">
                        ⚠️ Security risk: Allows LaTeX to execute shell commands
                      </p>
                    </div>
                    <button
                      onClick={() => handleTexSettingChange('shellEscapeEnabled', !texSettings.shellEscapeEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 ${
                        texSettings.shellEscapeEnabled ? 'bg-red-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          texSettings.shellEscapeEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tex' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">TeX Distributions</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowAddCustom(true)}
                    className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Add Custom
                  </button>
                  <button
                    onClick={handleRedetectTeX}
                    disabled={isRedetecting || isLoadingTeX}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRedetecting ? 'Detecting...' : 'Re-detect'}
                  </button>
                </div>
              </div>

              {isLoadingTeX ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Loading TeX distributions...</span>
                </div>
              ) : texSettings ? (
                <div className="space-y-4">
                  {texSettings.distributions.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <div className="text-gray-400 text-4xl mb-2">📄</div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No TeX Distribution Found</h3>
                      <p className="text-gray-600 mb-4">
                        The app works fully offline when bundled with TeX, or you can point to system binaries.
                      </p>
                      <button
                        onClick={() => setShowAddCustom(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Add Custom Distribution
                      </button>
                    </div>
                  ) : (
                    texSettings.distributions.map(renderDistributionCard)
                  )}

                  {/* Add Custom Distribution Form */}
                  {showAddCustom && (
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <h4 className="font-medium text-gray-900 mb-3">Add Custom TeX Distribution</h4>
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Distribution name (e.g., Custom TeX Live 2023)"
                          value={customDistributionName}
                          onChange={(e) => setCustomDistributionName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                        
                        {['latexmk', 'pdflatex', 'xelatex', 'lualatex', 'biber', 'bibtex'].map(binary => (
                          <div key={binary}>
                            <label className="text-sm text-gray-700">{binary} path:</label>
                            <input
                              type="text"
                              placeholder={`/usr/local/bin/${binary}`}
                              value={customPaths[binary] || ''}
                              onChange={(e) => setCustomPaths(prev => ({ ...prev, [binary]: e.target.value }))}
                              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                            />
                          </div>
                        ))}
                        
                        <div className="flex space-x-2 pt-2">
                          <button
                            onClick={handleAddCustomDistribution}
                            disabled={!customDistributionName}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Add Distribution
                          </button>
                          <button
                            onClick={() => {
                              setShowAddCustom(false);
                              setCustomDistributionName('');
                              setCustomPaths({});
                            }}
                            className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">Failed to load TeX distribution information</p>
                  <button
                    onClick={loadTexSettings}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
