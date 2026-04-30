export interface PromoBanner {
  id: string;
  image: string;
  title?: string;
  subtitle?: string;
}

export const PROMO_BANNERS: PromoBanner[] = [
  {
    id: "welcome",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&h=506&fit=crop",
    title: "Welcome to SERVIO",
    subtitle: "Cooked fresh, served straight to your table.",
  },
  {
    id: "halo-halo-week",
    image:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=900&h=506&fit=crop",
    title: "Halo-Halo Week",
    subtitle: "Save ₱30 on our signature dessert all week long.",
  },
  {
    id: "brewed-daily",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&h=506&fit=crop",
    title: "Brewed Daily",
    subtitle: "Locally roasted coffee, served over hand-cut ice.",
  },
];
