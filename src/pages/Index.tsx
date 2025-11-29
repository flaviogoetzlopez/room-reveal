import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Home, Image, Palette } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
            RoomRemodel
          </h1>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-5xl font-bold text-foreground mb-4">
              Transform Property Images
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Import ImmoScout listings and reimagine every room with AI-powered furniture editing
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="p-6 rounded-lg bg-card/50 border border-border/50 shadow-card">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Home className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Import Properties</h3>
              <p className="text-sm text-muted-foreground">
                Paste ImmoScout URLs to extract all room images automatically
              </p>
            </div>

            <div className="p-6 rounded-lg bg-card/50 border border-border/50 shadow-card">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Palette className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Edit Rooms</h3>
              <p className="text-sm text-muted-foreground">
                Add, remove, or modify furniture with intuitive controls
              </p>
            </div>

            <div className="p-6 rounded-lg bg-card/50 border border-border/50 shadow-card">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Image className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Track Changes</h3>
              <p className="text-sm text-muted-foreground">
                View complete edit history for every room image
              </p>
            </div>
          </div>

          <div className="pt-8">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow text-lg px-8"
            >
              Get Started
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
