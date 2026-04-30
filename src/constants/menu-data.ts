import type { MenuItem } from "@/types";

export const MENU_ITEMS: MenuItem[] = [
  // Meals
  {
    id: "meal-1",
    name: "Grilled Chicken Bowl",
    price: 249,
    image:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    category: "meals",
    description:
      "Tender grilled chicken served over steamed rice with fresh vegetables and our signature sauce.",
    topPick: true,
  },
  {
    id: "meal-2",
    name: "Beef Sinigang",
    price: 299,
    image:
      "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=400&h=300&fit=crop",
    category: "meals",
    description:
      "Classic Filipino sour soup with tender beef short ribs, vegetables, and tamarind broth.",
    topPick: true,
  },
  {
    id: "meal-3",
    name: "Pork Adobo",
    price: 229,
    image:
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
    category: "meals",
    description:
      "Braised pork in soy sauce and vinegar with garlic and bay leaves. Served with steamed rice.",
    topPick: true,
    options: [
      {
        id: "rice",
        name: "Add Rice",
        type: "single",
        choices: [
          { id: "plain-rice", name: "Plain rice", priceDelta: 15 },
          { id: "garlic-rice", name: "Garlic rice", priceDelta: 20 },
        ],
      },
    ],
  },
  // Drinks
  {
    id: "drink-1",
    name: "Mango Shake",
    price: 99,
    image:
      "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=400&h=300&fit=crop",
    category: "drinks",
    description:
      "Fresh Philippine mango blended with ice and milk for a creamy tropical treat.",
    options: [
      {
        id: "size",
        name: "Size",
        type: "single",
        required: true,
        choices: [
          { id: "regular", name: "Regular" },
          { id: "large", name: "Large", priceDelta: 30 },
        ],
      },
    ],
  },
  {
    id: "drink-2",
    name: "Iced Coffee",
    price: 89,
    image:
      "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop",
    category: "drinks",
    description:
      "Locally roasted coffee served over ice with your choice of milk or black.",
    topPick: true,
  },
  {
    id: "drink-3",
    name: "Calamansi Juice",
    price: 69,
    image:
      "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&h=300&fit=crop",
    category: "drinks",
    description:
      "Freshly squeezed calamansi with a touch of honey. Refreshing and vitamin-packed.",
  },
  // Desserts
  {
    id: "dessert-1",
    name: "Leche Flan",
    price: 89,
    image:
      "https://images.unsplash.com/photo-1528975604071-b4dc52a2d18c?w=400&h=300&fit=crop",
    category: "desserts",
    description:
      "Silky smooth caramel custard, a classic Filipino dessert made with egg yolks and condensed milk.",
  },
  {
    id: "dessert-2",
    name: "Halo-Halo",
    price: 129,
    image: "/images/halo-halo.png",
    category: "desserts",
    description:
      "Shaved ice with sweet beans, jellies, fruits, leche flan, ube ice cream, and evaporated milk.",
  },
  {
    id: "dessert-3",
    name: "Ube Cheesecake",
    price: 149,
    image:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=300&fit=crop",
    category: "desserts",
    description:
      "Creamy cheesecake infused with purple yam, topped with a vibrant ube glaze.",
  },
  // Sides
  {
    id: "side-1",
    name: "Garlic Rice",
    price: 49,
    image:
      "https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=400&h=300&fit=crop",
    category: "sides",
    description:
      "Fragrant fried rice with crispy garlic bits. The perfect companion to any meal.",
  },
  {
    id: "side-2",
    name: "Lumpia Shanghai",
    price: 99,
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop",
    category: "sides",
    description:
      "Crispy fried spring rolls filled with seasoned ground pork and vegetables. Served with sweet chili sauce.",
    inStock: false,
  },
  {
    id: "side-3",
    name: "Fresh Garden Salad",
    price: 79,
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
    category: "sides",
    description:
      "Mixed greens with cherry tomatoes, cucumber, and a light vinaigrette dressing.",
  },
];
