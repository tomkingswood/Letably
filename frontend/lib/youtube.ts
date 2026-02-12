/**
 * Extract YouTube video ID from various URL formats
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 */
export function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Get YouTube embed URL from video URL or ID
 * Uses privacy-enhanced mode (youtube-nocookie.com) to reduce tracking
 */
export function getYouTubeEmbedUrl(urlOrId: string): string | null {
  const videoId = getYouTubeVideoId(urlOrId);
  if (!videoId) return null;

  // Use youtube-nocookie.com for privacy-enhanced mode
  // This reduces tracking and may reduce blocked requests from ad blockers
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

/**
 * Get YouTube thumbnail URL from video URL or ID
 */
export function getYouTubeThumbnail(urlOrId: string, quality: 'default' | 'hq' | 'mq' | 'sd' | 'maxres' = 'hq'): string | null {
  const videoId = getYouTubeVideoId(urlOrId);
  if (!videoId) return null;

  const qualityMap = {
    default: 'default.jpg',
    mq: 'mqdefault.jpg',
    hq: 'hqdefault.jpg',
    sd: 'sddefault.jpg',
    maxres: 'maxresdefault.jpg',
  };

  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}`;
}
