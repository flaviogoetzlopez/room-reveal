import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface Edit {
  id: string;
  edit_type: string;
  description: string;
  created_at: string;
}

interface EditHistoryProps {
  roomId: string | undefined;
}

const EditHistory = ({ roomId }: EditHistoryProps) => {
  const [edits, setEdits] = useState<Edit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setEdits([]);
      setLoading(false);
      return;
    }

    fetchEdits();

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
          fetchEdits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const fetchEdits = async () => {
    if (!roomId) return;

    try {
      const { data, error } = await supabase
        .from("room_edits")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setEdits(data || []);
    } catch (error: any) {
      toast.error("Failed to load edit history");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/50 px-4 py-3">
        <h3 className="font-semibold text-foreground">Edit History</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Track all changes to this room
        </p>
      </div>

      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : edits.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No edits yet. Start modifying the room!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {edits.map((edit) => (
              <div
                key={edit.id}
                className="p-3 rounded-md bg-secondary/50 border border-border/50"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-semibold text-primary uppercase">
                    {edit.edit_type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(edit.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-foreground">{edit.description}</p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default EditHistory;
