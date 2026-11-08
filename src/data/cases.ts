import { EDGE } from "../lib/math";

export type Loot = {
  id: string;
  name: string;
  worth: number;
};

export type CaseDrop = {
  weight: number;
  item: Loot;
};

export type LootCase = {
  id: string;
  name: string;
  price: number;
  drops: CaseDrop[];
};

type Item = {
  id: string;
  name: string;
  worth: number;
  weight: number;
};

function build(id: string, name: string, items: Item[]): LootCase {
  const weight = items.reduce((sum, item) => sum + item.weight, 0);
  const ev = items.reduce((sum, item) => sum + item.worth * item.weight, 0) / weight;
  const price = Math.round((ev / (1 - EDGE)) * 100) / 100;
  return {
    id,
    name,
    price,
    drops: items.map((item) => ({
      weight: item.weight,
      item: { id: item.id, name: item.name, worth: item.worth },
    })),
  };
}

export const CASES: LootCase[] = [
  build("apple-box", "Apple Box", [
    { id: "white-brick", name: "Apple Charger", worth: 3, weight: 26 },
    { id: "white-stylus", name: "Apple Pencil", worth: 5, weight: 20 },
    { id: "pod-case", name: "Apple Buds", worth: 8, weight: 16 },
    { id: "white-keys", name: "Apple Keyboard", worth: 12, weight: 14 },
    { id: "band-watch", name: "Apple Watch", worth: 22, weight: 12 },
    { id: "white-tablet", name: "Apple Tablet", worth: 35, weight: 7 },
    { id: "phone-box", name: "Apple Phone", worth: 48, weight: 4 },
    { id: "silver-laptop", name: "Apple Laptop", worth: 80, weight: 1 },
  ]),
  build("car-case", "Car Case", [
    { id: "car-city", name: "City Car", worth: 6, weight: 28 },
    { id: "car-sedan", name: "Silver Sedan", worth: 10, weight: 24 },
    { id: "car-suv", name: "Family SUV", worth: 15, weight: 20 },
    { id: "car-coupe", name: "Coupe", worth: 22, weight: 16 },
    { id: "car-sports", name: "Sports Car", worth: 38, weight: 9 },
    { id: "car-super", name: "Supercar", worth: 75, weight: 3 },
  ]),
  build("nike-box", "Nike Box", [
    { id: "white-sneakers", name: "White Nike", worth: 5, weight: 45 },
    { id: "black-sneakers", name: "Black Nike", worth: 8, weight: 35 },
    { id: "red-runners", name: "Red Nike", worth: 14, weight: 20 },
  ]),
  build("ps5-case", "PS5 Case", [
    { id: "black-speaker", name: "PS5 Speaker", worth: 4, weight: 30 },
    { id: "studio-cans", name: "PS5 Headset", worth: 8, weight: 28 },
    { id: "handheld", name: "PS5 Handheld", worth: 12, weight: 22 },
    { id: "compact-cam", name: "PS5 Camera", worth: 18, weight: 12 },
    { id: "black-cube", name: "PS5 Console", worth: 40, weight: 8 },
  ]),
  build("watch-case", "Watch Case", [
    { id: "rubber-sport", name: "Sport Watch", worth: 6, weight: 32 },
    { id: "steel-sport", name: "Steel Watch", worth: 12, weight: 28 },
    { id: "dive-blue", name: "Dive Watch", worth: 20, weight: 20 },
    { id: "gold-dress", name: "Gold Watch", worth: 36, weight: 14 },
    { id: "moonphase", name: "Moonphase Watch", worth: 70, weight: 6 },
  ]),
  build("jewelry-case", "Jewelry Case", [
    { id: "cufflinks", name: "Cufflinks", worth: 4, weight: 30 },
    { id: "gold-bangle", name: "Gold Bangle", worth: 8, weight: 26 },
    { id: "gold-chain", name: "Gold Chain", worth: 16, weight: 22 },
    { id: "pearls", name: "Pearls", worth: 28, weight: 14 },
    { id: "solitaire", name: "Solitaire Ring", worth: 55, weight: 8 },
  ]),
  build("shoe-box", "Random Shoe Box", [
    { id: "leather-belt", name: "Belt", worth: 1, weight: 30 },
    { id: "sunglasses", name: "Shades", worth: 2, weight: 25 },
    { id: "white-sneakers", name: "White Pair", worth: 3, weight: 25 },
    { id: "black-sneakers", name: "Black Pair", worth: 4, weight: 15 },
    { id: "red-runners", name: "Red Pair", worth: 6, weight: 5 },
  ]),
  build("gift-box", "Gift Box", [
    { id: "navy-tie", name: "Silk Tie", worth: 1, weight: 40 },
    { id: "wallet", name: "Wallet", worth: 2, weight: 30 },
    { id: "gold-pen", name: "Fountain Pen", worth: 5, weight: 18 },
    { id: "perfume", name: "Perfume", worth: 8, weight: 10 },
    { id: "champagne", name: "Champagne", worth: 14, weight: 2 },
  ]),
  build("camera-case", "Camera Case", [
    { id: "binoculars", name: "Binoculars", worth: 6, weight: 30 },
    { id: "compact-cam", name: "Compact Camera", worth: 12, weight: 35 },
    { id: "vintage-cam", name: "Vintage Camera", worth: 20, weight: 25 },
    { id: "mini-drone", name: "Mini Drone", worth: 36, weight: 10 },
  ]),
  build("gold-case", "Gold Case", [
    { id: "gold-pen", name: "Gold Pen", worth: 8, weight: 8 },
    { id: "coin-stack", name: "Gold Coins", worth: 10, weight: 42 },
    { id: "decanter", name: "Decanter", worth: 18, weight: 28 },
    { id: "gold-bar", name: "Gold Bar", worth: 40, weight: 22 },
  ]),
];

export function caseImage(id: string) {
  return `/cases/${id}.jpg`;
}
