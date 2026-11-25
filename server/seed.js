import { all, get, run, saveSetting, transaction } from './db.js';

const UNSPLASH = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1000&q=80`;

const categories = [
  { name: 'Running Shoes', tagline: 'Engineered for the long run', icon: 'fa-person-running', sort: 1 },
  { name: 'Basketball Shoes', tagline: 'Court-ready performance', icon: 'fa-basketball', sort: 2 },
  { name: 'Casual Sneakers', tagline: 'Everyday, quietly elevated', icon: 'fa-shoe-prints', sort: 3 },
  { name: 'Skate Shoes', tagline: 'Built for the street', icon: 'fa-person-skateboarding', sort: 4 },
  { name: 'Lifestyle Sneakers', tagline: 'Statement silhouettes', icon: 'fa-star', sort: 5 },
  { name: 'Limited Edition', tagline: 'Rare pairs, numbered', icon: 'fa-gem', sort: 6 },
];

const products = [
  {
    name: 'Air Force Classic',
    brand: 'Nike',
    category: 'Casual Sneakers',
    price: 1500000,
    image: UNSPLASH('1542291026-7eec264c27ff'),
    badge: 'ICON',
    featured: 1,
    material: 'Full-grain leather, rubber cupsole',
    description:
      'Silhouette klasik yang tidak pernah kehilangan relevansi. Kulit full-grain dengan cupsole karet bersih, dibentuk untuk menemani setiap langkah harian Anda.',
    sizes: { 39: 4, 40: 6, 41: 5, 42: 2, 43: 0 },
    colors: [
      ['Signal Red', '#a83232'],
      ['Bone White', '#efe6da'],
      ['Charcoal', '#242321'],
    ],
  },
  {
    name: 'Urban Street',
    brand: 'Adidas',
    category: 'Lifestyle Sneakers',
    price: 1250000,
    image: UNSPLASH('1600185365483-26d7a4cc7519'),
    badge: 'CORE',
    featured: 1,
    material: 'Engineered mesh, suede overlays',
    description:
      'Lifestyle sneaker dengan panel mesh bertekstur dan lapisan suede. Ringan, breathable, dan mudah dipadukan dengan lemari pakaian monokrom Anda.',
    sizes: { 39: 3, 40: 5, 41: 4, 42: 3, 43: 1 },
    colors: [
      ['Cream', '#e8d9c6'],
      ['Charcoal', '#242321'],
    ],
  },
  {
    name: 'Classic Runner',
    brand: 'New Balance',
    category: 'Running Shoes',
    price: 1800000,
    image: UNSPLASH('1539185441755-769473a23570'),
    badge: 'DAILY',
    featured: 0,
    material: 'Mesh upper, EVA midsole',
    description:
      'Dirancang untuk ritme lari harian. Midsole EVA menyerap benturan dengan lembut, sementara upper mesh menjaga sirkulasi udara tetap optimal.',
    sizes: { 40: 4, 41: 6, 42: 5, 43: 3, 44: 2 },
    colors: [
      ['Fog Grey', '#9a9a98'],
      ['Chalk', '#f2ede5'],
    ],
  },
  {
    name: 'Street Culture',
    brand: 'Puma',
    category: 'Skate Shoes',
    price: 1100000,
    image: UNSPLASH('1552346154-21d32810aba3'),
    badge: '',
    featured: 0,
    material: 'Suede, vulcanised rubber',
    description:
      'Suede tebal dengan sol vulkanisir yang memberi grip maksimal di papan. Sol luar diperkuat pada area ollie untuk umur pakai lebih panjang.',
    sizes: { 39: 2, 40: 3, 41: 2, 42: 1, 43: 0 },
    colors: [
      ['Black', '#242321'],
      ['Off White', '#efe9df'],
    ],
  },
  {
    name: 'Court Legend',
    brand: 'Nike',
    category: 'Basketball Shoes',
    price: 2200000,
    image: UNSPLASH('1608231387042-66d1773070a5'),
    badge: 'COURT',
    featured: 0,
    material: 'Synthetic leather, Air cushioning',
    description:
      'Sepatu lapangan dengan struktur high-top dan bantalan udara di tumit. Traksi herringbone memberikan cengkeraman percaya diri saat berhenti mendadak.',
    sizes: { 40: 2, 41: 3, 42: 2, 43: 1, 44: 0 },
    colors: [
      ['Bone White', '#f0e9df'],
      ['Black', '#242321'],
    ],
  },
  {
    name: 'Premium Classic',
    brand: 'Converse',
    category: 'Limited Edition',
    price: 1350000,
    image: UNSPLASH('1495555961986-6d4c1ecb7be3'),
    badge: 'LIMITED',
    featured: 1,
    material: 'Heavy canvas, egret rubber',
    description:
      'Koleksi kanvas premium dengan jahitan rapat dan detail metalik. Diproduksi dalam jumlah terbatas — setiap pasang dikirim dengan dust bag khusus.',
    sizes: { 39: 1, 40: 2, 41: 1, 42: 0 },
    colors: [
      ['Black', '#242321'],
      ['Ecru', '#e4d6c1'],
    ],
  },
  {
    name: 'Velocity Pro',
    brand: 'Nike',
    category: 'Running Shoes',
    price: 2450000,
    image: UNSPLASH('1549298916-b41d501d3772'),
    badge: 'NEW',
    featured: 1,
    material: 'Flyknit upper, carbon-infused plate',
    description:
      'Pelat karbon dan upper knit satu bagian menciptakan propulsi ringan di setiap langkah. Pilihan untuk tempo run dan perlombaan jarak menengah.',
    sizes: { 40: 3, 41: 4, 42: 3, 43: 2, 44: 1, 45: 0 },
    colors: [
      ['Dust Rose', '#cfa5a0'],
      ['Midnight', '#2a2a33'],
    ],
  },
  {
    name: 'Court Vision Low',
    brand: 'Adidas',
    category: 'Basketball Shoes',
    price: 1975000,
    image: UNSPLASH('1600269452121-4f2416e55c28'),
    badge: '',
    featured: 0,
    material: 'Leather upper, rubber outsole',
    description:
      'Silhouette low-top yang mengambil bahasa desain lapangan tahun 80-an. Kulit lembut dengan aksen kontras untuk tampilan arsip yang tetap modern.',
    sizes: { 40: 2, 41: 3, 42: 3, 43: 2, 44: 1 },
    colors: [
      ['Cloud White', '#f4efe8'],
      ['Navy', '#2f3a4a'],
    ],
  },
  {
    name: 'Nomad Low',
    brand: 'Vans',
    category: 'Skate Shoes',
    price: 950000,
    image: UNSPLASH('1525966222134-fcfa99b8ae77'),
    badge: 'STREET',
    featured: 0,
    material: 'Canvas, waffle rubber sole',
    description:
      'Kanvas tahan lama dengan sol waffle khas yang fleksibel. Ringan dipakai seharian, cukup kuat untuk sesi skate spontan di kota.',
    sizes: { 38: 2, 39: 3, 40: 4, 41: 3, 42: 2, 43: 1 },
    colors: [
      ['Black', '#242321'],
      ['Sand', '#d8c3ac'],
    ],
  },
  {
    name: 'Retro Court 90',
    brand: 'Puma',
    category: 'Lifestyle Sneakers',
    price: 1650000,
    image: UNSPLASH('1605348532760-6753d2c43329'),
    badge: 'ARCHIVE',
    featured: 0,
    material: 'Nubuck, mesh tongue',
    description:
      'Reinterpretasi sepatu lapangan era 90-an dengan proporsi chunky. Nubuck bertekstur dan lidah mesh memberi karakter retro yang tegas.',
    sizes: { 39: 2, 40: 2, 41: 2, 42: 1, 43: 1, 44: 0 },
    colors: [
      ['Mauve', '#8a6b7b'],
      ['Bone', '#e9dfd0'],
    ],
  },
  {
    name: 'Atelier Ivory',
    brand: 'New Balance',
    category: 'Limited Edition',
    price: 2850000,
    image: UNSPLASH('1584735175315-9d5df23860e6'),
    badge: 'NUMBERED',
    featured: 1,
    material: 'Italian leather, suede trims',
    description:
      'Edisi bernomor dengan kulit Italia dan trim suede. Dirakit terbatas bersama pengrajin atelier, menghadirkan kemewahan yang tenang.',
    sizes: { 40: 1, 41: 1, 42: 1, 43: 0 },
    colors: [
      ['Ivory', '#efe7d8'],
      ['Mushroom', '#b8a79a'],
    ],
  },
  {
    name: 'Everyday Canvas',
    brand: 'Converse',
    category: 'Casual Sneakers',
    price: 780000,
    image: UNSPLASH('1595950653106-6c9ebd614d3a'),
    badge: '',
    featured: 0,
    material: 'Cotton canvas, rubber toe cap',
    description:
      'Sepatu kanvas ringan untuk ritme kota yang santai. Toe cap karet dan jahitan kontras membuatnya tetap rapi setelah dipakai berkali-kali.',
    sizes: { 37: 2, 38: 3, 39: 4, 40: 5, 41: 4, 42: 2, 43: 1 },
    colors: [
      ['Natural', '#e6ddcf'],
      ['Black', '#242321'],
    ],
  },
];

const settings = {
  store_name: 'SneakerSpace',
  store_tagline: 'Discover your style. Define your steps.',
  logo_text: 'SNEAKERSPACE',
  whatsapp: '6282122190680',
  whatsapp_display: '0821 2219 0680',
  email: 'hello@sneakerspace.com',
  instagram: '@sneakerspace',
  address: 'Jl. Senopati No. 24, Kebayoran Baru, Jakarta Selatan',
  hours: 'Senin – Sabtu · 10.00 – 21.00 WIB',
  announcement:
    'FREE DELIVERY JABODETABEK · 100% AUTHENTIC · NEW DROP EVERY FRIDAY · SHOWROOM OPEN BY APPOINTMENT',
  hero_eyebrow: 'THE ART OF EVERYDAY STYLE — AW26',
  hero_title: 'FIND YOUR OWN STEP.',
  hero_subtitle:
    'Sebuah showroom digital untuk sneaker yang layak Anda kenakan. Silhouette terkurasi, material terpilih, dan pasangan yang benar-benar mewakili langkah Anda.',
  hero_image: UNSPLASH('1549298916-b41d501d3772'),
  banner_image: UNSPLASH('1606107557195-0e29a4b5b4aa'),
  about_title: 'STEP INTO YOUR WORLD.',
  about_text:
    'SneakerSpace lahir dari keyakinan sederhana: sepasang sepatu bukan sekadar alas kaki, melainkan pernyataan tentang siapa Anda. Kami mengurasi setiap silhouette dari merek-merek yang kami percaya, memastikan keaslian, kenyamanan, dan karakter yang tidak lekang waktu.',
};

export function seedDatabase({ force = false } = {}) {
  const categoryCount = get('SELECT COUNT(*) AS total FROM categories').total;
  if (!categoryCount || force) {
    transaction(() => {
      for (const category of categories) {
        const slug = category.name.toLowerCase().replace(/\s+/g, '-');
        const existing = get('SELECT id FROM categories WHERE name = ?', category.name);
        if (!existing) {
          run(
            'INSERT INTO categories (name, slug, tagline, icon, sort_order) VALUES (?, ?, ?, ?, ?)',
            category.name,
            slug,
            category.tagline,
            category.icon,
            category.sort
          );
        }
      }

      if (get('SELECT COUNT(*) AS total FROM products').total === 0) {
        for (const item of products) {
          const category = get('SELECT id FROM categories WHERE name = ?', item.category);
          const stock = Object.values(item.sizes).reduce((sum, value) => sum + value, 0);
          const inserted = run(
            `INSERT INTO products (name, brand, category_id, price, image, description, material, stock, status, badge, featured)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
            item.name,
            item.brand,
            category.id,
            item.price,
            item.image,
            item.description,
            item.material,
            stock,
            item.badge,
            item.featured
          );
          const productId = Number(inserted.lastInsertRowid);
          for (const [size, qty] of Object.entries(item.sizes)) {
            run(
              'INSERT INTO product_sizes (product_id, size, stock) VALUES (?, ?, ?)',
              productId,
              Number(size),
              qty
            );
          }
          for (const [name, hex] of item.colors) {
            run(
              'INSERT INTO product_colors (product_id, name, hex) VALUES (?, ?, ?)',
              productId,
              name,
              hex
            );
          }
        }
      }
    });
  }

  const currentSettings = all('SELECT key FROM settings');
  const existingKeys = new Set(currentSettings.map((row) => row.key));
  for (const [key, value] of Object.entries(settings)) {
    if (!existingKeys.has(key)) saveSetting(key, value);
  }
}

export { categories, products, settings };
