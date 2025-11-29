import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Plus } from "lucide-react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import PostingCard from "@/components/PostingCard";
import AddPostingDialog from "@/components/AddPostingDialog";

interface Posting {
  id: string;
  title: string;
  address: string | null;
  thumbnail_url: string | null;
  immoscout_url: string;
  created_at: string;
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [postings, setPostings] = useState<Posting[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
        return;
      }
      setUser(session.user);
      fetchPostings();
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchPostings = async () => {
    try {
      const { data, error } = await supabase
        .from("postings")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPostings(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch postings");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
            RoomRemodel
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Your Properties</h2>
            <p className="text-muted-foreground">
              Manage and edit property room images
            </p>
          </div>
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 shadow-glow"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-64 bg-card animate-pulse rounded-lg" />
            ))}
          </div>
        ) : postings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No properties yet</p>
            <Button onClick={() => setIsAddDialogOpen(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add your first property
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {postings.map((posting) => (
              <PostingCard
                key={posting.id}
                posting={posting}
                onDeleted={fetchPostings}
              />
            ))}
          </div>
        )}
      </main>

      <AddPostingDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onPostingAdded={fetchPostings}
      />
    </div>
  );
};

export default Dashboard;
