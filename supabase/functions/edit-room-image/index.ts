import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roomId, userMessage, currentImageUrl } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user from request
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Store user message
    const { data: edits } = await supabase
      .from("room_edits")
      .select("edit_order")
      .eq("room_id", roomId)
      .order("edit_order", { ascending: false })
      .limit(1);
    
    const nextOrder = edits && edits.length > 0 ? edits[0].edit_order + 1 : 0;

    await supabase.from("room_edits").insert({
      room_id: roomId,
      edit_type: "user",
      description: userMessage,
      image_url: currentImageUrl,
      edit_order: nextOrder,
    });

    // Call Lovable AI to edit the image
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a room interior editor. The user wants to modify this room image. Edit the image based on this instruction: "${userMessage}". Make realistic changes to the room.`
              },
              {
                type: "image_url",
                image_url: {
                  url: currentImageUrl
                }
              }
            ]
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (response.status === 402) {
        throw new Error("Payment required. Please add credits to your workspace.");
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const editedImageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!editedImageBase64) {
      throw new Error("No image returned from AI");
    }

    // Upload edited image to storage
    const base64Data = editedImageBase64.split(",")[1];
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `${user.id}/${roomId}/${Date.now()}-edited.png`;
    const { error: uploadError } = await supabase.storage
      .from("room-images")
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("room-images")
      .getPublicUrl(fileName);

    // Store assistant message with new image
    await supabase.from("room_edits").insert({
      room_id: roomId,
      edit_type: "assistant",
      description: "Image edited successfully",
      image_url: publicUrl,
      edit_order: nextOrder + 1,
    });

    // Update room's current image
    await supabase
      .from("rooms")
      .update({ current_image_url: publicUrl })
      .eq("id", roomId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        newImageUrl: publicUrl 
      }),
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
