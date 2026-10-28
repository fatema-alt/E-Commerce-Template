import "dotenv/config";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({
  datasourceUrl:
    process.env.DATABASE_URL ||
    "postgresql://commerce:commerce_dev_password@localhost:5434/commerce_db?schema=public",
});

// Relative directory paths that work across any environment (Linux/Docker/Windows)
const projectRoot = resolve(process.cwd());
const apiUploads = join(projectRoot, "uploads", "products");
const storefrontUploads = join(
  projectRoot,
  "..",
  "storefront",
  "public",
  "uploads",
  "products",
);

try {
  if (!existsSync(apiUploads)) mkdirSync(apiUploads, { recursive: true });
} catch {}

const productsData = [
  {
    sku: "DS-SMRG-VB99",
    slug: "smallrig-vb99-mini-v-mount-battery-99wh",
    name: "SmallRig VB99 Mini V-Mount Battery (99Wh)",
    brand: "SmallRig",
    price: 16500,
    salePrice: 14990,
    stock: 10,
    categoryName: "Electronics",
    categorySlug: "electronics",
    shortDescription:
      "Ultra-compact 99Wh Mini V-Mount Battery with USB-C 65W PD fast charging, D-Tap, and OLED status display.",
    description: `<h3>SmallRig VB99 Mini V-Mount Battery (99Wh)</h3>
<p>The SmallRig VB99 Mini V-Mount Battery is an ultra-compact, lightweight 99Wh lithium-ion battery designed for professional filmmakers, videographers, and content creators.</p>
<h4>Key Features:</h4>
<ul>
  <li><strong>High Capacity & Airline Safe:</strong> 99Wh / 6700mAh capacity complies with airline travel regulations.</li>
  <li><strong>65W USB-C Two-Way Fast Charging:</strong> Supports PD / QC fast-charging protocols to power cameras, monitors, or recharge mobile phones and laptops.</li>
  <li><strong>Versatile Output Ports:</strong> Includes D-Tap, USB-A, USB-C, 8V DC, and 12V DC ports for multi-device powering.</li>
  <li><strong>Smart OLED Display:</strong> Shows real-time battery percentage, voltage, and remaining runtime.</li>
  <li><strong>Premium Safety Architecture:</strong> Built-in multi-protection against over-charge, over-discharge, short-circuit, and high temperature.</li>
</ul>`,
    images: [
      "/uploads/products/smallrig-vb99-mini-v-mount-battery-99wh-1.png",
      "/uploads/products/smallrig-vb99-mini-v-mount-battery-99wh-2.png",
      "/uploads/products/smallrig-vb99-mini-v-mount-battery-99wh-3.png",
      "/uploads/products/smallrig-vb99-mini-v-mount-battery-99wh-4.png",
      "/uploads/products/smallrig-vb99-mini-v-mount-battery-99wh-5.png",
    ],
  },
  {
    sku: "DS-ZSYB-Y500S",
    slug: "zsyb-y500s-500w-bi-color-cob-led-video-light",
    name: "ZSYB Y500S 500W Bi-Color COB LED Video Light",
    brand: "ZSYB",
    price: 23500,
    salePrice: 21500,
    stock: 25,
    categoryName: "Electronics",
    categorySlug: "electronics",
    shortDescription:
      "Heavy-duty 500W Bi-Color COB LED continuous video light with Bowens mount, silent cooling, and wireless control.",
    description: `<h3>ZSYB Y500S 500W Bi-Color COB LED Video Light</h3>
<p>The ZSYB Y500S is a powerhouse 500W bi-color studio fixture engineered for high-end studio photography, commercial video production, and broadcast setups.</p>
<h4>Key Features:</h4>
<ul>
  <li><strong>Massive 500W Power Output:</strong> Delivers immense, cinema-grade illumination with uniform light beam spread.</li>
  <li><strong>Bi-Color Temperature (2800K - 6500K):</strong> Seamlessly transitions from warm tungsten to crisp daylight.</li>
  <li><strong>Exceptional Color Rendering:</strong> CRI 97+ / TLCI 98+ ensures natural and realistic skin tones without tint shifts.</li>
  <li><strong>Standard Bowens Mount:</strong> Compatible with a vast range of softboxes, reflectors, and light modifiers.</li>
  <li><strong>Intelligent Silent Cooling:</strong> Advanced heat dissipation with whisper-quiet fan mode prevents audio disruption on set.</li>
</ul>`,
    images: [
      "/uploads/products/zsyb-y500s-500w-bi-color-cob-led-video-light-1.png",
      "/uploads/products/zsyb-y500s-500w-bi-color-cob-led-video-light-2.png",
      "/uploads/products/zsyb-y500s-500w-bi-color-cob-led-video-light-3.png",
      "/uploads/products/zsyb-y500s-500w-bi-color-cob-led-video-light-4.png",
    ],
  },
  {
    sku: "DS-CANON-R6M3",
    slug: "canon-eos-r6-mark-iii-mirrorless-camera",
    name: "Canon EOS R6 Mark III Mirrorless Camera",
    brand: "Canon",
    price: 285000,
    salePrice: 275500,
    stock: 5,
    categoryName: "Electronics",
    categorySlug: "electronics",
    shortDescription:
      "Full-frame professional mirrorless camera with Dual Pixel AF, up to 8-stop IBIS, 4K 60p video, and 18-month official warranty.",
    description: `<h3>Canon EOS R6 Mark III Mirrorless Camera</h3>
<p>Experience unmatched speed, clarity, and precision with the Canon EOS R6 full-frame mirrorless camera. Designed for hybrid creators who demand world-class photo and video capabilities.</p>
<h4>Key Features:</h4>
<ul>
  <li><strong>High-Speed Full-Frame Sensor:</strong> Capture high-resolution stills with incredible dynamic range and ultra-low noise in low light.</li>
  <li><strong>Dual Pixel CMOS AF:</strong> Deep learning subject tracking for humans, animals, and vehicles.</li>
  <li><strong>Up to 8-Stop 5-Axis In-Body Stabilization (IBIS):</strong> Smooth handheld shooting and blur-free photos.</li>
  <li><strong>Cinematic 4K 60p Recording:</strong> 10-bit 4:2:2 Canon Log 3 for flexible color grading.</li>
  <li><strong>Dual Card Slots & Weather-Sealed Body:</strong> Dual SD UHS-II slots and rugged magnesium alloy chassis.</li>
  <li><strong>Warranty:</strong> 18 Months Canon Official Warranty.</li>
</ul>`,
    images: [
      "/uploads/products/canon-eos-r6-mark-iii-mirrorless-camera-1.jpg",
      "/uploads/products/canon-eos-r6-mark-iii-mirrorless-camera-2.jpg",
      "/uploads/products/canon-eos-r6-mark-iii-mirrorless-camera-3.jpg",
      "/uploads/products/canon-eos-r6-mark-iii-mirrorless-camera-4.jpg",
      "/uploads/products/canon-eos-r6-mark-iii-mirrorless-camera-5.jpg",
      "/uploads/products/canon-eos-r6-mark-iii-mirrorless-camera-6.jpg",
      "/uploads/products/canon-eos-r6-mark-iii-mirrorless-camera-7.jpg",
    ],
  },
  {
    sku: "DS-GDX-LC500-CHG",
    slug: "godox-charger-for-lc500-lc500r-led-light-sticks",
    name: "Godox Charger for LC500 / LC500R LED Light Sticks",
    brand: "Godox",
    price: 2600,
    salePrice: 2250,
    stock: 10,
    categoryName: "Electronics",
    categorySlug: "electronics",
    shortDescription:
      "Original Godox AC power adapter and fast charger for Godox LC500 and LC500R handheld LED light wands.",
    description: `<h3>Godox Charger for LC500 / LC500R LED Light Sticks</h3>
<p>Official replacement and backup power adapter specifically tailored for the Godox LC500 and LC500R handheld RGB/Bi-color light sticks.</p>
<h4>Key Features:</h4>
<ul>
  <li><strong>Dedicated Compatibility:</strong> Guaranteed safe voltage and current delivery for Godox LC500 & LC500R models.</li>
  <li><strong>Fast & Stable Charging:</strong> Efficient AC-to-DC conversion for rapid recharge times without overheating.</li>
  <li><strong>Durable Cable Construction:</strong> Heavy-duty reinforced strain-relief cable for studio and on-location reliability.</li>
  <li><strong>Universal Input:</strong> 100V-240V AC 50/60Hz worldwide voltage compatibility.</li>
</ul>`,
    images: [
      "/uploads/products/godox-charger-for-lc500-lc500r-led-light-sticks-1.jpg",
      "/uploads/products/godox-charger-for-lc500-lc500r-led-light-sticks-2.jpg",
    ],
  },
  {
    sku: "DS-QY33-WLMIC",
    slug: "qy33-wireless-microphone-360-omni-lavalier-mic",
    name: "QY33 Wireless Microphone 360° Omnidirectional Lavalier Mic",
    brand: "QY33",
    price: 4000,
    salePrice: 3500,
    stock: 15,
    categoryName: "Electronics",
    categorySlug: "electronics",
    shortDescription:
      "360° Omnidirectional dual wireless lapel microphone system with smart DSP noise reduction and charging case.",
    description: `<h3>QY33 Wireless Microphone 360° Omnidirectional Lavalier Mic</h3>
<p>The QY33 wireless microphone system is engineered for crystal-clear voice clarity during vlogging, interviews, live streaming, and content creation.</p>
<h4>Key Features:</h4>
<ul>
  <li><strong>360° Omnidirectional Sound Pickup:</strong> Highly sensitive mic capsule captures full, natural vocal nuance from all directions.</li>
  <li><strong>Intelligent DSP Noise Cancellation:</strong> Dual-core chip filters background wind, traffic, and room echoes with one touch.</li>
  <li><strong>Plug & Play Zero Latency:</strong> Instant pairing with smartphones (iOS/Android), cameras, and PCs without extra apps.</li>
  <li><strong>Long Battery Life & Charging Case:</strong> Up to 8 hours continuous recording per charge, extended to 36 hours with the charging case.</li>
</ul>`,
    images: [
      "/uploads/products/qy33-wireless-microphone-360-omni-lavalier-mic-1.jpg",
      "/uploads/products/qy33-wireless-microphone-360-omni-lavalier-mic-2.jpg",
      "/uploads/products/qy33-wireless-microphone-360-omni-lavalier-mic-3.jpg",
      "/uploads/products/qy33-wireless-microphone-360-omni-lavalier-mic-4.jpg",
    ],
  },
  {
    sku: "DS-ZSYB-Y200S",
    slug: "zsyb-y200s-200w-bi-color-cob-led-video-light",
    name: "ZSYB Y200S 200W Bi-Color COB LED Video Light",
    brand: "ZSYB",
    price: 18500,
    salePrice: 16500,
    stock: 20,
    categoryName: "Electronics",
    categorySlug: "electronics",
    shortDescription:
      "200W Bi-Color COB continuous LED video light with Bowens mount, silent fan, CRI 97+, and wireless app control.",
    description: `<h3>ZSYB Y200S 200W Bi-Color COB LED Video Light</h3>
<p>The ZSYB Y200S is a versatile 200W continuous LED fixture offering studio-grade illumination in a lightweight, compact footprint.</p>
<h4>Key Features:</h4>
<ul>
  <li><strong>Powerful 200W Output:</strong> High-efficiency COB LED array for YouTube studios, interviews, and product photography.</li>
  <li><strong>Bi-Color Range (2800K - 6500K):</strong> Smooth dial adjustment from warm tungsten glow to natural daylight.</li>
  <li><strong>Accurate Color Reproduction:</strong> CRI 97+ / TLCI 97+ guarantees accurate skin tones and minimal post-color work.</li>
  <li><strong>Bowens Standard Bayonet:</strong> Seamlessly accommodates beauty dishes, softboxes, and snoots.</li>
  <li><strong>Ultra-Quiet Operation:</strong> Low-decibel active fan prevents microphone audio interference.</li>
</ul>`,
    images: [
      "/uploads/products/zsyb-y200s-200w-bi-color-cob-led-video-light-1.png",
      "/uploads/products/zsyb-y200s-200w-bi-color-cob-led-video-light-2.png",
      "/uploads/products/zsyb-y200s-200w-bi-color-cob-led-video-light-3.png",
    ],
  },
  {
    sku: "DS-ZSYB-Y300S",
    slug: "zsyb-y300s-300w-bi-color-cob-led-video-light",
    name: "ZSYB Y300S 300W Bi-Color COB LED Video Light",
    brand: "ZSYB",
    price: 19500,
    salePrice: 17500,
    stock: 15,
    categoryName: "Electronics",
    categorySlug: "electronics",
    shortDescription:
      "300W Bi-Color COB LED studio video light with Bowens mount, built-in FX effects, and wireless control.",
    description: `<h3>ZSYB Y300S 300W Bi-Color COB LED Video Light</h3>
<p>Elevate your creative production with the ZSYB Y300S 300W Bi-Color COB LED video light, providing heavy-duty illumination with exquisite color rendering.</p>
<h4>Key Features:</h4>
<ul>
  <li><strong>300W High Lumen Output:</strong> Ample power to serve as key light for multicam studios and large video scenes.</li>
  <li><strong>Adjustable 2800K-6500K Color Temp:</strong> Dial in any ambient light scenario quickly and accurately.</li>
  <li><strong>Built-in Special FX Modes:</strong> Pre-programmed effects including Lightning, Flash, TV screen, and Candle flicker.</li>
  <li><strong>Full Bowens Mount Ecosystem:</strong> Works with all standard Bowens light modifiers and softboxes.</li>
  <li><strong>Rugged Aluminum Build:</strong> Durable alloy housing built to withstand heavy daily studio usage.</li>
</ul>`,
    images: [
      "/uploads/products/zsyb-y300s-300w-bi-color-cob-led-video-light-1.png",
      "/uploads/products/zsyb-y300s-300w-bi-color-cob-led-video-light-2.png",
      "/uploads/products/zsyb-y300s-300w-bi-color-cob-led-video-light-3.png",
      "/uploads/products/zsyb-y300s-300w-bi-color-cob-led-video-light-4.png",
    ],
  },
];

async function main() {
  console.log("Seeding 7 new products into DS Mart database...");

  // 1. Ensure Electronics category exists
  let category = await prisma.category.findUnique({
    where: { slug: "electronics" },
  });
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: "Electronics",
        slug: "electronics",
        description: "Explore the latest electronics, cameras, and audio gear at DS Mart.",
        isActive: true,
        isVisible: true,
      },
    });
    console.log(`✓ Created Category: ${category.name}`);
  } else {
    console.log(`✓ Category verified: ${category.name}`);
  }

  // 2. Process all products
  for (const item of productsData) {
    console.log(`\nProcessing: ${item.name} (${item.sku})`);

    // Create or Upsert Product in PostgreSQL
    const existing = await prisma.product.findUnique({
      where: { sku: item.sku },
    });

    let product;
    if (existing) {
      product = await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          slug: item.slug,
          brand: item.brand,
          price: item.price,
          salePrice: item.salePrice,
          stock: item.stock,
          status: "ACTIVE",
          isActive: true,
          isVisible: true,
          categoryId: category.id,
          shortDescription: item.shortDescription,
          description: item.description,
        },
      });
      console.log(`  ✓ Updated Product: ${product.name}`);
    } else {
      product = await prisma.product.create({
        data: {
          name: item.name,
          slug: item.slug,
          sku: item.sku,
          brand: item.brand,
          price: item.price,
          salePrice: item.salePrice,
          stock: item.stock,
          status: "ACTIVE",
          isActive: true,
          isVisible: true,
          categoryId: category.id,
          shortDescription: item.shortDescription,
          description: item.description,
          currency: "BDT",
          type: "SIMPLE",
          requiresShipping: true,
          trackInventory: true,
        },
      });
      console.log(`  ✓ Created Product: ${product.name}`);
    }

    // Attach Images
    await prisma.productImage.deleteMany({
      where: { productId: product.id },
    });

    for (let i = 0; i < item.images.length; i++) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: item.images[i],
          altText: `${item.name} image ${i + 1}`,
          isPrimary: i === 0,
          sortOrder: i,
        },
      });
    }
    console.log(`  ✓ Attached ${item.images.length} images to product.`);

    // Sync inventory
    await prisma.inventory.upsert({
      where: { productId: product.id },
      create: {
        productId: product.id,
        quantity: item.stock,
        reserved: 0,
        lowStockAt: 5,
      },
      update: {
        quantity: item.stock,
      },
    });
    console.log(`  ✓ Synced inventory quantity: ${item.stock}`);
  }

  console.log("\n================================================================================");
  console.log("All 7 products successfully seeded into the database and live on the storefront!");
  console.log("================================================================================");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
