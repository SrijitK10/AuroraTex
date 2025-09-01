import React, { useState, useEffect } from 'react';

interface FirstRunCheckResult {
  isFirstRun: boolean;
  checks: {
    appDataDirectory: boolean;
    bundledTeX: boolean;
    systemTeX: boolean;
    sampleTemplates: boolean;
    writePermissions: boolean;
  };
  texDistributions: any[];
  errors: string[];
  recommendations: string[];
}

interface FirstRunStatusProps {
  onRefresh?: () => void;
}

export const FirstRunStatus: React.FC<FirstRunStatusProps> = ({ onRefresh }) => {
  const [checkResult, setCheckResult] = useState<FirstRunCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadFirstRunStatus();
  }, []);

  const loadFirstRunStatus = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.firstRunPerformCheck();
      setCheckResult(result);
    } catch (error) {
      console.error('Failed to load first-run status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadFirstRunStatus();
    onRefresh?.();
  };

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ) : (
      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  };

  const getOverallStatus = (): 'good' | 'partial' | 'poor' => {
    if (!checkResult) return 'poor';
    
    const { checks } = checkResult;
    const essentialChecks = [
      checks.appDataDirectory,
      checks.writePermissions,
      checks.bundledTeX || checks.systemTeX
    ];
    
    if (essentialChecks.every(check => check)) return 'good';
    if (essentialChecks.some(check => check)) return 'partial';
    return 'poor';
  };

  if (loading) {
    return (
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="text-blue-700">Checking system status...</span>
        </div>
      </div>
    );
  }

  if (!checkResult) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-red-700">Failed to check system status</span>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const overallStatus = getOverallStatus();
  const statusConfig = {
    good: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
      icon: (
        <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'System Ready',
      message: 'AuroraTex is properly configured and ready to use.'
    },
    partial: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-700',
      icon: (
        <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.598 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      title: 'Partial Setup',
      message: 'Some features may not work properly. Check the details below.'
    },
    poor: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700',
      icon: (
        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Setup Required',
      message: 'Critical issues found. The application may not function properly.'
    }
  };

  const config = statusConfig[overallStatus];

  return (
    <div className={`p-4 ${config.bgColor} border ${config.borderColor} rounded-lg`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          {config.icon}
          <div>
            <h3 className={`font-medium ${config.textColor}`}>{config.title}</h3>
            <p className={`text-sm ${config.textColor} mt-1`}>{config.message}</p>
            
            {checkResult.isFirstRun && (
              <p className={`text-xs ${config.textColor} mt-2 font-medium`}>
                First Run - Setup completed automatically
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className={`px-3 py-1 text-xs ${config.textColor} hover:bg-opacity-20 hover:bg-gray-500 rounded`}
          >
            {expanded ? 'Hide Details' : 'Show Details'}
          </button>
          <button
            onClick={handleRefresh}
            className={`px-3 py-1 text-xs ${config.textColor} hover:bg-opacity-20 hover:bg-gray-500 rounded`}
          >
            Refresh
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* System Checks */}
          <div>
            <h4 className={`font-medium ${config.textColor} mb-2`}>System Checks</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                {getStatusIcon(checkResult.checks.appDataDirectory)}
                <span className="text-sm">Application data directory</span>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(checkResult.checks.writePermissions)}
                <span className="text-sm">Write permissions</span>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(checkResult.checks.bundledTeX || checkResult.checks.systemTeX)}
                <span className="text-sm">TeX distribution 
                  {checkResult.checks.bundledTeX && <span className="ml-1 text-xs">(bundled)</span>}
                  {checkResult.checks.systemTeX && !checkResult.checks.bundledTeX && <span className="ml-1 text-xs">(system)</span>}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(checkResult.checks.sampleTemplates)}
                <span className="text-sm">Sample templates</span>
              </div>
            </div>
          </div>

          {/* TeX Distributions */}
          {checkResult.texDistributions.length > 0 && (
            <div>
              <h4 className={`font-medium ${config.textColor} mb-2`}>
                TeX Distributions ({checkResult.texDistributions.length})
              </h4>
              <div className="space-y-1">
                {checkResult.texDistributions.map((dist, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    {getStatusIcon(dist.isValid)}
                    <span className="text-sm">
                      {dist.name}
                      {dist.isBundled && <span className="ml-1 text-xs">(bundled)</span>}
                      {dist.isActive && <span className="ml-1 text-xs font-medium">(active)</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {checkResult.errors.length > 0 && (
            <div>
              <h4 className="font-medium text-red-700 mb-2">Issues Found</h4>
              <ul className="space-y-1">
                {checkResult.errors.map((error, index) => (
                  <li key={index} className="text-sm text-red-600 flex items-start space-x-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {checkResult.recommendations.length > 0 && (
            <div>
              <h4 className={`font-medium ${config.textColor} mb-2`}>Recommendations</h4>
              <ul className="space-y-1">
                {checkResult.recommendations.map((rec, index) => (
                  <li key={index} className={`text-sm ${config.textColor} flex items-start space-x-2`}>
                    <span className={`${config.textColor} mt-0.5`}>•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FirstRunStatus;
