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
        bannerType: "with_button",
        showTrustStrip: false,
        title: "Shop Smart. Live Smart.",
        subtitle:
          "Explore the catalogue and check available payment and delivery options at checkout.",
        button: {
          label: "Start Shopping ↗",
          href: "/shop",
        },
        bannerLink: "/shop",
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
      type: "productGrid",
      visible: false,
      responsive: {
        desktop: true,
        tablet: true,
        mobile: true,
        width: "contained",
        padding: 4,
      },
      config: {
        title: "Featured products",
        source: "featured",
        limit: 8,
        columns: 4,
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
        title: "Latest products",
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
        title: "Explore the catalogue",
        description:
          "Review product details, prices and available options before ordering.",
        button: {
          label: "Browse products ↗",
          href: "/shop",
        },
      },
    },
    {
      id: "trust-features-bd",
      type: "trustFeatures",
      visible: false,
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
            title: "Payment options",
            description:
              "Check available payment methods at checkout.",
            icon: "truck",
          },
          {
            title: "Product information",
            description:
              "Review product details before ordering.",
            icon: "shield",
          },
          {
            title: "Returns questions",
            description:
              "Questions about returns? Contact our team.",
            icon: "return",
          },
          {
            title: "Contact our team",
            description:
              "Ask about products or an existing order.",
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
        subtitle: "Customer feedback.",
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
            question: "Which payment methods are available?",
            answer:
              "Check available payment methods at checkout.",
          },
          {
            question: "Where can I check delivery information?",
            answer:
              "Review delivery charges at checkout. Contact our team with your location for delivery questions.",
          },
          {
            question: "Can I use discount coupons on discounted items?",
            answer:
              "If you have a coupon, enter it in your cart or at checkout. Any eligible discount is shown in your order total.",
          },
          {
            question: "Who do I contact about a return?",
            answer:
              "Questions about returns? Contact our team.",
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
        title: "Stay in the loop with DS Mart",
        description:
          "Subscribe to receive news and product updates from DS Mart.",
        buttonLabel: "Subscribe Now",
        consentText:
          "I agree to receive news and product updates from DS Mart.",
        privacyHref: "/help",
      },
    },
  ];
}
