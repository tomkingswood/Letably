/**
 * Get the base URL for images
 * Server-side: use environment variable or infer from request
 * Client-side: use environment variable or auto-detect from browser
 */
export const getImageBaseUrl = (): string => {
  // Try environment variable first (works on both server and client)
  const publicUrl = process.env.NEXT_PUBLIC_API_URL;
  if (publicUrl) {
    return publicUrl.replace('/api', '');
  }

  // Server-side rendering - use internal URL or localhost
  if (typeof window === 'undefined') {
    const internalUrl = process.env.NEXT_PUBLIC_API_URL_INTERNAL;
    if (internalUrl) {
      return internalUrl.replace('/api', '');
    }
    // In production server-side, we don't know the domain, so return empty
    // This will be corrected on the client
    if (process.env.NODE_ENV === 'production') {
      return '';
    }
    return 'http://localhost:5000';
  }

  // Client-side rendering - auto-detect from browser location
  const { protocol, hostname } = window.location;

  // Development: localhost frontend connects to backend on port 5000
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }

  // Production: use the same domain as the frontend
  return `${protocol}//${hostname}`;
};

/**
 * Get the full image URL from a relative path or image object
 */
export const getImageUrl = (imagePath: string | { file_path: string } | any): string => {
  if (!imagePath) return '';

  // Handle object format (from images table)
  let pathString: string;
  if (typeof imagePath === 'object' && 'file_path' in imagePath) {
    pathString = imagePath.file_path;
  } else if (typeof imagePath === 'string') {
    pathString = imagePath;
  } else {
    return '';
  }

  // If it's already a full URL, return as-is
  if (pathString.startsWith('http://') || pathString.startsWith('https://')) {
    return pathString;
  }

  // Get base URL
  const baseUrl = getImageBaseUrl();

  // If no base URL (server-side in production), return just the path
  // The client will correct this when it hydrates
  if (!baseUrl) {
    return pathString.startsWith('/') ? pathString : `/${pathString}`;
  }

  // Prepend the base URL
  const path = pathString.startsWith('/') ? pathString : `/${pathString}`;
  const fullUrl = `${baseUrl}${path}`;

  return fullUrl;
};
