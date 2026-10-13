CREATE TABLE "Product" (
 "id" SERIAL PRIMARY KEY,
 "name" TEXT NOT NULL CHECK (length(btrim("name")) > 0),
 "priceInCents" INTEGER NOT NULL CHECK ("priceInCents" >= 0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
