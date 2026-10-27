import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ReviewsController } from './reviews.controller.js';
import { AdminReviewsController } from './admin-reviews.controller.js';
import type { ReviewsService } from './reviews.service.js';
import type { ShopService } from '../shop/shop.service.js';
import { SubscribeDto } from '../shop/shop.dto.js';
import { CreateReviewDto } from './reviews.dto.js';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

const productId = '12345678-1234-4234-8234-123456789abc';
function setup(customerId?: string) {
  const reviews = { submitReview: vi.fn().mockResolvedValue({ status: 'PENDING' }), getProductReviews: vi.fn(), submitQuestion: vi.fn() };
  const shop = { throttle: vi.fn().mockResolvedValue(undefined), session: vi.fn().mockResolvedValue(customerId ? { customerId, customer: { email: 'shopper@example.com' } } : null) };
  const controller = new ReviewsController(reviews as unknown as ReviewsService, shop as unknown as ShopService);
  return { controller, reviews, shop };
}
describe('Storefront review and subscription contracts', () => {
  it('exposes storefront reviews without making admin moderation public', () => {
    const reflector = new Reflector();
    expect(reflector.get('public', ReviewsController)).toBe(true);
    expect(reflector.get('public', AdminReviewsController)).not.toBe(true);
  });
  it('passes the real shopper identity and authoritative path product into existing review policy', async () => {
    const { controller, reviews, shop } = setup('customer-1');
    const dto = { productId: 'body-value', rating: 5, content: 'Great product', authorName: 'Shopper', authorEmail: 'different@example.com' };
    const request = { headers: { cookie: 'commerce_shopper=session-token' }, ip: '127.0.0.1' } as Request;
    await controller.submitReview(productId, dto, request);
    expect(shop.session).toHaveBeenCalledWith('session-token');
    expect(reviews.submitReview).toHaveBeenCalledWith(expect.objectContaining({ productId, authorEmail: 'shopper@example.com' }), 'customer-1');
    expect(shop.throttle).toHaveBeenCalled();
  });
  it('retains guest moderation and does not invent a verified identity', async () => {
    const { controller, reviews } = setup();
    const dto = { productId, rating: 3, content: 'My experience', authorName: 'Guest', authorEmail: 'guest@example.com' };
    await controller.submitReview(productId, dto, { headers: {}, ip: '127.0.0.1' } as Request);
    expect(reviews.submitReview).toHaveBeenCalledWith(dto, undefined);
  });
  it('rejects invalid pages, limits and rating filters before reaching the database', async () => {
    const { controller, reviews } = setup();
    await expect(controller.getReviews(productId, -1)).rejects.toThrow();
    await expect(controller.getReviews(productId, 1, 1000)).rejects.toThrow();
    await expect(controller.getReviews(productId, 1, 5, 6)).rejects.toThrow();
    expect(reviews.getProductReviews).not.toHaveBeenCalled();
  });
  it('validates required review data, email and subscription consent using the real DTOs', async () => {
    const review = { productId, rating: 4, content: 'Genuine review', authorName: 'Shopper', authorEmail: 'shopper@example.com' };
    expect(await validate(plainToInstance(CreateReviewDto, review))).toHaveLength(0);
    expect((await validate(plainToInstance(CreateReviewDto, { ...review, rating: 0 }))).length).toBeGreaterThan(0);
    expect(await validate(plainToInstance(SubscribeDto, { email: 'shopper@example.com', consent: true }))).toHaveLength(0);
    expect((await validate(plainToInstance(SubscribeDto, { email: 'invalid', consent: true }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(SubscribeDto, { email: 'shopper@example.com', consent: false }))).length).toBeGreaterThan(0);
  });
});
