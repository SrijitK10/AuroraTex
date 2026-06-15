import React, { useState, useEffect } from 'react';
import FirstRunStatus from './FirstRunStatus';

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
  // Milestone 10: Enhanced security settings
  shellEscapeGlobalWarning?: boolean;
  resourceLimits?: {
    enableProcessPriority: boolean;
    maxCompileTimeMs: number;
    autoCompileTimeoutMs: number;
  };
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAutoCompileEnabled: boolean;
  onToggleAutoCompile: (enabled: boolean) => void;
  autoCompileDelay: number;
  onAutoCompileDelayChange: (delay: number) => void;
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isAutoCompileEnabled,
  onToggleAutoCompile,
  autoCompileDelay,
  onAutoCompileDelayChange,
  theme,
  onThemeChange,
}) => {
  const [localAutoCompileEnabled, setLocalAutoCompileEnabled] = useState(isAutoCompileEnabled);
  const [localAutoCompileDelay, setLocalAutoCompileDelay] = useState(autoCompileDelay);
  const [texSettings, setTexSettings] = useState<TeXSettings | null>(null);
  const [isLoadingTeX, setIsLoadingTeX] = useState(false);
  const [isRedetecting, setIsRedetecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'appearance' | 'compilation' | 'tex' | 'security' | 'system'>('appearance');
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
    // Auto-compile setting and delay are already saved immediately when changed
    
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

  const handleSaveTexSettings = async () => {
    if (!texSettings) return;
    
    try {
      await window.electronAPI.settingsUpdateTexSettings({ settings: texSettings });
      console.log('Security settings saved successfully');
    } catch (error) {
      console.error('Failed to save security settings:', error);
    }
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
      // Immediately apply the delay change to the parent
      onAutoCompileDelayChange(numValue);
    }
  };

  if (!isOpen) return null;

  const renderDistributionCard = (distribution: TeXDistribution) => (
    <div
      key={distribution.name}
      className={`border rounded-lg p-4 cursor-pointer transition-all ${
        distribution.isActive
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
          : distribution.isValid
          ? 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-900/20'
          : 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20'
      }`}
      onClick={() => distribution.isValid && handleSetActiveDistribution(distribution.name)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`w-4 h-4 rounded-full ${
            distribution.isActive ? 'bg-blue-500' : distribution.isValid ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">{distribution.name}</h4>
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              {distribution.isBundled && (
                <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded">Bundled</span>
              )}
              <span className={`px-2 py-1 text-xs rounded ${
                distribution.isValid ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
              }`}>
                {distribution.isValid ? 'Valid' : 'Invalid'}
              </span>
              {distribution.isActive && (
                <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded">Active</span>
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
              <span className="text-gray-700 dark:text-gray-300 font-mono">{key}</span>
              {binaryInfo.version && (
                <span className="text-gray-500 dark:text-gray-400">({binaryInfo.version})</span>
              )}
            </div>
          );
        })}
      </div>
      
      {!distribution.isBundled && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
          {distribution.pdflatex.path || 'Path not found'}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-gray-900/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 transition-all">
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/50 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 glass-header border-b border-gray-200/50 dark:border-gray-800/50 shrink-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
          <div className="flex space-x-4 mt-2">
            <button
              onClick={() => setActiveTab('appearance')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                activeTab === 'appearance' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
              }`}
            >
              Appearance
            </button>
            <button
              onClick={() => setActiveTab('compilation')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                activeTab === 'compilation' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
              }`}
            >
              Compilation
            </button>
            <button
              onClick={() => setActiveTab('tex')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                activeTab === 'tex' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
              }`}
            >
              TeX Distribution
            </button>
            {/* Milestone 10: Security Settings Tab */}
            <button
              onClick={() => setActiveTab('security')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                activeTab === 'security' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
              }`}
            >
              Security & Limits
            </button>
            {/* Milestone 14: System Status Tab */}
            <button
              onClick={() => setActiveTab('system')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                activeTab === 'system' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
              }`}
            >
              System Status
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 flex-1 overflow-y-auto custom-scrollbar min-h-[40vh]">
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Theme</h3>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => onThemeChange('light')}
                    className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all ${
                      theme === 'light'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="w-10 h-10 mb-2 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Light</span>
                  </button>
                  <button
                    onClick={() => onThemeChange('dark')}
                    className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all ${
                      theme === 'dark'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="w-10 h-10 mb-2 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Dark</span>
                  </button>
                  <button
                    onClick={() => onThemeChange('system')}
                    className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all ${
                      theme === 'system'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="w-10 h-10 mb-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">System</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'compilation' && (
            <div className="space-y-6">
              {/* Auto-compile Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="autoCompile" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Auto-compile
                  </label>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Automatically compile when .tex files are saved
                  </p>
                </div>
                <button
                  id="autoCompile"
                  onClick={() => {
                    console.log('🔧 SETTINGS MODAL: Auto-compile toggle clicked');
                    const newValue = !localAutoCompileEnabled;
                    console.log('🔧 SETTINGS MODAL: Toggling from', localAutoCompileEnabled, 'to', newValue);
                    setLocalAutoCompileEnabled(newValue);
                    // Immediately call the parent function to update the app state
                    console.log('🔧 SETTINGS MODAL: Calling parent onToggleAutoCompile with:', newValue);
                    onToggleAutoCompile(newValue);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    localAutoCompileEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
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
                  <label htmlFor="autoCompileDelay" className="text-sm font-medium text-gray-900 dark:text-gray-100">
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
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>100ms</span>
                    <span>5000ms</span>
                  </div>
                </div>
              )}

              {/* Advanced Compilation Settings */}
              {texSettings && (
                <div className="space-y-4 pt-4 border-t border-gray-200/50 dark:border-gray-800/50 mt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Advanced Settings</h3>
                  
                  {/* Default Engine */}
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1.5 block">Default Engine</label>
                    <select
                      value={texSettings.engineDefault}
                      onChange={(e) => handleTexSettingChange('engineDefault', e.target.value)}
                      className="minimal-input"
                    >
                      <option value="pdflatex">pdfLaTeX</option>
                      <option value="xelatex">XeLaTeX</option>
                      <option value="lualatex">LuaLaTeX</option>
                    </select>
                  </div>

                  {/* Timeout */}
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 block">
                      Compile Timeout: {Math.floor(texSettings.timeoutMs / 1000)}s
                    </label>
                    <input
                      type="range"
                      min="30"
                      max="600"
                      step="30"
                      value={Math.floor(texSettings.timeoutMs / 1000)}
                      onChange={(e) => handleTexSettingChange('timeoutMs', parseInt(e.target.value) * 1000)}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>30s</span>
                      <span>10min</span>
                    </div>
                  </div>

                  {/* Max Log Size */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Max Log Size: {texSettings.maxLogSizeKB}KB
                    </label>
                    <input
                      type="range"
                      min="100"
                      max="5000"
                      step="100"
                      value={texSettings.maxLogSizeKB}
                      onChange={(e) => handleTexSettingChange('maxLogSizeKB', parseInt(e.target.value))}
                      className="mt-1 w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>100KB</span>
                      <span>5MB</span>
                    </div>
                  </div>

                  {/* Shell Escape */}
                  <div className="flex items-center justify-between p-4 bg-yellow-50/50 dark:bg-yellow-900/20 border border-yellow-200/50 dark:border-yellow-700/50 backdrop-blur-sm rounded-xl">
                    <div>
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Shell Escape</label>
                      <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-1">
                        ⚠️ Security risk: Allows LaTeX to execute shell commands
                      </p>
                    </div>
                    <button
                      onClick={() => handleTexSettingChange('shellEscapeEnabled', !texSettings.shellEscapeEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 ${
                        texSettings.shellEscapeEnabled ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-700'
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
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">TeX Distributions</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowAddCustom(true)}
                    className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                  >
                    Add Custom
                  </button>
                  <button
                    onClick={handleRedetectTeX}
                    disabled={isRedetecting || isLoadingTeX}
                    className="minimal-button-primary disabled:opacity-50"
                  >
                    {isRedetecting ? 'Detecting...' : 'Re-detect'}
                  </button>
                </div>
              </div>

              {isLoadingTeX ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading TeX distributions...</span>
                </div>
              ) : texSettings ? (
                <div className="space-y-4">
                  {texSettings.distributions.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl">
                      <div className="text-gray-400 text-4xl mb-2">📄</div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No TeX Distribution Found</h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        The app works fully offline when bundled with TeX, or you can point to system binaries.
                      </p>
                      <button
                        onClick={() => setShowAddCustom(true)}
                        className="minimal-button-primary"
                      >
                        Add Custom Distribution
                      </button>
                    </div>
                  ) : (
                    texSettings.distributions.map(renderDistributionCard)
                  )}

                  {/* Add Custom Distribution Form */}
                  {showAddCustom && (
                    <div className="border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-4">Add Custom TeX Distribution</h4>
                      <div className="space-y-4">
                        <input
                          type="text"
                          placeholder="Distribution name (e.g., Custom TeX Live 2023)"
                          value={customDistributionName}
                          onChange={(e) => setCustomDistributionName(e.target.value)}
                          className="minimal-input"
                        />
                        
                        {['latexmk', 'pdflatex', 'xelatex', 'lualatex', 'biber', 'bibtex'].map(binary => (
                          <div key={binary}>
                            <label className="text-sm text-gray-700 dark:text-gray-300 mb-1.5 block">{binary} path:</label>
                            <input
                              type="text"
                              placeholder={`/usr/local/bin/${binary}`}
                              value={customPaths[binary] || ''}
                              onChange={(e) => setCustomPaths(prev => ({ ...prev, [binary]: e.target.value }))}
                              className="minimal-input font-mono text-sm"
                            />
                          </div>
                        ))}
                        
                        <div className="flex space-x-3 pt-2">
                          <button
                            onClick={handleAddCustomDistribution}
                            disabled={!customDistributionName}
                            className="minimal-button-primary disabled:opacity-50"
                          >
                            Add Distribution
                          </button>
                          <button
                            onClick={() => {
                              setShowAddCustom(false);
                              setCustomDistributionName('');
                              setCustomPaths({});
                            }}
                            className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
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
                  <p className="text-gray-500 dark:text-gray-400 mb-6">Failed to load TeX distribution information</p>
                  <button
                    onClick={loadTexSettings}
                    className="minimal-button-primary"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Milestone 10: Security & Limits Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-yellow-50/50 dark:bg-yellow-900/20 border border-yellow-200/50 dark:border-yellow-700/50 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-500">Security Notice</h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-600 mt-1">
                      These settings control LaTeX compilation security. Shell-escape allows LaTeX documents to execute system commands and should only be enabled for trusted documents.
                    </p>
                  </div>
                </div>
              </div>

              {/* Global Shell-Escape Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Shell-Escape Control</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="globalShellEscape" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Global Shell-Escape Default
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Default shell-escape setting for new projects. Individual projects can override this.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="globalShellEscape"
                      checked={texSettings?.shellEscapeEnabled || false}
                      onChange={async (e) => {
                        if (texSettings) {
                          const updatedSettings = { ...texSettings, shellEscapeEnabled: e.target.checked };
                          setTexSettings(updatedSettings);
                          // Auto-save security settings
                          try {
                            await window.electronAPI.settingsUpdateTexSettings({ settings: updatedSettings });
                          } catch (error) {
                            console.error('Failed to save shell-escape setting:', error);
                          }
                        }
                      }}
                      className="sr-only"
                    />
                    <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out focus-within:ring-4 focus-within:ring-red-300 ${
                      texSettings?.shellEscapeEnabled ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}>
                      <div className={`absolute top-[2px] left-[2px] bg-white border border-gray-300 dark:border-gray-600 dark:bg-gray-300 rounded-full h-5 w-5 transition-transform duration-200 ease-in-out ${
                        texSettings?.shellEscapeEnabled ? 'translate-x-full border-white' : 'translate-x-0'
                      }`}></div>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="shellEscapeWarning" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Show Security Warnings
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Display security warnings when shell-escape is enabled for projects.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="shellEscapeWarning"
                      checked={texSettings?.shellEscapeGlobalWarning !== false}
                      onChange={async (e) => {
                        if (texSettings) {
                          const updatedSettings = { ...texSettings, shellEscapeGlobalWarning: e.target.checked };
                          setTexSettings(updatedSettings);
                          // Auto-save security settings
                          try {
                            await window.electronAPI.settingsUpdateTexSettings({ settings: updatedSettings });
                          } catch (error) {
                            console.error('Failed to save warning setting:', error);
                          }
                        }
                      }}
                      className="sr-only"
                    />
                    <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out focus-within:ring-4 focus-within:ring-blue-300 ${
                      texSettings?.shellEscapeGlobalWarning !== false ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}>
                      <div className={`absolute top-[2px] left-[2px] bg-white border border-gray-300 dark:border-gray-600 dark:bg-gray-300 rounded-full h-5 w-5 transition-transform duration-200 ease-in-out ${
                        texSettings?.shellEscapeGlobalWarning !== false ? 'translate-x-full border-white' : 'translate-x-0'
                      }`}></div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Resource Limits */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Resource Limits</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="processPriority" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Lower Process Priority
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Reduce LaTeX process priority to limit resource usage (Unix systems only).
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="processPriority"
                      checked={texSettings?.resourceLimits?.enableProcessPriority !== false}
                      onChange={async (e) => {
                        if (texSettings) {
                          const updatedSettings = { 
                            ...texSettings, 
                            resourceLimits: { 
                              ...texSettings.resourceLimits,
                              enableProcessPriority: e.target.checked,
                              maxCompileTimeMs: texSettings.resourceLimits?.maxCompileTimeMs || 180000,
                              autoCompileTimeoutMs: texSettings.resourceLimits?.autoCompileTimeoutMs || 120000
                            }
                          };
                          setTexSettings(updatedSettings);
                          // Auto-save security settings
                          try {
                            await window.electronAPI.settingsUpdateTexSettings({ settings: updatedSettings });
                          } catch (error) {
                            console.error('Failed to save process priority setting:', error);
                          }
                        }
                      }}
                      className="sr-only"
                    />
                    <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out focus-within:ring-4 focus-within:ring-blue-300 ${
                      texSettings?.resourceLimits?.enableProcessPriority !== false ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}>
                      <div className={`absolute top-[2px] left-[2px] bg-white border border-gray-300 dark:border-gray-600 dark:bg-gray-300 rounded-full h-5 w-5 transition-transform duration-200 ease-in-out ${
                        texSettings?.resourceLimits?.enableProcessPriority !== false ? 'translate-x-full border-white' : 'translate-x-0'
                      }`}></div>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="maxCompileTime" className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1.5 block">
                      Manual Compile Timeout (seconds)
                    </label>
                    <input
                      type="number"
                      id="maxCompileTime"
                      min="30"
                      max="600"
                      value={Math.round((texSettings?.resourceLimits?.maxCompileTimeMs || 180000) / 1000)}
                      onChange={async (e) => {
                        const timeoutMs = parseInt(e.target.value) * 1000;
                        if (texSettings && timeoutMs >= 30000 && timeoutMs <= 600000) {
                          const updatedSettings = { 
                            ...texSettings, 
                            resourceLimits: { 
                              ...texSettings.resourceLimits,
                              enableProcessPriority: texSettings.resourceLimits?.enableProcessPriority !== false,
                              maxCompileTimeMs: timeoutMs,
                              autoCompileTimeoutMs: texSettings.resourceLimits?.autoCompileTimeoutMs || 120000
                            }
                          };
                          setTexSettings(updatedSettings);
                          // Auto-save after a brief delay
                          setTimeout(async () => {
                            try {
                              await window.electronAPI.settingsUpdateTexSettings({ settings: updatedSettings });
                            } catch (error) {
                              console.error('Failed to save timeout setting:', error);
                            }
                          }, 500);
                        }
                      }}
                      className="minimal-input"
                    />
                  </div>

                  <div>
                    <label htmlFor="autoCompileTimeout" className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1.5 block">
                      Auto-compile Timeout (seconds)
                    </label>
                    <input
                      type="number"
                      id="autoCompileTimeout"
                      min="30"
                      max="300"
                      value={Math.round((texSettings?.resourceLimits?.autoCompileTimeoutMs || 120000) / 1000)}
                      onChange={async (e) => {
                        const timeoutMs = parseInt(e.target.value) * 1000;
                        if (texSettings && timeoutMs >= 30000 && timeoutMs <= 300000) {
                          const updatedSettings = { 
                            ...texSettings, 
                            resourceLimits: { 
                              ...texSettings.resourceLimits,
                              enableProcessPriority: texSettings.resourceLimits?.enableProcessPriority !== false,
                              maxCompileTimeMs: texSettings.resourceLimits?.maxCompileTimeMs || 180000,
                              autoCompileTimeoutMs: timeoutMs
                            }
                          };
                          setTexSettings(updatedSettings);
                          // Auto-save after a brief delay
                          setTimeout(async () => {
                            try {
                              await window.electronAPI.settingsUpdateTexSettings({ settings: updatedSettings });
                            } catch (error) {
                              console.error('Failed to save auto-compile timeout setting:', error);
                            }
                          }, 500);
                        }
                      }}
                      className="minimal-input"
                    />
                  </div>
                </div>

                <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50 backdrop-blur-sm rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-blue-800 dark:text-blue-400">Security Best Practices</h3>
                      <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
                        <li>• Keep shell-escape disabled for untrusted documents</li>
                        <li>• Shorter timeouts prevent runaway compilations</li>
                        <li>• Process priority limits prevent system slowdowns</li>
                        <li>• Review documents before enabling shell-escape</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Milestone 14: System Status Tab */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <FirstRunStatus />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 glass-header border-t border-gray-200/50 dark:border-gray-800/50 shrink-0 flex justify-end space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="minimal-button-primary"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
