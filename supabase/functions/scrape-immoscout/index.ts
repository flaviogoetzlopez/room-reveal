import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ApifyClient } from "https://esm.sh/apify-client@2.9.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      throw new Error("URL is required");
    }

    console.log("Received request to scrape URL:", url);

    // Validate that it's an ImmoScout24 URL
    if (!url.includes('immobilienscout24.de')) {
      throw new Error("Only ImmoScout24 URLs are supported. Please use a URL from immobilienscout24.de");
    }

    // Retrieve the API key from environment variables
    const APIFY_CLIENT_KEY = Deno.env.get("APIFY_CLIENT_KEY");
    if (!APIFY_CLIENT_KEY) {
      console.error("APIFY_CLIENT_KEY is missing in environment variables");
      throw new Error("Server configuration error: APIFY_CLIENT_KEY not found");
    }

    // Initialize the ApifyClient with API token
    // This matches the user's provided snippet
    const client = new ApifyClient({
      token: APIFY_CLIENT_KEY,
    });

    // Clean the URL to ensure we have a valid startUrl
    // We try to extract the expose ID if possible, otherwise use the URL as is
    let targetUrl = url;
    const exposeMatch = url.match(/\/expose\/(\d+)/);
    if (exposeMatch) {
      targetUrl = `https://www.immobilienscout24.de/expose/${exposeMatch[1]}`;
    }

    console.log("Using target URL for Apify:", targetUrl);

    // Prepare Actor input
    const input = {
      "startUrls": [
        targetUrl
      ]
    };

    console.log("Calling Apify Actor nMiNd0glV6oqKv78Y...");

    // Run the Actor and wait for it to finish
    const run = await client.actor("nMiNd0glV6oqKv78Y").call(input);

    console.log("Apify run finished. Dataset ID:", run.defaultDatasetId);

    // Fetch and print Actor results from the run's dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`Fetched ${items.length} items from dataset`);

    if (items.length === 0) {
      throw new Error("No data returned from the scraper. The property might be unavailable.");
    }

    const item = items[0] as any;

    console.log("Parsing scraped data structure...");

    // Extract title from TITLE section
    let title = "Untitled Property";
    const sections = item.sections || [];
    const titleSection = sections.find((s: any) => s.type === "TITLE");
    if (titleSection?.title) {
      title = titleSection.title;
    }

    // Extract address from MAP section
    let address = "Address not available";
    const mapSection = sections.find((s: any) => s.type === "MAP");
    if (mapSection) {
      const addressLine1 = mapSection.addressLine1 || "";
      const addressLine2 = mapSection.addressLine2 || "";
      address = [addressLine1, addressLine2].filter(Boolean).join(", ");
    }

    // Extract pictures from MEDIA section
    let pictures: any[] = [];
    const mediaSection = sections.find((s: any) => s.type === "MEDIA");
    if (mediaSection?.media && Array.isArray(mediaSection.media)) {
      pictures = mediaSection.media
        .filter((m: any) => m.type === "PICTURE")
        .map((p: any) => ({
          url: p.fullImageUrl || p.previewImageUrl || p.imageUrlForWeb,
          title: p.caption || null,
        }))
        .filter((p: any) => p.url);
    }

    console.log(`Extracted: title="${title}", address="${address}", ${pictures.length} pictures`);

    const propertyData = {
      title,
      address,
      pictures,
    };

    console.log("Successfully processed property data");

    return new Response(JSON.stringify({ success: true, data: propertyData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in scrape-immoscout function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

