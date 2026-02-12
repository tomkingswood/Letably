import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (isDevMode) {
    // Dev/Test: Block all crawling
    return {
      rules: [
        {
          userAgent: '*',
          disallow: '/',
        },
      ],
    };
  }

  // Production: Allow crawling
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api'],
      },
    ],
    ...(siteUrl && { sitemap: `${siteUrl}/sitemap.xml` }),
  };
}
