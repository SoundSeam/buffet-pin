import {
  DEFAULT_OG_IMAGE,
  RESTAURANT_ADDRESS,
  RESTAURANT_CUISINES,
  RESTAURANT_EMAIL,
  RESTAURANT_OPENING_HOURS,
  RESTAURANT_PHONE,
  RESTAURANT_PRICE_RANGE,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";

const RESTAURANT_IMAGES = [
  "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/f58978fdf_generated_8faba501.png",
  "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/872a06ea3_generated_c0f1cb51.png",
  "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/58249255b_generated_0f949410.png",
];

export default function RestaurantJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${SITE_URL}#restaurant`,
    name: SITE_NAME,
    url: SITE_URL,
    image: RESTAURANT_IMAGES,
    logo: DEFAULT_OG_IMAGE,
    telephone: RESTAURANT_PHONE,
    email: RESTAURANT_EMAIL,
    priceRange: RESTAURANT_PRICE_RANGE,
    servesCuisine: RESTAURANT_CUISINES,
    acceptsReservations: true,
    hasMap: "https://maps.app.goo.gl/9qoswmW14dh1AJVh7?g_st=ic",
    address: {
      "@type": "PostalAddress",
      ...RESTAURANT_ADDRESS,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 45.360646,
      longitude: -73.713994,
    },
    openingHoursSpecification: RESTAURANT_OPENING_HOURS,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
