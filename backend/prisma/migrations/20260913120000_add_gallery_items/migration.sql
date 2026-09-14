-- Gallery system (public website): CMS-managed photos with a publish
-- workflow, category filtering, and a "featured/recent" flag surfaced on
-- the homepage. Purely additive — a new table only, no existing tables
-- touched.

CREATE TABLE "gallery_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "event_date" TIMESTAMP(3),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gallery_items_pkey" PRIMARY KEY ("id")
);

-- Public gallery page + admin filter-by-category list: published items,
-- optionally scoped to a category, newest first.
CREATE INDEX "gallery_items_is_published_category_created_at_idx" ON "gallery_items"("is_published", "category", "created_at");

-- Home page "Recent Photos" query: published + featured, newest first.
CREATE INDEX "gallery_items_is_published_is_featured_created_at_idx" ON "gallery_items"("is_published", "is_featured", "created_at");
