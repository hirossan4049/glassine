import type { Env } from '../../src/types';

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const eventId = url.pathname.replace('/og/', '').replace('.png', '');
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response('Token required', { status: 401 });
  }

  try {
    // Get event details
    const eventResult = await context.env.DB.prepare(
      'SELECT title, description FROM events WHERE id = ? AND (view_token = ? OR edit_token = ?)'
    ).bind(eventId, token, token).first<any>();

    if (!eventResult) {
      return new Response('Event not found', { status: 404 });
    }

    // Generate simple SVG OG image
    const svg = `
      <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="630" fill="#007bff"/>
        <text x="600" y="250" font-family="Arial, sans-serif" font-size="60" fill="white" text-anchor="middle" font-weight="bold">
          Glassine
        </text>
        <text x="600" y="350" font-family="Arial, sans-serif" font-size="40" fill="white" text-anchor="middle">
          ${eventResult.title.replace(/[<>&"']/g, '')}
        </text>
        <text x="600" y="450" font-family="Arial, sans-serif" font-size="30" fill="white" text-anchor="middle">
          日程調整ツール
        </text>
      </svg>
    `;

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (_error) {
    return new Response('Error generating OG image', { status: 500 });
  }
};
