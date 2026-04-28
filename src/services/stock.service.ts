import { Product, StockItem, StockMovement, StockUnit } from '../types/models';
import { dbService } from './db.service';
import { expenseService } from './expense.service';
import type { CartItem } from './sale.service';

interface MovementInput {
  stock_item_id: string;
  type: StockMovement['type'];
  quantity: number;
  unit: StockUnit;
  amount: number;
  reason?: string;
  comment?: string;
  sale_id?: string;
  expense_id?: string;
  shift_id?: string;
  user_id?: string;
}

class StockService {
  private readonly allowNegativeSale = true;
  private readonly packagingCategory = 'Упаковка' as const;

  /** Сравнение названий товара и позиции «упаковка N …» (без учёта регистра). */
  private normalizeStockLabel(s: string): string {
    return s
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[\u0401]/g, 'е')
      .replace(/[.,;:!?'"«»]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Находит позицию склада категории Упаковка, соответствующую мороженому по названию
   * (например товар «2 СОМОНА» и «Упаковка 2 сомона» / то же имя).
   * Не возвращает позицию, если она уже списывается рецептом этого товара.
   */
  private async findPackagingItemForProduct(product: Product, recipeStockIds: Set<string>): Promise<StockItem | null> {
    const rows = await dbService.table('stock_items');
    const pk = this.normalizeStockLabel(product.name);
    if (!pk) return null;
    const candidates = rows.filter((i) => i.is_active && i.category === this.packagingCategory);
    for (const s of candidates) {
      if (recipeStockIds.has(s.id)) continue;
      const sk = this.normalizeStockLabel(s.name);
      if (sk === pk) return s;
      const stripped = sk.replace(/^(упаковка|упак)\s+/u, '');
      if (stripped === pk) return s;
      if (pk.length >= 3 && sk.includes(pk)) return s;
    }
    return null;
  }

  async getItems(search = '', includeInactive = false): Promise<StockItem[]> {
    const query = search.trim().toLowerCase();
    const rows = await dbService.table('stock_items');
    const all = includeInactive ? rows.slice() : rows.filter((item) => item.is_active);
    if (!query) return all;
    return all.filter((item) => item.name.toLowerCase().includes(query));
  }

  async getLowStockItems(): Promise<StockItem[]> {
    const items = await this.getItems();
    return items.filter((item) => item.quantity < item.min_quantity);
  }

  async getMovements(limit = 60): Promise<StockMovement[]> {
    const movements = await dbService.table('stock_movements');
    return movements.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
  }

  /** Все позиции склада — остаток 0 (карточки и цены закупки не трогаем). */
  async zeroAllQuantities(): Promise<void> {
    const rows = await dbService.table('stock_items');
    const now = dbService.now();
    for (const row of rows) {
      await dbService.update('stock_items', row.id, {
        quantity: 0,
        updated_at: now,
        sync_status: 'pending'
      });
    }
  }

  async updateStockItem(
    id: string,
    patch: Partial<
      Pick<
        StockItem,
        | 'name'
        | 'category'
        | 'unit'
        | 'min_quantity'
        | 'supplier'
        | 'is_active'
        | 'purchase_price'
        | 'average_cost'
      >
    >
  ): Promise<void> {
    const rows = await dbService.table('stock_items');
    const item = rows.find((i) => i.id === id);
    if (!item) {
      throw new Error('Позиция не найдена');
    }
    if (patch.name !== undefined) {
      const n = String(patch.name).trim();
      if (!n) throw new Error('Название не может быть пустым');
    }
    if (patch.min_quantity !== undefined && patch.min_quantity < 0) {
      throw new Error('Мин. остаток не может быть отрицательным');
    }
    if (patch.purchase_price !== undefined && patch.purchase_price < 0) {
      throw new Error('Цена закупки не может быть отрицательной');
    }
    if (patch.average_cost !== undefined && patch.average_cost < 0) {
      throw new Error('Средняя себестоимость не может быть отрицательной');
    }
    await dbService.update('stock_items', id, {
      ...patch,
      sync_status: 'pending'
    } as Partial<StockItem>);
  }

  async addIncome(input: {
    stockItemId: string;
    quantity: number;
    unit: StockUnit;
    totalAmount: number;
    accountId: string;
    expenseCategoryId: string;
    paymentMethod?: 'cash' | 'card' | 'transfer';
    supplier?: string;
    comment?: string;
    shiftId?: string;
    userId?: string;
  }): Promise<void> {
    if (input.totalAmount <= 0) {
      throw new Error('Сумма закупки должна быть больше 0');
    }
    if (!input.accountId) {
      throw new Error('Счёт обязателен');
    }
    if (!input.expenseCategoryId) {
      throw new Error('Категория расхода обязательна');
    }
    if (!input.userId) {
      throw new Error('Пользователь обязателен');
    }
    const item = await this.getItem(input.stockItemId);
    if (!item) return;
    const qtyInStockUnit = this.convertUnit(input.quantity, input.unit, item.unit);
    const nextQty = Number((item.quantity + qtyInStockUnit).toFixed(3));
    const currentTotalCost = item.average_cost * item.quantity;
    const nextTotalCost = currentTotalCost + input.totalAmount;
    const nextAvgCost = nextQty > 0 ? Number((nextTotalCost / nextQty).toFixed(4)) : item.average_cost;
    const nextPurchasePrice = qtyInStockUnit > 0 ? Number((input.totalAmount / qtyInStockUnit).toFixed(4)) : item.purchase_price;

    const expense = await expenseService.createExpense({
      category_id: input.expenseCategoryId,
      amount: input.totalAmount,
      payment_method: input.paymentMethod ?? 'cash',
      account_id: input.accountId,
      comment: `Закупка: ${item.name}. ${input.comment ?? ''}`.trim(),
      user_id: input.userId,
      shift_id: input.shiftId,
      expense_date: dbService.now().slice(0, 10)
    });

    await this.applyMovement({
      stock_item_id: input.stockItemId,
      type: 'income',
      quantity: Math.abs(qtyInStockUnit),
      unit: item.unit,
      amount: input.totalAmount,
      shift_id: input.shiftId,
      user_id: input.userId,
      reason: 'income',
      comment: input.comment,
      expense_id: expense.id
    });

    await dbService.update('stock_items', item.id, {
      quantity: nextQty,
      purchase_price: nextPurchasePrice,
      average_cost: nextAvgCost,
      supplier: input.supplier ?? item.supplier,
      sync_status: 'pending'
    });
  }

  async writeOff(input: {
    stockItemId: string;
    quantity: number;
    unit: StockUnit;
    reason: string;
    comment?: string;
    shiftId?: string;
    userId?: string;
  }): Promise<void> {
    const item = await this.getItem(input.stockItemId);
    if (!item) return;
    const qtyInStockUnit = this.convertUnit(input.quantity, input.unit, item.unit);
    await this.applyMovement({
      stock_item_id: input.stockItemId,
      type: 'writeoff',
      quantity: -Math.abs(qtyInStockUnit),
      unit: item.unit,
      amount: Number((Math.abs(qtyInStockUnit) * item.average_cost).toFixed(4)),
      shift_id: input.shiftId,
      user_id: input.userId,
      reason: input.reason,
      comment: input.comment
    });
  }

  async correctQuantity(input: { stockItemId: string; actualQuantity: number; unit: StockUnit; comment?: string; userId?: string }): Promise<void> {
    const item = await this.getItem(input.stockItemId);
    if (!item) return;
    const actualInStockUnit = this.convertUnit(input.actualQuantity, input.unit, item.unit);
    const diff = Number((actualInStockUnit - item.quantity).toFixed(3));
    if (diff === 0) return;
    await this.applyMovement({
      stock_item_id: item.id,
      type: 'correction',
      quantity: diff,
      unit: item.unit,
      amount: Number((Math.abs(diff) * item.average_cost).toFixed(4)),
      reason: 'correction',
      comment: input.comment,
      user_id: input.userId
    });
  }

  async runInventory(input: {
    userId: string;
    comment?: string;
    items: Array<{ stockItemId: string; actualQuantity: number; unit: StockUnit }>;
  }): Promise<void> {
    const checkId = dbService.makeId('inv');
    await dbService.insert('inventory_checks', {
      id: checkId,
      user_id: input.userId,
      comment: input.comment,
      created_at: dbService.now(),
      updated_at: dbService.now(),
      sync_status: 'pending'
    });

    for (const row of input.items) {
      const item = await this.getItem(row.stockItemId);
      if (!item) continue;
      const actual = this.convertUnit(row.actualQuantity, row.unit, item.unit);
      const diff = Number((actual - item.quantity).toFixed(3));
      await dbService.insert('inventory_check_items', {
        id: dbService.makeId('inv_item'),
        inventory_check_id: checkId,
        stock_item_id: item.id,
        system_quantity: item.quantity,
        actual_quantity: actual,
        difference: diff,
        unit: item.unit,
        created_at: dbService.now()
      });
      if (diff !== 0) {
        await this.applyMovement({
          stock_item_id: item.id,
          type: 'inventory',
          quantity: diff,
          unit: item.unit,
          amount: Number((Math.abs(diff) * item.average_cost).toFixed(4)),
          reason: 'inventory',
          comment: input.comment,
          user_id: input.userId
        });
      }
    }
  }

  async validateCartStock(cartItems: CartItem[]): Promise<{ ok: boolean; warnings: string[] }> {
    const warnings: string[] = [];
    for (const line of cartItems) {
      const requirements = await this.getRecipeConsumption(line.product.id, line.quantity);
      for (const req of requirements) {
        if (req.available + 1e-9 < req.requiredInStockUnit) {
          warnings.push(`Недостаточно ${req.stockItem.name}. Осталось ${req.available.toFixed(2)} ${req.stockItem.unit}.`);
        }
      }
    }
    if (!warnings.length) return { ok: true, warnings: [] };
    if (this.allowNegativeSale) return { ok: true, warnings };
    return { ok: false, warnings };
  }

  async calculateRecipeCost(productId: string, qty: number): Promise<number> {
    const rows = await this.getRecipeConsumption(productId, qty);
    return rows.reduce((sum, row) => sum + row.cost, 0);
  }

  async consumeByRecipe(productId: string, multiplier: number, saleId: string, shiftId: string, userId?: string): Promise<void> {
    const recipes = await dbService.table('recipes');
    const products = await dbService.table('products');
    const product = products.find((p) => p.id === productId);
    const related = recipes.filter((r) => r.product_id === productId);
    const recipeStockIds = new Set(related.map((r) => r.stock_item_id));

    for (const item of related) {
      const stockItem = await this.getItem(item.stock_item_id);
      if (!stockItem) continue;
      const qtyRecipeUnit = Number((item.quantity * multiplier).toFixed(3));
      const qtyInStockUnit = this.convertUnit(qtyRecipeUnit, item.unit, stockItem.unit);
      await this.applyMovement({
        stock_item_id: item.stock_item_id,
        type: 'sale',
        quantity: -qtyInStockUnit,
        unit: stockItem.unit,
        amount: Number((qtyInStockUnit * stockItem.average_cost).toFixed(4)),
        sale_id: saleId,
        shift_id: shiftId,
        user_id: userId,
        reason: 'sale'
      });
    }

    if (product) {
      const packaging = await this.findPackagingItemForProduct(product, recipeStockIds);
      if (packaging) {
        const qtyInStockUnit = this.convertUnit(multiplier, 'шт', packaging.unit);
        await this.applyMovement({
          stock_item_id: packaging.id,
          type: 'sale',
          quantity: -qtyInStockUnit,
          unit: packaging.unit,
          amount: Number((qtyInStockUnit * packaging.average_cost).toFixed(4)),
          sale_id: saleId,
          shift_id: shiftId,
          user_id: userId,
          reason: 'sale',
          comment: `Упаковка под товар «${product.name}»`
        });
      }
    }
  }

  private async getRecipeConsumption(productId: string, qty: number) {
    const recipes = await dbService.table('recipes');
    const stockItems = await dbService.table('stock_items');
    const products = await dbService.table('products');
    const product = products.find((p) => p.id === productId);
    const related = recipes.filter((r) => r.product_id === productId);
    const recipeStockIds = new Set(related.map((r) => r.stock_item_id));

    const base = related
      .map((r) => {
        const stockItem = stockItems.find((s) => s.id === r.stock_item_id);
        if (!stockItem) return null;
        const requiredRecipeUnit = r.quantity * qty;
        const requiredInStockUnit = this.convertUnit(requiredRecipeUnit, r.unit, stockItem.unit);
        return {
          stockItem,
          requiredInStockUnit,
          available: stockItem.quantity,
          cost: Number((requiredInStockUnit * stockItem.average_cost).toFixed(4))
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (!product) return base;

    const packaging = await this.findPackagingItemForProduct(product, recipeStockIds);
    if (!packaging) return base;

    const requiredInStockUnit = this.convertUnit(qty, 'шт', packaging.unit);
    base.push({
      stockItem: packaging,
      requiredInStockUnit,
      available: packaging.quantity,
      cost: Number((requiredInStockUnit * packaging.average_cost).toFixed(4))
    });
    return base;
  }

  private async getItem(stockItemId: string): Promise<StockItem | undefined> {
    return (await dbService.table('stock_items')).find((s) => s.id === stockItemId);
  }

  private convertUnit(quantity: number, from: StockUnit, to: StockUnit): number {
    if (from === to) return Number(quantity.toFixed(6));
    if (from === 'кг' && to === 'г') return Number((quantity * 1000).toFixed(6));
    if (from === 'г' && to === 'кг') return Number((quantity / 1000).toFixed(6));
    if (from === 'л' && to === 'мл') return Number((quantity * 1000).toFixed(6));
    if (from === 'мл' && to === 'л') return Number((quantity / 1000).toFixed(6));
    return Number(quantity.toFixed(6));
  }

  private async applyMovement(input: MovementInput): Promise<void> {
    const stockItems = await dbService.table('stock_items');
    const stock = stockItems.find((s) => s.id === input.stock_item_id);
    if (!stock) return;

    const nextQty = Number((stock.quantity + input.quantity).toFixed(3));
    await dbService.update('stock_items', stock.id, { quantity: nextQty, sync_status: 'pending' });

    const movement: StockMovement = {
      id: dbService.makeId('move'),
      stock_item_id: input.stock_item_id,
      type: input.type,
      quantity: input.quantity,
      unit: input.unit,
      amount: input.amount,
      reason: input.reason,
      comment: input.comment,
      sale_id: input.sale_id,
      expense_id: input.expense_id,
      shift_id: input.shift_id,
      user_id: input.user_id,
      created_at: dbService.now(),
      sync_status: 'pending'
    };
    await dbService.insert('stock_movements', movement);
  }
}

export const stockService = new StockService();
