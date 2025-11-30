import { supabase } from "@/integrations/supabase/client";

export async function createNewImageFromPrompt(
    prompt: string,
    currentImageUrl: string,
    roomId: string
): Promise<string> {
    const { data, error } = await supabase.functions.invoke("edit-room-image", {
        body: {
            roomId,
            userMessage: prompt,
            currentImageUrl,
        },
    });

    if (error) {
        console.error("Error invoking function:", error);
        throw new Error(error.message || "Failed to generate image");
    }

    if (!data?.success) {
        throw new Error(data?.error || "Failed to generate image");
    }

    return data.newImageUrl;
}
