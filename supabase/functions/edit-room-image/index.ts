// supabase/functions/room-edit/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BFL_API_KEY = Deno.env.get("VITE_BFL_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!BFL_API_KEY) {
      throw new Error("BFL_API_KEY not configured");
    }

    const { roomId, userMessage, currentImageUrl } = await req.json();

    if (!roomId || !userMessage || !currentImageUrl) {
      throw new Error("Missing roomId, userMessage or currentImageUrl");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth: User aus JWT holen
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Letzte Edit-Order holen, um Reihenfolge zu bestimmen
    const { data: edits, error: editsError } = await supabase
      .from("room_edits")
      .select("edit_order")
      .eq("room_id", roomId)
      .order("edit_order", { ascending: false })
      .limit(1);

    if (editsError) {
      throw editsError;
    }

    const nextOrder = edits && edits.length > 0 ? edits[0].edit_order + 1 : 0;

    // User-Nachricht speichern
    const { error: insertUserEditError } = await supabase.from("room_edits").insert({
      room_id: roomId,
      edit_type: "user",
      description: userMessage,
      image_url: currentImageUrl,
      edit_order: nextOrder,
    });

    if (insertUserEditError) {
      throw insertUserEditError;
    }

    // BFL Flux-API aufrufen, um Bild zu generieren
    const editedImageData = await createNewImageFromPrompt(
      userMessage,
      currentImageUrl,
      BFL_API_KEY,
    );

    // editedImageData = data.result.sample (entweder data URL oder reines Base64)
    let base64Data = editedImageData;
    if (editedImageData.includes(",")) {
      // data:image/jpeg;base64,XXX -> nur den Base64-Teil nehmen
      base64Data = editedImageData.split(",")[1];
    }

    const imageBuffer = Uint8Array.from(
      atob(base64Data),
      (c) => c.charCodeAt(0),
    );

    const fileName = `${user.id}/${roomId}/${Date.now()}-edited.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("room-images")
      .upload(fileName, imageBuffer, {
        contentType: "image/jpeg",
      });

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("room-images").getPublicUrl(fileName);

    // Assistant-Edit mit neuer URL speichern
    const { error: insertAssistantEditError } = await supabase.from("room_edits").insert({
      room_id: roomId,
      edit_type: "assistant",
      description: "Image edited successfully",
      image_url: publicUrl,
      edit_order: nextOrder + 1,
    });

    if (insertAssistantEditError) {
      throw insertAssistantEditError;
    }

    // Raum mit neuer aktuellen URL updaten
    const { error: updateRoomError } = await supabase
      .from("rooms")
      .update({ current_image_url: publicUrl })
      .eq("id", roomId);

    if (updateRoomError) {
      throw updateRoomError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        newImageUrl: publicUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message ?? String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function createNewImageFromPrompt(
  prompt: string,
  input: string,
  apiKey: string,
): Promise<string> {
  const input_image = input;

  const response = await fetch("https://api.bfl.ai/v1/flux-2-pro", {
    method: "POST",
    headers: {
      "x-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: prompt,
      input_image: input_image,
      seed: 42,
      output_format: "jpeg",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to initiate image generation: ${error}`);
  }

  const data = await response.json();
  console.log("BFL Request ID:", data.id);

  return await pollForResult(data.id, apiKey);
}

async function pollForResult(id: string, apiKey: string): Promise<string> {
  const maxAttempts = 60;
  const interval = 2000; // 2 Sekunden

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, interval));

    const response = await fetch(`https://api.bfl.ai/v1/get_result?id=${id}`, {
      method: "GET",
      headers: {
        "x-key": apiKey,
      },
    });

    if (!response.ok) {
      // z.B. 5xx -> einfach weiter probieren
      continue;
    }

    const data = await response.json();

    if (data.status === "Ready") {
      // Annahme: data.result.sample enthält Base64 oder Data-URL
      return data.result.sample as string;
    } else if (data.status === "Failed") {
      throw new Error("Image generation failed");
    }
  }

  throw new Error("Image generation timed out");
}
