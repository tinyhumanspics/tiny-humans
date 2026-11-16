-- Brief 05: which bundles show on the ad landing page and the bundles page (on by default; the owner switches them in
-- /admin -> Pricing). Add-only, safe to run twice.
ALTER TABLE "bundles" ADD COLUMN IF NOT EXISTS "show_on_landing" boolean DEFAULT true NOT NULL;
