import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { createNewImageFromPrompt } from "@/api2_flux";

interface Message {
  id: string;
  edit_type: string;
  description: string;
  created_at: string;
  image_url: string;
}

interface ChatInterfaceProps {
  roomId: string | undefined;
  currentImageUrl: string | undefined;
  onImageUpdated: () => void;
}

const ChatInterface = ({ roomId, currentImageUrl, onImageUpdated }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (!roomId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    fetchMessages();

    // Set up realtime subscription
    const channel = supabase
      .channel(`edits-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_edits",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const fetchMessages = async () => {
    if (!roomId) return;

    try {
      const { data, error } = await supabase
        .from("room_edits")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      toast.error("Failed to load chat history");
    } finally {
      setLoading(false);
    }
  };



  // ... (existing imports)

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !roomId || !currentImageUrl || sending) return;

    setSending(true);
    const messageText = inputValue;
    setInputValue("");

    try {
      // Call the Flux API via Supabase Edge Function
      // The function handles DB inserts for both user message and assistant response
      await createNewImageFromPrompt(messageText, currentImageUrl, roomId);

      // Refresh messages to show the new ones
      await fetchMessages();

      onImageUpdated();
    } catch (error: any) {
      toast.error(error.message || "Failed to edit image");
      setInputValue(messageText); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/50 px-4 py-3">
        <h3 className="font-semibold text-foreground">Room Chat</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Describe how you want to change this room
        </p>
      </div>

      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No messages yet. Start a conversation!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`p-3 rounded-md ${message.edit_type === "user"
                  ? "bg-primary/10 border border-primary/20 ml-8"
                  : "bg-secondary/50 border border-border/50 mr-8"
                  }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-semibold text-primary uppercase">
                    {message.edit_type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-foreground">{message.description}</p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="border-t border-border/50 p-4">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Describe the changes you want..."
            disabled={sending || !roomId}
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !roomId || !inputValue.trim()}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
