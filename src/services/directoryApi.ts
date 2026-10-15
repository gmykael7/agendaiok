import { directoryText, publicDirectoryEntry } from '../utils/directory';

type DirectoryDatabase = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
    };
  };
};

// Only constant column expressions are interpolated. All user input is bound.
const searchable = (column: string) => {
  let sql = `coalesce(${column}, '')`;
  for (const [letters, plain] of [['áàâãäÁÀÂÃÄ', 'a'], ['éèêëÉÈÊË', 'e'], ['íìîïÍÌÎÏ', 'i'], ['óòôõöÓÒÔÕÖ', 'o'], ['úùûüÚÙÛÜ', 'u'], ['çÇ', 'c']]) {
    for (const letter of letters) sql = `replace(${sql}, '${letter}', '${plain}')`;
  }
  return `lower(${sql})`;
};

const DIRECTORY_SQL_BASE = `WITH records AS (
  SELECT CASE WHEN json_valid(value) THEN value ELSE '{}' END AS doc
  FROM app_store WHERE key >= 'user:' AND key < 'user;'
    AND (expires_at IS NULL OR expires_at > ?1)
), shops AS (
  SELECT json_extract(doc, '$.org.name') AS name,
    json_extract(doc, '$.org.slug') AS slug,
    json_extract(doc, '$.org.city') AS city,
    json_extract(doc, '$.org.state') AS state,
    json_extract(doc, '$.org.neighborhood') AS neighborhood,
    json_extract(doc, '$.org.address') AS address,
    json_extract(doc, '$.org.logo_image_url') AS logo,
    json_extract(doc, '$.org.directory_latitude') AS latitude,
    json_extract(doc, '$.org.directory_longitude') AS longitude
  FROM records
  WHERE json_type(doc, '$.org.directory_visible') = 'true'
    AND coalesce(json_extract(doc, '$.org.account_status'), 'active') IN ('active', 'trial')
)
SELECT name, slug, city, state, neighborhood, address, logo, latitude, longitude FROM shops
WHERE typeof(name) = 'text' AND trim(name) != ''
  AND typeof(city) = 'text' AND trim(city) != ''
  AND typeof(slug) = 'text' AND slug != '' AND slug NOT GLOB '*[^a-z0-9-]*'
  AND state IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
  AND (?2 = '' OR instr(${searchable('name')}, ?2) > 0)
  AND (?3 = '' OR instr(${searchable('city')}, ?3) > 0)
  AND (?4 = '' OR state = ?4)
  AND (?5 = '' OR instr(${searchable('neighborhood')}, ?5) > 0)
ORDER BY name COLLATE NOCASE, slug`;

export const DIRECTORY_SQL = `${DIRECTORY_SQL_BASE} LIMIT 25 OFFSET ?6`;
const DIRECTORY_GEO_SQL = `${DIRECTORY_SQL_BASE} LIMIT 250`;

const withinRange = (row: Record<string, unknown>, latitude: number, longitude: number) => {
  const shopLatitude = Number(row.latitude);
  const shopLongitude = Number(row.longitude);
  if (!Number.isFinite(shopLatitude) || !Number.isFinite(shopLongitude) || Math.abs(shopLatitude) > 90 || Math.abs(shopLongitude) > 180) return null;
  const radians = Math.PI / 180;
  const latDelta = (shopLatitude - latitude) * radians;
  const lonDelta = (shopLongitude - longitude) * radians;
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(latitude * radians) * Math.cos(shopLatitude * radians) * Math.sin(lonDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export async function handleDirectory(request: Request, db: DirectoryDatabase | undefined): Promise<Response> {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'GET') return respond({ error: 'Método não permitido.' }, 405);
  const params = new URL(request.url).searchParams;
  const page = Number(params.get('page') || 1);
  const latitudeValue = params.get('latitude');
  const longitudeValue = params.get('longitude');
  const usingLocation = latitudeValue !== null || longitudeValue !== null;
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isInteger(page) || page < 1 || page > 10000 || ['q', 'city', 'state', 'neighborhood'].some(key => (params.get(key) || '').length > 120)) return respond({ error: 'Filtros inválidos.' }, 400);
  if (usingLocation && (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)) return respond({ error: 'Localização inválida.' }, 400);
  if (!db) return respond({ error: 'Diretório indisponível.' }, 503);
  try {
    const statement = db.prepare(usingLocation ? DIRECTORY_GEO_SQL : DIRECTORY_SQL);
    const bindings = [Math.floor(Date.now() / 1000), directoryText(params.get('q') || ''), directoryText(params.get('city') || ''), (params.get('state') || '').toUpperCase(), directoryText(params.get('neighborhood') || '')];
    const bound = usingLocation ? statement.bind(...bindings) : statement.bind(...bindings, (page - 1) * 24);
    const result = await bound.all<Record<string, unknown>>();
    const rows = usingLocation
      ? (result.results || []).map((row) => ({ row, distance: withinRange(row, latitude, longitude) })).filter((entry): entry is { row: Record<string, unknown>; distance: number } => entry.distance !== null && entry.distance <= 50).sort((a, b) => a.distance - b.distance).map((entry) => entry.row).slice((page - 1) * 24, page * 24 + 1)
      : result.results || [];
    return respond({ items: rows.slice(0, 24).map(publicDirectoryEntry).filter(Boolean), hasMore: rows.length > 24, page });
  } catch {
    console.error(JSON.stringify({ event: 'directory_query_failed' }));
    return respond({ error: 'Não foi possível carregar as barbearias. Tente novamente.' }, 503);
  }
}

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

export async function handleSitemap(db: DirectoryDatabase | undefined): Promise<Response> {
  const staticUrls = ['/', '/barbearias', '/privacidade', '/termos'];
  let tenantUrls: string[] = [];
  if (db) {
    try {
      const result = await db.prepare(`SELECT json_extract(value, '$.org.slug') AS slug
        FROM app_store
        WHERE key >= 'user:' AND key < 'user;'
          AND (expires_at IS NULL OR expires_at > ?)
          AND json_valid(value)
          AND json_type(value, '$.org.directory_visible') = 'true'
          AND coalesce(json_extract(value, '$.org.account_status'), 'active') IN ('active', 'trial')
          AND json_extract(value, '$.org.slug') NOT GLOB '*[^a-z0-9-]*'
        ORDER BY slug`).bind(Math.floor(Date.now() / 1000)).all<{ slug?: string }>();
      tenantUrls = (result.results || [])
        .map((row) => String(row.slug || ''))
        .filter((slug) => /^[a-z0-9-]+$/.test(slug))
        .map((slug) => `/agendar/${slug}`);
    } catch {
      console.error(JSON.stringify({ event: 'sitemap_query_failed' }));
    }
  }
  const urls = [...staticUrls, ...tenantUrls];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((path) => `  <url><loc>${escapeXml(`https://meuagendai.fun${path}`)}</loc></url>`).join('\n')}\n</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=UTF-8', 'Cache-Control': 'public, max-age=3600' } });
}
