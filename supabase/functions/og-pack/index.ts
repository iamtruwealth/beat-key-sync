import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function absoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  try {
    // If already absolute, return as-is
    const u = new URL(url);
    return u.toString();
  } catch {
    // Assume it's a path, prefix with primary domain
    return `https://beatpackz.store${url.startsWith("/") ? "" : "/"}${url}`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const packId = searchParams.get("id") || searchParams.get("pack_id");
    if (!packId) {
      return new Response("Missing id", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Fetch beat pack
    const { data: pack, error: packError } = await supabase
      .from("beat_packs")
      .select("id, name, description, artwork_url, is_public, user_id")
      .eq("id", packId)
      .maybeSingle();

    if (packError || !pack || pack.is_public === false) {
      return new Response("Pack not found", { status: 404, headers: corsHeaders });
    }

    // Fetch producer profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("producer_name")
      .eq("id", pack.user_id)
      .maybeSingle();

    const producerName = profile?.producer_name || "Unknown Producer";
    const title = `Beat pack ${pack.name} from ${producerName}`;
    const description = pack.description || `Discover premium beats in ${pack.name} by ${producerName}.`;

    const imageAbs = absoluteUrl(pack.artwork_url) || absoluteUrl("/assets/beat-packz-social-image.png")!;
    const targetUrl = `https://beatpackz.store/pack/${pack.id}`;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />

  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageAbs}" />
  <meta property="og:url" content="${targetUrl}" />
  <meta property="og:site_name" content="Beat Packz" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageAbs}" />

  <link rel="canonical" href="${targetUrl}" />
  <meta http-equiv="refresh" content="0; url=${targetUrl}" />
  <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;padding:24px;line-height:1.5}</style>
</head>
<body>
  <p>Redirecting to <a href="${targetUrl}">${title}</a>...</p>
  <script>location.replace(${JSON.stringify(targetUrl)})</script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`Error: ${message}`, { status: 500, headers: corsHeaders });
  }
});