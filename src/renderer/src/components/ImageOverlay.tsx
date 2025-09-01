import React, { useState, useEffect } from 'react';

interface ImageOverlayProps {
  projectId: string;
  filePath: string;
  fileName: string;
  isVisible: boolean;
  onClose: () => void;
}

export const ImageOverlay: React.FC<ImageOverlayProps> = ({ 
  projectId, 
  filePath, 
  fileName, 
  isVisible, 
  onClose 
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  // Handle escape key to close overlay
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isVisible) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    if (isVisible) {
      // Add event listener with capture = true to handle before other listeners
      document.addEventListener('keydown', handleKeyDown, { capture: true });
    }

    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isVisible, onClose]);

  useEffect(() => {
    if (!isVisible || !filePath) {
      setImageUrl('');
      setError('');
      setImageSize(null);
      return;
    }

    const loadImage = async () => {
      setLoading(true);
      setError('');
      
      try {
        const imageData = await window.electronAPI.fsReadFile({
          projectId: projectId,
          relPath: filePath,
        });

        if (imageData instanceof Uint8Array) {
          const safeArray = new Uint8Array(imageData);
          const blob = new Blob([safeArray], { type: getMimeType(filePath) });
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
        } else {
          setError('Invalid image data format');
        }
      } catch (err) {
        console.error('ImageOverlay: Failed to load image:', err);
        setError('Failed to load image');
      } finally {
        setLoading(false);
      }
    };

    loadImage();
    
    // Cleanup function
    return () => {
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [projectId, filePath, isVisible]);

  const getMimeType = (filePath: string): string => {
    const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff'
    };
    return mimeTypes[extension] || 'image/png';
  };

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Close overlay when clicking on background, but not on image
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 text-2xl font-bold z-10"
        title="Close image viewer (Esc)"
      >
        ✕
      </button>

      {/* Image info header */}
      <div className="absolute top-4 left-4 text-white z-10">
        <div className="bg-black bg-opacity-50 px-3 py-2 rounded">
          <div className="font-medium">{fileName}</div>
          {imageSize && (
            <div className="text-sm text-gray-300">
              {imageSize.width} × {imageSize.height} pixels
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center">
        {loading && (
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>Loading image...</p>
          </div>
        )}

        {error && (
          <div className="text-white text-center">
            <div className="text-red-400 text-6xl mb-4">⚠️</div>
            <p className="text-xl mb-2">Failed to load image</p>
            <p className="text-gray-400">{error}</p>
          </div>
        )}

        {imageUrl && !loading && !error && (
          <img
            src={imageUrl}
            alt={fileName}
            onLoad={handleImageLoad}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </div>
  );
};
