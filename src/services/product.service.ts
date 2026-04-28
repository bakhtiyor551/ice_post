import { Category, Product } from '../types/models';
import { dbService } from './db.service';

class ProductService {
  async listCategories(): Promise<Category[]> {
    return dbService.table('categories');
  }

  async listProducts(): Promise<Product[]> {
    return dbService.table('products');
  }

  async listActiveProducts(): Promise<Product[]> {
    const products = await dbService.table('products');
    return products.filter((p) => p.is_active);
  }

  async updateProduct(
    id: string,
    patch: Partial<Pick<Product, 'name' | 'price' | 'cost_price' | 'category_id' | 'is_active'>>
  ): Promise<void> {
    const rows = await dbService.table('products');
    if (!rows.find((p) => p.id === id)) throw new Error('Товар не найден');
    if (patch.name !== undefined) {
      const n = String(patch.name).trim();
      if (!n) throw new Error('Название не может быть пустым');
    }
    if (patch.price !== undefined && patch.price < 0) throw new Error('Цена не может быть отрицательной');
    if (patch.cost_price !== undefined && patch.cost_price < 0) throw new Error('Себестоимость не может быть отрицательной');
    const out: Record<string, unknown> = { sync_status: 'pending' };
    if (patch.name !== undefined) out.name = String(patch.name).trim();
    if (patch.price !== undefined) out.price = patch.price;
    if (patch.cost_price !== undefined) out.cost_price = patch.cost_price;
    if (patch.category_id !== undefined) out.category_id = patch.category_id;
    if (patch.is_active !== undefined) out.is_active = patch.is_active;
    await dbService.update('products', id, out as Partial<Product>);
  }

  async saveProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'sync_status'>): Promise<void> {
    const now = dbService.now();
    await dbService.insert('products', {
      ...product,
      id: dbService.makeId('prod'),
      created_at: now,
      updated_at: now,
      sync_status: 'pending'
    });
  }
}

export const productService = new ProductService();
