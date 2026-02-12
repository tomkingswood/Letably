import DOMPurify from 'dompurify';

// Allowed HTML tags for agreement content
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3',
  'ul', 'ol', 'li', 'a', 'span', 'div'
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'style'];

/**
 * Basic server-side HTML sanitization
 * Strips all tags except allowed ones using regex
 * This is a fallback - DOMPurify on client is more thorough
 */
function serverSideSanitize(dirty: string): string {
  if (!dirty) return '';

  // Remove script tags and their content entirely
  let clean = dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers (onclick, onerror, etc.)
  clean = clean.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  clean = clean.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: URLs
  clean = clean.replace(/href\s*=\s*["']?\s*javascript:[^"'>\s]*/gi, 'href="#"');

  // Remove data: URLs (can contain scripts)
  clean = clean.replace(/src\s*=\s*["']?\s*data:[^"'>\s]*/gi, 'src=""');

  // Build regex for allowed tags
  const allowedTagsPattern = ALLOWED_TAGS.join('|');

  // Remove disallowed tags but keep content
  // This regex finds tags not in the allowed list
  const tagRegex = new RegExp(`<(?!\/?(?:${allowedTagsPattern})\\b)[^>]*>`, 'gi');
  clean = clean.replace(tagRegex, '');

  return clean;
}

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param dirty - The HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';

  if (typeof window === 'undefined') {
    // Server-side: use basic sanitization as fallback
    // Full sanitization happens on client hydration
    return serverSideSanitize(dirty);
  }

  // Client-side: sanitize with DOMPurify (most secure)
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false,
  }) as string;
}
