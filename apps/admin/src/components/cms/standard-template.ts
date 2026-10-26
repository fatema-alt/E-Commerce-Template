export interface StandardSection {
  id: string;
  type: string;
  visible: boolean;
  responsive?: {
    desktop?: boolean;
    tablet?: boolean;
    mobile?: boolean;
    width?: "contained" | "full";
    padding?: number;
  };
  config: Record<string, any>;
}

export function getStandardEcommerceTemplate(): StandardSection[] {
  return [
    {
      id: "hero-campaign",
      type: "hero",
      visible: true,
      responsive: {
        desktop: true,
        tablet: true,
        mobile: true,
        width: "contained",
        padding: 4,
      },
      config: {
        title: "Shop Smart. Live Smart.",
        subtitle:
          "Discover top-tier electronics, fashion, lifestyle, and daily essentials with lightning-fast delivery and Cash on Delivery all across Bangladesh.",
        button: {
          label: "Start Shopping ↗",
          href: "/shop",
        },
        align: "left",
      },
    },
    {
      id: "categories-showcase",
      type: "categoryGrid",
      visible: true,
      responsive: {
        desktop: true,
        tablet: true,
        mobile: true,
        width: "contained",
        padding: 4,
      },
      config: {
        title: "Shop by Department",
        columns: 6,
        categoryIds: [],
      },
    },
    {
      id: "flash-sale-deals",
      type: "flashSale",
      visible: true,
      responsive: {
        desktop: true,
        tablet: true,
        mobile: true,
        width: "contained",
        padding: 4,
      },
      config: {
        title: "⚡ Limited Time Flash Deals",
        source: "featured",
        limit: 8,
        columns: 4,
        endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
    {
      id: "best-sellers",
      type: "productGrid",
      visible: true,
      responsive: {
        desktop: true,
        tablet: true,
        mobile: true,
        width: "contained",
        padding: 4,
      },
      config: {
        title: "🔥 Best Sellers & Trending Now",
        source: "latest",
        limit: 8,
        columns: 4,
      },
    },
    {
      id: "promo-banner-savings",
      type: "promoBanner",
      visible: true,
      responsive: {
        desktop: true,
        tablet: true,
        mobile: true,
        width: "contained",
        padding: 4,
      },
      config: {
        title: "Mega Savings & Exclusive Discounts",
        description:
          "Apply verified coupon codes during checkout for instant savings. Free delivery available on qualifying cart orders.",
        button: {
          label: "Explore Discounted Deals ↗",
          href: "/shop",
        },
      },
    },
    {
      id: "trust-features-bd",
      type: "trustFeatures",
      visible: true,
      responsive: {
        desktop: true,
        tablet: true,
        mobile: true,
        width: "contained",
        padding: 4,
      },
      config: {
        title: "Why Shop With DS Mart?",
        items: [
          {
            title: "Cash on Delivery",
            description:
              "Pay safely in cash or mobile banking right at your doorstep anywhere in Bangladesh.",
            icon: "truck",
          },
          {
            title: "100% Authentic Products",
            description:
              "Directly sourced genuine products from authorized distributors with full warranty support.",
            icon: "shield",
          },
          {
            title: "Easy 7-Day Returns",
            description:
              "Simple and hassle-free replacements or full refunds if an item is not as expected.",
            icon: "return",
          },
          {
            title: "24/7 Dedicated Care",
            description:
              "Prompt customer assistance via hotline, email, and live messaging whenever you need help.",
            icon: "support",
          },
        ],
      },
    },
    {
      id: "customer-feedback",
      type: "customerReviews",
      visible: true,
      responsive: {
        desktop: true,
        tablet: true,
        mobile: true,
        width: "contained",
        padding: 4,
      },
      config: {
        title: "What Our Customers Are Saying",
        subtitle: "Genuine feedback and verified purchases from shoppers all across Bangladesh.",
        limit: 6,
      },
    },
    {
      id: "faq-home",
      type: "faq",
      visible: true,
      responsive: {
        desktop: true,
        tablet: true,
        mobile: true,
        width: "contained",
        padding: 4,
      },
      config: {
        title: "Frequently Asked Questions",
        items: [
          {
            question: "How do I place an order with Cash on Delivery (COD)?",
            answer:
              "Simply add products to your cart, proceed to checkout, enter your delivery address, and select 'Cash on Delivery'. You only pay when your parcel is delivered.",
          },
          {
            question: "What is the standard delivery timeline across Bangladesh?",
            answer:
              "Deliveries inside Dhaka typically arrive within 24 to 48 hours. For destinations outside Dhaka, delivery takes 2 to 4 business days.",
          },
          {
            question: "Can I use discount coupons on discounted items?",
            answer:
              "Yes! You can apply eligible promotional coupon codes in your cart or checkout to enjoy additional savings on your total.",
          },
          {
            question: "How do I initiate a return or replacement?",
            answer:
              "Contact our support team within 7 days of delivery with your order ID, and we will arrange courier pickup or exchange.",
          },
        ],
      },
    },
    {
      id: "newsletter-footer",
      type: "newsletter",
      visible: true,
      responsive: {
        desktop: true,
        tablet: true,
        mobile: true,
        width: "contained",
        padding: 4,
      },
      config: {
        title: "Get 10% Off Your First Order",
        description:
          "Subscribe to our weekly newsletter for exclusive voucher drops, new releases, and secret weekend sales.",
        buttonLabel: "Subscribe Now",
        consentText:
          "I agree to receive promotional emails and discount codes from DS Mart.",
        privacyHref: "/help",
      },
    },
  ];
}
