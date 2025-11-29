import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PostingCardProps {
  posting: {
    id: string;
    title: string;
    address: string | null;
    thumbnail_url: string | null;
    immoscout_url: string;
  };
  onDeleted: () => void;
}

const PostingCard = ({ posting, onDeleted }: PostingCardProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("postings")
        .delete()
        .eq("id", posting.id);

      if (error) throw error;

      toast.success("Property deleted successfully");
      onDeleted();
    } catch (error: any) {
      toast.error("Failed to delete property");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Card 
        className="overflow-hidden hover:shadow-glow transition-smooth cursor-pointer group"
        onClick={() => navigate(`/editor/${posting.id}`)}
      >
        <div className="aspect-video bg-muted relative overflow-hidden">
          {posting.thumbnail_url ? (
            <img
              src={posting.thumbnail_url}
              alt={posting.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-smooth"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No image
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-lg text-foreground mb-1 truncate">
            {posting.title}
          </h3>
          {posting.address && (
            <p className="text-sm text-muted-foreground truncate">{posting.address}</p>
          )}
        </CardContent>
        <CardFooter className="p-4 pt-0 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              window.open(posting.immoscout_url, "_blank");
            }}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Listing
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteDialog(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this property? This action cannot be undone
              and will delete all rooms and edits associated with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PostingCard;
