import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      throw new Error("URL is required");
    }

    // @ts-ignore
    const APIFY_CLIENT_KEY = Deno.env.get("APIFY_CLIENT_KEY");
    if (!APIFY_CLIENT_KEY) {
      throw new Error("APIFY_CLIENT_KEY not configured");
    }

    // Start the Actor run with longer timeout
    const runResponse = await fetch("https://api.apify.com/v2/acts/nMiNd0glV6oqKv78Y/runs?waitForFinish=300", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${APIFY_CLIENT_KEY}`,
      },
      body: JSON.stringify({
        startUrls: [url],
      }),
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error("Apify run failed:", errorText);
      throw new Error(`Apify run failed: ${runResponse.status} - ${errorText}`);
    }

    const runData = await runResponse.json();
    console.log("Apify run response:", JSON.stringify(runData));

    const datasetId = runData.data?.defaultDatasetId;
    const runStatus = runData.data?.status;

    if (!datasetId) {
      throw new Error("No dataset ID returned from Apify");
    }

    console.log("Apify run status:", runStatus, "- fetching dataset:", datasetId);

    // Fetch results from the dataset
    const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items`, {
      headers: {
        Authorization: `Bearer ${APIFY_CLIENT_KEY}`,
      },
    });

    if (!datasetResponse.ok) {
      const errorText = await datasetResponse.text();
      console.error("Dataset fetch failed:", errorText);
      throw new Error(`Failed to fetch dataset: ${datasetResponse.status}`);
    }

    const items = await datasetResponse.json();
    console.log("Apify dataset items count:", items.length);

    if (items.length > 0) {
      console.log("First item keys:", Object.keys(items[0]));
    }

    const item = items[0];

    if (!item) {
      throw new Error("No data returned from scraper. The property might be unavailable or the URL format is incorrect.");
    }

    // Extract pictures from media - handle different possible structures
    let pictures: any[] = [];

    if (Array.isArray(item.media)) {
      pictures = item.media.filter((m: any) => m.type === "PICTURE" || m["@type"] === "PICTURE");
    } else if (item.pictures) {
      pictures = item.pictures;
    } else if (item.images) {
      pictures = item.images;
    }

    console.log(`Found ${pictures.length} pictures`);
    if (pictures.length > 0) {
      console.log("Sample picture structure:", JSON.stringify(pictures[0]));
    }

    // Extract relevant property data
    const propertyData = {
      title: item.title || item.name || "Untitled Property",
      address: item.address?.formattedAddress || item.address?.description || item.location || null,
      pictures: pictures.map((p: any) => ({
        url: p.url || p.uri || p.src || p.imageUrl,
        title: p.title || p.alt || null,
      })).filter((p: any) => p.url),
    };

    console.log("Extracted property data:", JSON.stringify(propertyData));

    return new Response(JSON.stringify({ success: true, data: propertyData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
