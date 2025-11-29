import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

interface AddRoomDialogProps {
  postingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoomAdded: () => void;
}

const AddRoomDialog = ({ postingId, open, onOpenChange, onRoomAdded }: AddRoomDialogProps) => {
  const [roomName, setRoomName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select an image");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload image to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${postingId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("room-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("room-images")
        .getPublicUrl(fileName);

      // Get current max order
      const { data: rooms } = await supabase
        .from("rooms")
        .select("room_order")
        .eq("posting_id", postingId)
        .order("room_order", { ascending: false })
        .limit(1);

      const nextOrder = rooms && rooms.length > 0 ? rooms[0].room_order + 1 : 0;

      // Create room entry
      const { error: insertError } = await supabase.from("rooms").insert({
        posting_id: postingId,
        room_name: roomName || "Unnamed Room",
        original_image_url: publicUrl,
        current_image_url: publicUrl,
        room_order: nextOrder,
      });

      if (insertError) throw insertError;

      toast.success("Room added successfully!");
      setRoomName("");
      setFile(null);
      onOpenChange(false);
      onRoomAdded();
    } catch (error: any) {
      toast.error(error.message || "Failed to add room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Room</DialogTitle>
          <DialogDescription>
            Upload a room image and give it a name
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roomName">Room Name</Label>
            <Input
              id="roomName"
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Living Room, Kitchen, etc."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image">Room Image *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                required
              />
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                Selected: {file.name}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Add Room"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddRoomDialog;
