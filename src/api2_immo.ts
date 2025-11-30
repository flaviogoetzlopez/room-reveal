import { supabase } from "@/integrations/supabase/client";

export interface ScrapedPropertyData {
    title: string;
    address: string;
    pictures: {
        url: string;
        title: string | null;
    }[];
}

export async function scrapeImmoscout(
    url: string
): Promise<ScrapedPropertyData> {
    const { data, error } = await supabase.functions.invoke("scrape-immoscout", {
        body: {
            url
        },
    });
    console.log("this is the data", data);
    console.log("this is the error", error);
    if (error) {
        console.error("Error invoking function:", error);
        throw new Error(error.message || "Failed to scrape property");
    }

    if (!data?.success) {
        throw new Error(data?.error || "Failed to scrape property");
    }

    return data.data;
}
