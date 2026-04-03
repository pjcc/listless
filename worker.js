export default {
  async fetch(request) {
    const url = new URL(request.url).searchParams.get('url');
    if (!url) return Response.json({ error: 'Missing url param' }, { status: 400 });

    /* Restrict to your own domains - update these before deploying */
    const origin = request.headers.get('Origin') || '';
    const allowed = ['localhost'];
    if (origin && !allowed.some(h => origin.includes(h))) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    /* Block SSRF: only allow http(s) to public hosts */
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) {
        return Response.json({ error: 'Invalid protocol' }, { status: 400 });
      }
      const host = parsed.hostname;
      if (host === 'localhost' || host.startsWith('127.') || host.startsWith('10.') ||
          host.startsWith('192.168.') || host.startsWith('172.') || host === '0.0.0.0' ||
          host.endsWith('.local') || host.endsWith('.internal') || host === '[::1]') {
        return Response.json({ error: 'Private addresses not allowed' }, { status: 400 });
      }
    } catch {
      return Response.json({ error: 'Invalid URL' }, { status: 400 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Accept-Encoding': 'gzip',
          'Cache-Control': 'no-cache',
        },
        redirect: 'follow',
      });
      const html = await res.text();

      /* --- OG tags (both attribute orders) --- */
      const og = {};
      const r1 = /<meta\s+(?:property|name)=["'](og:[^"']+)["']\s+content=["']([^"']*)["']/gi;
      const r2 = /<meta\s+content=["']([^"']*)["']\s+(?:property|name)=["'](og:[^"']+)["']/gi;
      let m;
      while ((m = r1.exec(html)) !== null) og[m[1]] = m[2];
      while ((m = r2.exec(html)) !== null) if (!og[m[2]]) og[m[2]] = m[1];

      /* --- Twitter card tags --- */
      const tw = {};
      const t1 = /<meta\s+(?:property|name)=["'](twitter:[^"']+)["']\s+content=["']([^"']*)["']/gi;
      const t2 = /<meta\s+content=["']([^"']*)["']\s+(?:property|name)=["'](twitter:[^"']+)["']/gi;
      while ((m = t1.exec(html)) !== null) tw[m[1]] = m[2];
      while ((m = t2.exec(html)) !== null) if (!tw[m[2]]) tw[m[2]] = m[1];

      /* --- JSON-LD structured data --- */
      let ld = {};
      const ldRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      while ((m = ldRegex.exec(html)) !== null) {
        try {
          let data = JSON.parse(m[1]);
          /* Handle @graph arrays */
          if (data['@graph']) data = data['@graph'];
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            const type = (item['@type'] || '').toLowerCase();
            if (type === 'product' || type === 'movie' || type === 'book' ||
                type === 'recipe' || type === 'article' || type === 'newsarticle') {
              ld = item;
              break;
            }
          }
          /* If no specific type matched, use first item with a name */
          if (!ld.name && items.length) {
            const named = items.find(i => i.name);
            if (named) ld = named;
          }
        } catch { /* invalid JSON-LD, skip */ }
      }

      /* --- Fallback: <title> tag --- */
      let titleTag = null;
      const tm = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (tm) titleTag = tm[1].trim();

      /* --- Fallback: meta description --- */
      let metaDesc = null;
      const dm = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
        || html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
      if (dm) metaDesc = dm[1].trim();

      /* --- Resolve image from JSON-LD --- */
      let ldImage = null;
      if (ld.image) {
        if (typeof ld.image === 'string') ldImage = ld.image;
        else if (Array.isArray(ld.image)) ldImage = typeof ld.image[0] === 'string' ? ld.image[0] : ld.image[0]?.url;
        else if (ld.image.url) ldImage = ld.image.url;
      }

      /* --- Build result with priority chain --- */
      const title = og['og:title'] || tw['twitter:title'] || ld.name || titleTag || null;
      const description = og['og:description'] || tw['twitter:description'] || ld.description || metaDesc || null;
      const image = og['og:image'] || tw['twitter:image'] || ldImage || null;
      const site_name = og['og:site_name'] || null;
      const price = ld.offers?.price || ld.offers?.lowPrice || null;
      const currency = ld.offers?.priceCurrency || null;

      return Response.json({
        title,
        description,
        image,
        site_name,
        price: price ? `${currency || ''}${price}` : null,
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch (e) {
      return Response.json({ error: e.message }, {
        status: 502,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
