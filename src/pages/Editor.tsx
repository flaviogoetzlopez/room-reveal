import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import ImageViewer from "@/components/ImageViewer";
import ChatInterface from "@/components/ChatInterface";

interface Room {
  id: string;
  room_name: string;
  original_image_url: string;
  current_image_url: string;
  room_order: number;
}

interface Posting {
  id: string;
  title: string;
  address: string | null;
}

const Editor = () => {
  const { postingId } = useParams();
  const navigate = useNavigate();
  const [posting, setPosting] = useState<Posting | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [postingId]);

  const fetchData = async () => {
    try {
      // Fetch posting
      const { data: postingData, error: postingError } = await supabase
        .from("postings")
        .select("id, title, address")
        .eq("id", postingId)
        .single();

      if (postingError) throw postingError;
      setPosting(postingData);

      // Fetch rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from("rooms")
        .select("*")
        .eq("posting_id", postingId)
        .order("room_order", { ascending: true });

      if (roomsError) throw roomsError;
      setRooms(roomsData || []);
    } catch (error: any) {
      toast.error("Failed to load data");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const currentRoom = rooms[currentRoomIndex];

  const handlePrevious = () => {
    setCurrentRoomIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentRoomIndex((prev) => Math.min(rooms.length - 1, prev + 1));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">{posting?.title}</h1>
              {posting?.address && (
                <p className="text-sm text-muted-foreground">{posting.address}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {rooms.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">No rooms found for this property</p>
            </div>
          </div>
        ) : (
          <>
            {/* Left Panel - Image Viewer */}
            <div className="flex-1 flex flex-col border-r border-border/50">
              <div className="flex items-center justify-between border-b border-border/50 bg-card/30 px-4 py-3">
                <h2 className="font-semibold text-foreground">
                  {currentRoom?.room_name}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={currentRoomIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    {currentRoomIndex + 1} / {rooms.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    disabled={currentRoomIndex === rooms.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <ImageViewer room={currentRoom} />
            </div>

            {/* Right Panel - Chat Interface */}
            <div className="w-96 flex flex-col bg-card/30">
              <ChatInterface 
                roomId={currentRoom?.id} 
                currentImageUrl={currentRoom?.current_image_url}
                onImageUpdated={fetchData}
              />
            </div>
          </>
        )}
      </main>

    </div>
  );
};

export default Editor;
