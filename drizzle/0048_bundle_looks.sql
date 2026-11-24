-- Owner, Nov 24: each bundle says what it includes, look by look (EN + ES, the owner's words). Written in the bundle's
-- description (shown as its looks on the cards and on /book); only where both are still empty, and the English only
-- when the Spanish row exists, so /es never shows half a bundle. The owner can change them in /admin -> Pricing.
-- No row is removed. Safe to run twice.
UPDATE "bundles" SET "description" = E'1 look\nCozy Wrap: baby swaddled and sleeping on your choice of backdrop.', "updated_at" = now()
WHERE "id" = 'little-moments' AND coalesce("description", '') = ''
  AND EXISTS (SELECT 1 FROM "bundle_translations" t WHERE t."bundle_id" = 'little-moments' AND t."locale" = 'es' AND coalesce(t."description", '') = '');
--> statement-breakpoint
UPDATE "bundle_translations" SET "description" = E'1 estilo\nArropadito: bebé envuelto y dormidito sobre el fondo que tú elijas.', "updated_at" = now()
WHERE "bundle_id" = 'little-moments' AND "locale" = 'es' AND coalesce("description", '') = ''
  AND (SELECT "description" FROM "bundles" WHERE "id" = 'little-moments') = E'1 look\nCozy Wrap: baby swaddled and sleeping on your choice of backdrop.';
--> statement-breakpoint
UPDATE "bundles" SET "description" = E'2 looks\nCozy Wrap: swaddled and sleeping on your first backdrop.\nLittle Nest: a second backdrop with a prop, like a basket or tiny bed.', "updated_at" = now()
WHERE "id" = 'our-little-story' AND coalesce("description", '') = ''
  AND EXISTS (SELECT 1 FROM "bundle_translations" t WHERE t."bundle_id" = 'our-little-story' AND t."locale" = 'es' AND coalesce(t."description", '') = '');
--> statement-breakpoint
UPDATE "bundle_translations" SET "description" = E'2 estilos\nArropadito: envuelto y dormidito sobre tu primer fondo.\nNidito: un segundo fondo con un accesorio, como una canastita o una camita.', "updated_at" = now()
WHERE "bundle_id" = 'our-little-story' AND "locale" = 'es' AND coalesce("description", '') = ''
  AND (SELECT "description" FROM "bundles" WHERE "id" = 'our-little-story') = E'2 looks\nCozy Wrap: swaddled and sleeping on your first backdrop.\nLittle Nest: a second backdrop with a prop, like a basket or tiny bed.';
--> statement-breakpoint
UPDATE "bundles" SET "description" = E'3 looks plus family\nCozy Wrap, Little Nest, and Dreamland, a third backdrop styled with props.\nFamily Hug: photos with mom, dad and siblings.', "updated_at" = now()
WHERE "id" = 'forever-little' AND coalesce("description", '') = ''
  AND EXISTS (SELECT 1 FROM "bundle_translations" t WHERE t."bundle_id" = 'forever-little' AND t."locale" = 'es' AND coalesce(t."description", '') = '');
--> statement-breakpoint
UPDATE "bundle_translations" SET "description" = E'3 estilos + familia\nArropadito, Nidito y Dulces Sueños, un tercer fondo decorado con accesorios.\nAbrazo en Familia: fotos con mamá, papá y los hermanitos.', "updated_at" = now()
WHERE "bundle_id" = 'forever-little' AND "locale" = 'es' AND coalesce("description", '') = ''
  AND (SELECT "description" FROM "bundles" WHERE "id" = 'forever-little') = E'3 looks plus family\nCozy Wrap, Little Nest, and Dreamland, a third backdrop styled with props.\nFamily Hug: photos with mom, dad and siblings.';
