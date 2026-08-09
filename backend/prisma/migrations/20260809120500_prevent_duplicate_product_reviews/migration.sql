WITH ranked_reviews AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "userId", "productId"
            ORDER BY "createdAt" ASC, "id" ASC
        ) AS duplicate_rank
    FROM "reviews"
)
DELETE FROM "reviews"
WHERE "id" IN (
    SELECT "id"
    FROM ranked_reviews
    WHERE duplicate_rank > 1
);

UPDATE "products" AS product
SET
    "rating" = COALESCE((
        SELECT AVG(review."rating")
        FROM "reviews" AS review
        WHERE review."productId" = product."id"
    ), 0),
    "numReviews" = (
        SELECT COUNT(*)
        FROM "reviews" AS review
        WHERE review."productId" = product."id"
    );

CREATE UNIQUE INDEX IF NOT EXISTS "reviews_userId_productId_key"
ON "reviews"("userId", "productId");
