import type { FoodItem } from "./types.ts";

type Row = [name: string, serving: string, kcal: number, p: number, c: number, f: number];

// Approximate values from common nutrition tables. Good enough for day-to-day tracking.
const DB: Record<string, Row[]> = {
  Protein: [
    ["Chicken breast, grilled", "100 g", 165, 31, 0, 3.6],
    ["Chicken thigh, roasted", "100 g", 209, 26, 0, 10.9],
    ["Turkey breast", "100 g", 135, 30, 0, 1],
    ["Lean beef mince (5%)", "100 g", 137, 21, 0, 5],
    ["Beef steak, sirloin", "100 g", 206, 29, 0, 9],
    ["Pork loin", "100 g", 196, 27, 0, 9],
    ["Salmon, baked", "100 g", 206, 22, 0, 12],
    ["Tuna, canned in water", "1 can (120 g)", 132, 29, 0, 1],
    ["Shrimp", "100 g", 99, 24, 0, 0.3],
    ["Egg, whole", "1 large", 72, 6.3, 0.4, 4.8],
    ["Egg whites", "100 g", 52, 11, 0.7, 0.2],
    ["Tofu, firm", "100 g", 144, 17, 3, 9],
    ["Whey protein shake", "1 scoop (30 g)", 120, 24, 3, 1.5],
    ["Lentils, cooked", "1 cup (200 g)", 230, 18, 40, 0.8],
    ["Chickpeas, cooked", "1 cup (160 g)", 269, 14.5, 45, 4.2],
  ],
  Dairy: [
    ["Greek yogurt, 0%", "170 g", 100, 17, 6, 0.7],
    ["Greek yogurt, full fat", "170 g", 165, 15, 6, 8.5],
    ["Milk, semi-skimmed", "250 ml", 122, 8.5, 12, 4.5],
    ["Milk, whole", "250 ml", 155, 8, 12, 8.5],
    ["Cottage cheese", "100 g", 98, 11, 3.4, 4.3],
    ["Cheddar cheese", "30 g", 121, 7.5, 0.4, 10],
    ["Mozzarella", "30 g", 85, 6.3, 0.7, 6.3],
  ],
  Carbs: [
    ["White rice, cooked", "1 cup (160 g)", 206, 4.3, 45, 0.4],
    ["Brown rice, cooked", "1 cup (195 g)", 216, 5, 45, 1.8],
    ["Pasta, cooked", "1 cup (140 g)", 221, 8, 43, 1.3],
    ["Oats, dry", "40 g", 152, 5.3, 27, 2.8],
    ["Bread, whole wheat", "1 slice", 81, 4, 14, 1.1],
    ["Bread, white", "1 slice", 75, 2.6, 14, 1],
    ["Bagel, plain", "1 bagel", 277, 11, 55, 1.4],
    ["Potato, baked", "1 medium (170 g)", 161, 4.3, 37, 0.2],
    ["Sweet potato, baked", "1 medium (150 g)", 135, 3, 31, 0.2],
    ["Tortilla wrap", "1 large", 210, 5.5, 35, 5],
    ["Quinoa, cooked", "1 cup (185 g)", 222, 8, 39, 3.6],
    ["Cereal, cornflakes", "30 g", 113, 2, 25, 0.3],
    ["Granola", "50 g", 230, 5, 32, 9],
  ],
  Fruit: [
    ["Banana", "1 medium", 105, 1.3, 27, 0.4],
    ["Apple", "1 medium", 95, 0.5, 25, 0.3],
    ["Orange", "1 medium", 62, 1.2, 15, 0.2],
    ["Blueberries", "1 cup (150 g)", 84, 1.1, 21, 0.5],
    ["Strawberries", "1 cup (150 g)", 48, 1, 11.5, 0.5],
    ["Grapes", "1 cup (150 g)", 104, 1.1, 27, 0.2],
    ["Mango", "1 cup (165 g)", 99, 1.4, 25, 0.6],
    ["Avocado", "1/2 fruit", 120, 1.5, 6.4, 11],
  ],
  Veg: [
    ["Broccoli", "1 cup (90 g)", 31, 2.5, 6, 0.3],
    ["Spinach", "1 cup raw (30 g)", 7, 0.9, 1.1, 0.1],
    ["Mixed salad", "1 bowl (100 g)", 20, 1.5, 3.5, 0.2],
    ["Carrots", "1 medium", 25, 0.6, 6, 0.1],
    ["Bell pepper", "1 medium", 31, 1, 6, 0.3],
    ["Green beans", "1 cup (125 g)", 44, 2.4, 10, 0.4],
    ["Mixed vegetables, frozen", "1 cup (150 g)", 80, 4, 15, 0.5],
  ],
  "Fats & nuts": [
    ["Olive oil", "1 tbsp", 119, 0, 0, 13.5],
    ["Butter", "1 tbsp", 102, 0.1, 0, 11.5],
    ["Peanut butter", "1 tbsp", 94, 3.5, 3.5, 8],
    ["Almonds", "30 g", 173, 6, 6, 15],
    ["Walnuts", "30 g", 196, 4.6, 4, 19.5],
    ["Dark chocolate (70%)", "20 g", 120, 1.6, 9, 8.5],
  ],
  Meals: [
    ["Burger with bun", "1 burger", 540, 30, 40, 29],
    ["Pizza slice, cheese", "1 slice", 285, 12, 36, 10],
    ["Chicken burrito", "1 burrito", 650, 35, 70, 24],
    ["Caesar salad with chicken", "1 bowl", 440, 35, 15, 27],
    ["Sushi roll (8 pc)", "1 roll", 300, 9, 52, 6],
    ["Spaghetti bolognese", "1 plate", 600, 30, 75, 18],
    ["Chicken curry with rice", "1 plate", 700, 35, 85, 22],
    ["Fries, medium", "1 portion", 365, 4, 48, 17],
    ["Chicken & rice bowl", "1 bowl", 550, 45, 60, 12],
    ["Omelette (3 eggs, cheese)", "1 omelette", 350, 25, 2, 27],
  ],
  "Snacks & drinks": [
    ["Protein bar", "1 bar (60 g)", 220, 20, 22, 7],
    ["Rice cakes", "2 cakes", 70, 1.4, 15, 0.5],
    ["Crisps / chips", "1 bag (30 g)", 160, 2, 15, 10],
    ["Cookie", "1 cookie", 80, 1, 11, 4],
    ["Ice cream", "1 scoop (70 g)", 140, 2.5, 16, 7.5],
    ["Popcorn, air-popped", "3 cups", 93, 3, 19, 1],
    ["Coffee, black", "1 cup", 2, 0.3, 0, 0],
    ["Latte", "1 medium", 190, 10, 15, 10],
    ["Orange juice", "250 ml", 112, 1.7, 26, 0.5],
    ["Cola", "330 ml can", 139, 0, 35, 0],
    ["Beer", "330 ml", 150, 1.6, 13, 0],
    ["Wine, red", "150 ml", 125, 0.1, 3.8, 0],
  ],
};

export const FOODS: FoodItem[] = Object.entries(DB).flatMap(([category, rows]) =>
  rows.map(([name, serving, kcal, protein, carbs, fat]) => ({
    id: `${category}:${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    serving,
    category,
    kcal,
    protein,
    carbs,
    fat,
  }))
);

export const FOOD_CATEGORIES = Object.keys(DB);

export function searchFoods(query: string, category?: string): FoodItem[] {
  const q = query.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  return FOODS.filter(
    (f) =>
      (!category || f.category === category) && terms.every((t) => f.name.toLowerCase().includes(t))
  );
}
