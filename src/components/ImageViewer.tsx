import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ImageViewerProps {
  room: {
    id: string;
    room_name: string;
    original_image_url: string;
    current_image_url: string;
  } | undefined;
  selectedImageUrl?: string | null;
}

const ImageViewer = ({ room, selectedImageUrl }: ImageViewerProps) => {
  const [previousImageUrl, setPreviousImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!room) return;

    const fetchPreviousImage = async () => {
      const { data } = await supabase
        .from("room_edits")
        .select("image_url")
        .eq("room_id", room.id)
        .eq("edit_type", "assistant")
        .order("created_at", { ascending: false })
        .limit(2);

      if (data && data.length >= 2) {
        setPreviousImageUrl(data[1].image_url);
      } else {
        setPreviousImageUrl(room.original_image_url);
      }
    };

    fetchPreviousImage();
  }, [room]);

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">No room selected</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 bg-muted/30 gap-4">
      <div className="flex-1 grid grid-cols-2 gap-4">
        {/* Before Image */}
        <div className="flex flex-col">
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">
            BEFORE
          </div>
          <div className="flex-1 flex items-center justify-center bg-background/50 rounded-lg p-4">
            <img
              src={previousImageUrl || room.original_image_url}
              alt={`${room.room_name} - Before`}
              className="max-w-full max-h-full object-contain rounded-md shadow-card"
            />
          </div>
        </div>

        {/* After Image */}
        <div className="flex flex-col">
          <div className="text-xs font-semibold text-primary mb-2 px-2">
            AFTER
          </div>
          <div className="flex-1 flex items-center justify-center bg-background/50 rounded-lg p-4 relative">
            <img
              src={selectedImageUrl || room.current_image_url}
              alt={`${room.room_name} - After`}
              className="max-w-full max-h-full object-contain rounded-md shadow-card"
            />
            {selectedImageUrl && (
              <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground px-3 py-1 rounded-md text-xs font-semibold">
                Viewing History
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;
