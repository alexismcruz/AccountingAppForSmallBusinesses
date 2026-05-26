CREATE TABLE "Shop" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "zip" TEXT,
  "phone" TEXT,
  "website" TEXT,
  "hours" JSONB,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "description" TEXT,
  "categories" TEXT[] NOT NULL DEFAULT '{}',
  "yelpId" TEXT UNIQUE,
  "googleId" TEXT UNIQUE,
  "rating" DOUBLE PRECISION,
  "reviewCount" INTEGER,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "Shop_state_idx" ON "Shop"("state");
CREATE INDEX "Shop_city_idx" ON "Shop"("city");
CREATE INDEX "Shop_state_city_idx" ON "Shop"("state", "city");
