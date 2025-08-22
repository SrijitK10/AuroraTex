import React, { useState, useEffect } from 'react';

interface ImageViewerProps {
  projectId: string;
  filePath: string;
  fileName: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ projectId, filePath, fileName }) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const loadImage = async () => {
      setLoading(true);
      setError('');
      
      try {
        // Read the image file as binary data
        const imageData = await window.electronAPI.fsReadFile({
          projectId: projectId,
          relPath: filePath,
        });

        if (imageData instanceof Uint8Array) {
          // Create a new Uint8Array to ensure compatibility
          const safeArray = new Uint8Array(imageData);
          const blob = new Blob([safeArray], { type: getMimeType(filePath) });
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
        } else {
          setError('Invalid image data format');
        }
      } catch (err) {
        console.error('ImageViewer: Failed to load image:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to load image: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
    
    // Cleanup function to revoke object URL
    return () => {
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [projectId, filePath]);

  const getMimeType = (filePath: string): string => {
    const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    switch (extension) {
      case '.png': return 'image/png';
      case '.jpg':
      case '.jpeg': return 'image/jpeg';
      case '.gif': return 'image/gif';
      case '.bmp': return 'image/bmp';
      case '.svg': return 'image/svg+xml';
      case '.webp': return 'image/webp';
      case '.ico': return 'image/x-icon';
      case '.tiff':
      case '.tif': return 'image/tiff';
      default: return 'image/png';
    }
  };

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading image...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-2">⚠️</div>
          <p className="text-sm text-red-600 mb-1">Failed to load image</p>
          <p className="text-xs text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden bg-gray-50">
      <div className="h-full flex items-center justify-center p-4">
        <div className="max-w-full max-h-full overflow-hidden rounded-lg shadow-lg bg-white">
          <img
            src={imageUrl}
            alt={fileName}
            onLoad={handleImageLoad}
            className="max-w-full max-h-full object-contain"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          />
        </div>
      </div>
      
      {/* Image info footer */}
      {imageSize && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
          {imageSize.width} × {imageSize.height} pixels
        </div>
      )}
    </div>
  );
};

export default ImageViewer;
