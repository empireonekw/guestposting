import Review from '../models/Review';
import Order from '../models/Order';
import { json, readBody, serverError } from '../http';
import { str, num, objectId } from '../validate';

export const createReview = async (request, params, user) => {
  try {
    const body = await readBody(request);
    const orderId = objectId(body.orderId, 'orderId', 'Order');
    const rating = num(body.rating, 'rating', 'Rating', { min: 1, max: 5, integer: true });
    const comment = str(body.comment, 'comment', 'Review', { min: 2, max: 2000 });

    const order = await Order.findById(orderId);
    if (!order) return json({ message: 'Order not found' }, 404);

    if (order.status !== 'completed') {
      return json({ message: 'You can only review completed orders' }, 400);
    }
    if (order.buyer.toString() !== user.id) {
      return json({ message: 'Only the buyer can leave a review' }, 403);
    }
    if (await Review.exists({ order: orderId })) {
      return json({ message: 'You have already reviewed this order' }, 400);
    }

    const review = await Review.create({
      order: orderId,
      buyer: user.id,
      seller: order.seller,
      rating,
      comment,
    });

    return json(review, 201);
  } catch (error) {
    return serverError(error);
  }
};

export const getSellerReviews = async (request, params) => {
  try {
    const sellerId = objectId(params.id, 'id', 'Seller');
    const reviews = await Review.find({ seller: sellerId })
      .populate('buyer', 'name')
      .sort({ createdAt: -1 })
      .limit(100);
    return json(reviews);
  } catch (error) {
    return serverError(error);
  }
};
