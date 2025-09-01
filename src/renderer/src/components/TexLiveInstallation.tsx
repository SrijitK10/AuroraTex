import React, { useState, useEffect } from 'react';

// Simple icon components to replace @heroicons/react
const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ExclamationTriangleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

const ArrowDownTrayIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
  </svg>
);

const StopIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6v6H9z" />
  </svg>
);

const InformationCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

interface TexLiveInstallProgress {
  stage: 'downloading' | 'extracting' | 'installing' | 'configuring' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

interface TexLiveInstallationProps {
  show: boolean;
  onClose: () => void;
  onInstallComplete: () => void;
}

export const TexLiveInstallation: React.FC<TexLiveInstallationProps> = ({
  show,
  onClose,
  onInstallComplete
}) => {
  const [installProgress, setInstallProgress] = useState<TexLiveInstallProgress | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [readinessCheck, setReadinessCheck] = useState<any>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (show) {
      checkReadiness();
    }
  }, [show]);

  useEffect(() => {
    if (isInstalling) {
      // Listen for installation progress
      const handleProgress = (_: any, progress: TexLiveInstallProgress) => {
        setInstallProgress(progress);
        
        if (progress.stage === 'complete') {
          setTimeout(() => {
            setIsInstalling(false);
            onInstallComplete();
          }, 2000);
        } else if (progress.stage === 'error') {
          setIsInstalling(false);
        }
      };

      window.electronAPI.on('tex-install-progress', handleProgress);
      return () => {
        window.electronAPI.removeListener('tex-install-progress', handleProgress);
      };
    }
  }, [isInstalling, onInstallComplete]);

  const checkReadiness = async () => {
    try {
      const readiness = await window.electronAPI.checkTexInstallReadiness();
      setReadinessCheck(readiness);
    } catch (error) {
      console.error('Failed to check installation readiness:', error);
    }
  };

  const startInstallation = async () => {
    setIsInstalling(true);
    setInstallProgress({
      stage: 'downloading',
      progress: 0,
      message: 'Preparing for TeX Live installation...'
    });

    try {
      await window.electronAPI.installTexLive();
    } catch (error) {
      setInstallProgress({
        stage: 'error',
        progress: 0,
        message: 'Installation failed',
        error: error instanceof Error ? error.message : String(error)
      });
      setIsInstalling(false);
    }
  };

  const cancelInstallation = async () => {
    try {
      await window.electronAPI.cancelTexInstall();
      setIsInstalling(false);
      setInstallProgress(null);
    } catch (error) {
      console.error('Failed to cancel installation:', error);
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'downloading':
        return <ArrowDownTrayIcon className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'extracting':
      case 'installing':
      case 'configuring':
        return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'complete':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'error':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <InformationCircleIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStageDescription = (stage: string) => {
    switch (stage) {
      case 'downloading':
        return 'Downloading TeX Live installer from CTAN mirror...';
      case 'extracting':
        return 'Extracting installation files...';
      case 'installing':
        return 'Installing TeX Live packages (this may take 10-30 minutes)...';
      case 'configuring':
        return 'Configuring environment and updating package database...';
      case 'complete':
        return 'TeX Live installation completed successfully!';
      case 'error':
        return 'Installation encountered an error.';
      default:
        return 'Preparing installation...';
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Install TeX Live Automatically
            </h2>
            {!isInstalling && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {!isInstalling && !installProgress ? (
            // Pre-installation info
            <div className="space-y-6">
              <div className="flex items-start space-x-3">
                <InformationCircleIcon className="w-6 h-6 text-blue-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900">What is TeX Live?</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    TeX Live is a comprehensive TeX system that includes all the programs, fonts, and macro packages needed to compile LaTeX documents. AuroraTex can automatically download and install it for you.
                  </p>
                </div>
              </div>

              {readinessCheck && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Platform:</span>
                      <span className="ml-2 text-gray-600">{readinessCheck.platform} ({readinessCheck.architecture})</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Download Size:</span>
                      <span className="ml-2 text-gray-600">~{readinessCheck.estimatedSize}MB</span>
                    </div>
                  </div>

                  {readinessCheck.issues.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <div className="flex items-start">
                        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div className="ml-2">
                          <h4 className="text-sm font-medium text-yellow-800">Installation Issues</h4>
                          <ul className="mt-1 text-sm text-yellow-700 list-disc list-inside">
                            {readinessCheck.issues.map((issue: string, index: number) => (
                              <li key={index}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 className="font-medium text-blue-900 mb-2">Installation Process</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Downloads TeX Live installer from official CTAN mirror</li>
                  <li>• Installs basic TeX Live scheme (~4.5GB on disk)</li>
                  <li>• Configures binaries and package database</li>
                  <li>• Makes LaTeX commands available to AuroraTex</li>
                </ul>
                <p className="text-xs text-blue-600 mt-2">
                  <strong>Note:</strong> Installation typically takes 10-30 minutes depending on your internet speed and system performance.
                </p>
              </div>

              {showAdvanced && (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Advanced Information</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Install Location:</strong> {readinessCheck?.installPath || 'User app data directory'}</p>
                    <p><strong>Mirror:</strong> CTAN official mirrors</p>
                    <p><strong>Scheme:</strong> Basic (expandable via tlmgr)</p>
                    <p><strong>Platform Support:</strong> macOS, Windows, Linux</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                {showAdvanced ? 'Hide' : 'Show'} advanced information
              </button>
            </div>
          ) : (
            // Installation progress
            <div className="space-y-6">
              {installProgress && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    {getStageIcon(installProgress.stage)}
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 capitalize">
                        {installProgress.stage === 'error' ? 'Installation Failed' : installProgress.stage}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {installProgress.message}
                      </p>
                    </div>
                  </div>

                  {installProgress.stage !== 'error' && installProgress.stage !== 'complete' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{getStageDescription(installProgress.stage)}</span>
                        <span>{installProgress.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${installProgress.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {installProgress.error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <div className="flex items-start">
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mt-0.5" />
                        <div className="ml-2">
                          <h4 className="text-sm font-medium text-red-800">Error Details</h4>
                          <p className="mt-1 text-sm text-red-700">{installProgress.error}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {installProgress.stage === 'complete' && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3">
                      <div className="flex items-center">
                        <CheckCircleIcon className="w-5 h-5 text-green-600" />
                        <div className="ml-2">
                          <h4 className="text-sm font-medium text-green-800">Installation Complete!</h4>
                          <p className="text-sm text-green-700">
                            TeX Live is now installed and ready to use. AuroraTex will automatically detect it.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <div className="flex space-x-3">
            {!isInstalling && !installProgress && (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={startInstallation}
                  disabled={readinessCheck && !readinessCheck.canInstall}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  Install TeX Live
                </button>
              </>
            )}

            {isInstalling && installProgress && installProgress.stage !== 'complete' && installProgress.stage !== 'error' && (
              <button
                onClick={cancelInstallation}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors flex items-center space-x-2"
              >
                <StopIcon className="w-4 h-4" />
                <span>Cancel Installation</span>
              </button>
            )}

            {installProgress && (installProgress.stage === 'complete' || installProgress.stage === 'error') && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Close
              </button>
            )}
          </div>

          <a
            href="https://tug.org/texlive/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            Learn more about TeX Live
          </a>
        </div>
      </div>
    </div>
  );
};
