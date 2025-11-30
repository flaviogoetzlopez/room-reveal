import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ApifyClient } from "npm:apify-client";

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

    const item = items[0];

    // Log the raw item for debugging purposes (optional, can be removed in prod)
    // console.dir(item);

    // Map the Apify result to our expected format
    // We try to be flexible with the fields as scraping results can vary
    let pictures: any[] = [];
    if (Array.isArray(item.media)) {
      pictures = item.media.filter((m: any) => m.type === "PICTURE" || m["@type"] === "PICTURE");
    } else if (Array.isArray(item.pictures)) {
      pictures = item.pictures;
    } else if (Array.isArray(item.images)) {
      pictures = item.images;
    }

    const propertyData = {
      title: item.title || item.name || "Untitled Property",
      address: item.address?.formattedAddress || item.address?.description || item.location || "Address not available",
      description: item.description || item.descriptionNote || "",
      price: item.price || item.purchasePrice || item.baseRent || null,
      livingSpace: item.livingSpace || item.livingArea || null,
      roomCount: item.numberOfRooms || item.roomCount || null,
      pictures: pictures.map((p: any) => ({
        url: p.url || p.uri || p.src || p.imageUrl,
        title: p.title || p.alt || null,
      })).filter((p: any) => p.url),
      raw: item // Include raw data just in case
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

