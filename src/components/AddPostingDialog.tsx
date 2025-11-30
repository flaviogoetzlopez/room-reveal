import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Home } from "lucide-react";

interface AddPostingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostingAdded: () => void;
}

const AddPostingDialog = ({ open, onOpenChange, onPostingAdded }: AddPostingDialogProps) => {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("postings").insert({
        user_id: user.id,
        immoscout_url: url,
        title: title || "Untitled Property",
        address: address || null,
        thumbnail_url: null,
      });

      if (error) throw error;

      toast.success("Property added successfully!");
      resetForm();
      onOpenChange(false);
      onPostingAdded();
    } catch (error: any) {
      toast.error(error.message || "Failed to add property");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setUrl("");
    setTitle("");
    setAddress("");
  };

  const handlePredefinedProperty = async (propertyIndex: 1 | 2) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create the posting first
      const propertyTitle = `Predefined Property ${propertyIndex}`;
      const { data: postingData, error: postingError } = await supabase
        .from("postings")
        .insert({
          user_id: user.id,
          immoscout_url: `https://example.com/predefined-${propertyIndex}`,
          title: propertyTitle,
          address: "Sample Address",
          thumbnail_url: null,
        })
        .select()
        .single();

      if (postingError) throw postingError;

      // Load images
      const images = propertyIndex === 1
        ? import.meta.glob('/src/components/images/property1/*.png', { eager: true, as: 'url' })
        : import.meta.glob('/src/components/images/property2/*.png', { eager: true, as: 'url' });

      const imagePaths = Object.values(images);

      let firstImagePublicUrl = null;

      // Upload images and create rooms
      for (let i = 0; i < imagePaths.length; i++) {
        const imagePath = imagePaths[i];
        const response = await fetch(imagePath);
        const blob = await response.blob();
        const fileExt = "png";
        const fileName = `${user.id}/${postingData.id}/predefined-${Date.now()}-${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("room-images")
          .upload(fileName, blob);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("room-images")
          .getPublicUrl(fileName);

        if (i === 0) firstImagePublicUrl = publicUrl;

        await supabase.from("rooms").insert({
          posting_id: postingData.id,
          room_name: `Room ${i + 1}`,
          original_image_url: publicUrl,
          current_image_url: publicUrl,
          room_order: i,
        });
      }

      // Update posting with thumbnail if we have images
      if (firstImagePublicUrl) {
        await supabase
          .from("postings")
          .update({ thumbnail_url: firstImagePublicUrl })
          .eq("id", postingData.id);
      }

      toast.success(`${propertyTitle} created successfully!`);
      resetForm();
      onOpenChange(false);
      onPostingAdded();

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to create predefined property");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Property</DialogTitle>
          <DialogDescription>
            Choose a predefined property or enter details manually
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Button
            variant="outline"
            className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5"
            onClick={() => handlePredefinedProperty(1)}
            disabled={loading}
          >
            <Home className="h-8 w-8 text-primary" />
            <span>Predefined Property 1</span>
          </Button>
          <Button
            variant="outline"
            className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5"
            onClick={() => handlePredefinedProperty(2)}
            disabled={loading}
          >
            <Home className="h-8 w-8 text-primary" />
            <span>Predefined Property 2</span>
          </Button>
        </div>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or add manually
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">ImmoScout URL *</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.immobilienscout24.de/..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Property Title *</Label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Modern apartment in Berlin"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address (optional)</Label>
            <Input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Berliner Str. 123, 10115 Berlin"
            />
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
                  Adding...
                </>
              ) : (
                "Add Property"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddPostingDialog;
