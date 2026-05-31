import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bertos-ai-os.vercel.app';
  const now = new Date();

  return [
    '',
    '/chat',
    '/hermes',
    '/workspace',
    '/evolution',
    '/agents',
    '/skills',
    '/plugins',
    '/outputs',
    '/runs',
    '/studio',
    '/publishing-queue',
    '/memory-review',
    '/launch',
    '/settings',
  ].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
