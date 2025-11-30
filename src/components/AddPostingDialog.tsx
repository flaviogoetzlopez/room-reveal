import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Home, Search } from "lucide-react";

interface AddPostingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostingAdded: () => void;
}

const AddPostingDialog = ({ open, onOpenChange, onPostingAdded }: AddPostingDialogProps) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  const handleScrapeAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoadingMessage("Scraping ImmoScout...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Call the scraper edge function
      const { data: scrapeResult, error: scrapeError } = await supabase.functions.invoke(
        "scrape-immoscout",
        { body: { url } }
      );

      if (scrapeError) throw scrapeError;
      if (scrapeResult.error) throw new Error(scrapeResult.error);

      const propertyData = scrapeResult.data;
      setLoadingMessage("Creating property...");

      // Create the posting
      const { data: postingData, error: postingError } = await supabase
        .from("postings")
        .insert({
          user_id: user.id,
          immoscout_url: url,
          title: propertyData.title,
          address: propertyData.address,
          thumbnail_url: propertyData.pictures[0]?.url || null,
        })
        .select()
        .single();

      if (postingError) throw postingError;

      setLoadingMessage(`Creating ${propertyData.pictures.length} rooms...`);

      // Create rooms for each picture
      for (let i = 0; i < propertyData.pictures.length; i++) {
        const picture = propertyData.pictures[i];
        await supabase.from("rooms").insert({
          posting_id: postingData.id,
          room_name: picture.title || `Room ${i + 1}`,
          original_image_url: picture.url,
          current_image_url: picture.url,
          room_order: i,
        });
      }

      toast.success(`Property added with ${propertyData.pictures.length} rooms!`);
      setUrl("");
      onOpenChange(false);
      onPostingAdded();
    } catch (error: any) {
      console.error("Scrape error:", error);
      toast.error(error.message || "Failed to scrape property");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handlePredefinedProperty = async (propertyIndex: 1 | 2) => {
    setLoading(true);
    setLoadingMessage("Creating predefined property...");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

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

      const images = propertyIndex === 1
        ? import.meta.glob('/src/components/images/property1/*.png', { eager: true, as: 'url' })
        : import.meta.glob('/src/components/images/property2/*.png', { eager: true, as: 'url' });

      const imagePaths = Object.values(images);
      let firstImagePublicUrl = null;

      for (let i = 0; i < imagePaths.length; i++) {
        const imagePath = imagePaths[i];
        const response = await fetch(imagePath);
        const blob = await response.blob();
        const fileName = `${user.id}/${postingData.id}/predefined-${Date.now()}-${i}.png`;

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

      if (firstImagePublicUrl) {
        await supabase
          .from("postings")
          .update({ thumbnail_url: firstImagePublicUrl })
          .eq("id", postingData.id);
      }

      toast.success(`${propertyTitle} created successfully!`);
      setUrl("");
      onOpenChange(false);
      onPostingAdded();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to create predefined property");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Property</DialogTitle>
          <DialogDescription>
            Paste an ImmoScout URL to automatically extract all room images
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleScrapeAndCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">ImmoScout URL</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.immobilienscout24.de/expose/..."
              required
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {loadingMessage}
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Extract Property
              </>
            )}
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or use demo properties
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="h-20 flex flex-col gap-2 hover:border-primary hover:bg-primary/5"
            onClick={() => handlePredefinedProperty(1)}
            disabled={loading}
          >
            <Home className="h-6 w-6 text-primary" />
            <span className="text-xs">Demo Property 1</span>
          </Button>
          <Button
            variant="outline"
            className="h-20 flex flex-col gap-2 hover:border-primary hover:bg-primary/5"
            onClick={() => handlePredefinedProperty(2)}
            disabled={loading}
          >
            <Home className="h-6 w-6 text-primary" />
            <span className="text-xs">Demo Property 2</span>
          </Button>
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddPostingDialog;
