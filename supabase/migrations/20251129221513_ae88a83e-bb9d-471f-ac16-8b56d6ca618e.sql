-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create postings table (properties from ImmoScout)
CREATE TABLE public.postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  immoscout_url TEXT NOT NULL,
  title TEXT NOT NULL,
  address TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.postings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own postings"
  ON public.postings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own postings"
  ON public.postings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own postings"
  ON public.postings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own postings"
  ON public.postings FOR DELETE
  USING (auth.uid() = user_id);

-- Create rooms table (extracted images from postings)
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_id UUID NOT NULL REFERENCES public.postings(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  original_image_url TEXT NOT NULL,
  current_image_url TEXT NOT NULL,
  room_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rooms of own postings"
  ON public.rooms FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.postings
    WHERE postings.id = rooms.posting_id
    AND postings.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert rooms to own postings"
  ON public.rooms FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.postings
    WHERE postings.id = rooms.posting_id
    AND postings.user_id = auth.uid()
  ));

CREATE POLICY "Users can update rooms of own postings"
  ON public.rooms FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.postings
    WHERE postings.id = rooms.posting_id
    AND postings.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete rooms of own postings"
  ON public.rooms FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.postings
    WHERE postings.id = rooms.posting_id
    AND postings.user_id = auth.uid()
  ));

-- Create furniture_items table (library of furniture)
CREATE TABLE public.furniture_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.furniture_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own furniture items"
  ON public.furniture_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own furniture items"
  ON public.furniture_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own furniture items"
  ON public.furniture_items FOR DELETE
  USING (auth.uid() = user_id);

-- Create room_edits table (edit history for each room)
CREATE TABLE public.room_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  edit_type TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  edit_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.room_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view edits of own rooms"
  ON public.room_edits FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rooms
    JOIN public.postings ON postings.id = rooms.posting_id
    WHERE rooms.id = room_edits.room_id
    AND postings.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert edits to own rooms"
  ON public.room_edits FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rooms
    JOIN public.postings ON postings.id = rooms.posting_id
    WHERE rooms.id = room_edits.room_id
    AND postings.user_id = auth.uid()
  ));

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public)
VALUES ('room-images', 'room-images', true);

-- Storage policies for room images
CREATE POLICY "Users can view all room images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'room-images');

CREATE POLICY "Authenticated users can upload room images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'room-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update own room images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'room-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete own room images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'room-images'
    AND auth.role() = 'authenticated'
  );

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_postings_updated_at
  BEFORE UPDATE ON public.postings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();