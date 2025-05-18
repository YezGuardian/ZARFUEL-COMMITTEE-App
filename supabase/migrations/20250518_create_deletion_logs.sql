-- Create deletion_logs table
CREATE TABLE IF NOT EXISTS public.deletion_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  deleted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by_name TEXT NOT NULL,
  details JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_deletion_logs_table_name ON deletion_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_deleted_by ON deletion_logs(deleted_by);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_created_at ON deletion_logs(created_at);

-- Enable RLS
ALTER TABLE public.deletion_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow super admins to view all deletion logs
CREATE POLICY "Allow super admins to view deletion logs"
ON public.deletion_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  )
);

-- Allow users to create deletion logs
CREATE POLICY "Allow users to create deletion logs"
ON public.deletion_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only super admins can delete deletion logs
CREATE POLICY "Allow super admins to delete deletion logs"
ON public.deletion_logs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  )
); 