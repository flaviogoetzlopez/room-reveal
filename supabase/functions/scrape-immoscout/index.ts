import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      throw new Error("URL is required");
    }

    const APIFY_CLIENT_KEY = Deno.env.get("APIFY_CLIENT_KEY");
    if (!APIFY_CLIENT_KEY) {
      throw new Error("APIFY_CLIENT_KEY not configured");
    }

    console.log("Starting Apify scrape for URL:", url);

    // Start the Actor run
    const runResponse = await fetch(
      "https://api.apify.com/v2/acts/nMiNd0glV6oqKv78Y/runs?waitForFinish=300",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${APIFY_CLIENT_KEY}`,
        },
        body: JSON.stringify({
          startUrls: [{ url }],
        }),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error("Apify run failed:", errorText);
      throw new Error(`Apify run failed: ${runResponse.status}`);
    }

    const runData = await runResponse.json();
    const datasetId = runData.data?.defaultDatasetId;

    if (!datasetId) {
      throw new Error("No dataset ID returned from Apify");
    }

    console.log("Apify run completed, fetching dataset:", datasetId);

    // Fetch results from the dataset
    const datasetResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items`,
      {
        headers: {
          "Authorization": `Bearer ${APIFY_CLIENT_KEY}`,
        },
      }
    );

    if (!datasetResponse.ok) {
      throw new Error(`Failed to fetch dataset: ${datasetResponse.status}`);
    }

    const items = await datasetResponse.json();
    const item = items[0];

    if (!item) {
      throw new Error("No data returned from scraper");
    }

    // Extract pictures from media
    const media = item?.media || [];
    const pictures = media.filter((m: any) => m.type === "PICTURE");

    console.log(`Found ${pictures.length} pictures`);

    // Extract relevant property data
    const propertyData = {
      title: item.title || "Untitled Property",
      address: item.address?.formattedAddress || item.address?.description || null,
      pictures: pictures.map((p: any) => ({
        url: p.url || p.uri,
        title: p.title || null,
      })),
    };

    return new Response(
      JSON.stringify({ success: true, data: propertyData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
