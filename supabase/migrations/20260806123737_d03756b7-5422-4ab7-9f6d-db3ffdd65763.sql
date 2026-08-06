UPDATE public.transcript_segments SET client_id = id::text WHERE client_id IS NULL;
ALTER TABLE public.transcript_segments ALTER COLUMN client_id SET DEFAULT '';
ALTER TABLE public.transcript_segments ALTER COLUMN client_id SET NOT NULL;
DROP INDEX IF EXISTS public.transcript_segments_client_id_key;
CREATE UNIQUE INDEX transcript_segments_client_id_key ON public.transcript_segments (consultation_id, client_id);