export const hasEligiblePurchaseForReview = async ({
  prismaClient,
  userId,
  productId,
}) => {
  if (!prismaClient || !userId || !productId) {
    return false;
  }

  const order = await prismaClient.order.findFirst({
    where: {
      userId,
      isPaid: true,
      status: { not: 'CANCELLED' },
      orderItems: { some: { productId } },
    },
    select: { id: true },
  });

  return Boolean(order);
};
