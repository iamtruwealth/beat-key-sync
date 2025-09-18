-- Create split_sheets table
CREATE TABLE public.split_sheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  song_title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  producer_name TEXT NOT NULL,
  date_of_agreement DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_signatures', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create split_sheet_contributors table  
CREATE TABLE public.split_sheet_contributors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  split_sheet_id UUID NOT NULL REFERENCES public.split_sheets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  ownership_percentage NUMERIC(5,2) NOT NULL CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
  contact_info TEXT,
  signature_data TEXT, -- Base64 encoded signature image
  signature_type TEXT CHECK (signature_type IN ('drawn', 'typed', 'uploaded')),
  signed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.split_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_sheet_contributors ENABLE ROW LEVEL SECURITY;

-- Create policies for split_sheets
CREATE POLICY "Users can view their own split sheets" 
ON public.split_sheets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own split sheets" 
ON public.split_sheets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own split sheets" 
ON public.split_sheets 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own split sheets" 
ON public.split_sheets 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for split_sheet_contributors
CREATE POLICY "Users can view contributors for their split sheets" 
ON public.split_sheet_contributors 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.split_sheets 
  WHERE id = split_sheet_contributors.split_sheet_id 
  AND user_id = auth.uid()
));

CREATE POLICY "Users can manage contributors for their split sheets" 
ON public.split_sheet_contributors 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.split_sheets 
  WHERE id = split_sheet_contributors.split_sheet_id 
  AND user_id = auth.uid()
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_split_sheets_updated_at
BEFORE UPDATE ON public.split_sheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();