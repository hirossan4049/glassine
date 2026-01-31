import type { Env } from '../src/types';

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const response = await context.next();

  // Only process HTML responses
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  try {
    let html = await response.text();

    // Extract event ID and token from URL
    let eventId = '';
    let token = '';

    if (url.pathname.startsWith('/e/')) {
      eventId = url.pathname.replace('/e/', '');
      token = url.searchParams.get('token') || '';
    } else if (url.pathname.startsWith('/v/')) {
      eventId = url.pathname.replace('/v/', '');
      token = url.searchParams.get('token') || '';
    } else if (url.pathname.startsWith('/r/')) {
      eventId = url.pathname.replace('/r/', '');
      token = url.searchParams.get('token') || '';
    }

    let title = 'Glassine - 日程調整ツール';
    let description = 'ログイン不要の日程調整ツール';
    let ogImage = `${url.origin}/og-default.png`;

    if (eventId && token) {
      try {
        const eventResult = await context.env.DB.prepare(
          'SELECT title, description FROM events WHERE id = ? AND (view_token = ? OR edit_token = ?)'
        ).bind(eventId, token, token).first<any>();

        if (eventResult) {
          title = `${eventResult.title} - Glassine`;
          description = eventResult.description || '日程調整イベント';
          ogImage = `${url.origin}/og/${eventId}.png?token=${token}`;
        }
      } catch (error) {
        console.error('Failed to fetch event for OGP', error);
      }
    }

    // Generate cache-busting parameter for SNS
    const cacheBuster = Date.now();

    const ogpTags = `
    <meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
    <meta property="og:image" content="${ogImage}?v=${cacheBuster}" />
    <meta property="og:url" content="${url.href}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />
    <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />
    <meta name="twitter:image" content="${ogImage}?v=${cacheBuster}" />
    <title>${title.replace(/</g, '&lt;')}</title>
    <meta name="description" content="${description.replace(/"/g, '&quot;')}" />
  `;

    // Insert OGP tags into head
    html = html.replace('</head>', `${ogpTags}</head>`);

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error('Middleware error:', error);
    return response;
  }
};
