import { PaymentMethod, Product, Sale, SaleItem } from '../types/models';
import { accountService } from './account.service';
import { dbService } from './db.service';
import { shiftService } from './shift.service';
import { stockService } from './stock.service';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CompleteSaleInput {
  userId: string;
  shiftId: string;
  items: CartItem[];
  discount: number;
  paymentMethod: PaymentMethod;
  paymentBreakdown?: { cash: number; card: number; transfer: number };
  /** Один счёт для не-смешанной оплаты (обязателен) */
  accountId: string;
  /** Для mixed: счета по каналам */
  accountIdsMixed?: { cash: string; card: string; transfer: string };
}

class SaleService {
  async createSale(input: CompleteSaleInput): Promise<Sale> {
    if (input.paymentMethod === 'mixed') {
      if (!input.paymentBreakdown || !input.accountIdsMixed) {
        throw new Error('Укажите счета и разбивку для смешанной оплаты');
      }
    } else if (!input.accountId) {
      throw new Error('Выберите счёт для зачисления выручки');
    }

    const stockCheck = await stockService.validateCartStock(input.items);
    if (!stockCheck.ok) {
      throw new Error(stockCheck.warnings[0] ?? 'Недостаточно остатков на складе');
    }

    const totalBeforeDiscount = input.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const finalTotal = Math.max(0, Number((totalBeforeDiscount - input.discount).toFixed(2)));
    const receiptNumber = await this.nextReceiptNumber();

    const saleId = dbService.makeId('sale');
    const primaryAccountId =
      input.paymentMethod === 'mixed'
        ? input.accountIdsMixed?.cash ?? input.accountId ?? input.accountIdsMixed?.card ?? input.accountIdsMixed?.transfer ?? ''
        : input.accountId;

    const sale: Sale = {
      id: saleId,
      receipt_number: receiptNumber,
      user_id: input.userId,
      shift_id: input.shiftId,
      total_amount: finalTotal,
      discount: input.discount,
      payment_method: input.paymentMethod,
      payment_breakdown: input.paymentBreakdown,
      primary_account_id: primaryAccountId || undefined,
      created_at: dbService.now(),
      sync_status: 'pending'
    };
    await dbService.insert('sales', sale);

    for (const item of input.items) {
      const recipeCost = await stockService.calculateRecipeCost(item.product.id, item.quantity);
      const saleItem: SaleItem = {
        id: dbService.makeId('item'),
        sale_id: saleId,
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
        total: Number((item.product.price * item.quantity).toFixed(2)),
        cost_total: Number(recipeCost.toFixed(2)),
        created_at: dbService.now(),
        sync_status: 'pending'
      };
      await dbService.insert('sale_items', saleItem);
      await stockService.consumeByRecipe(item.product.id, item.quantity, saleId, input.shiftId, input.userId);
    }

    if (input.paymentMethod === 'mixed' && input.paymentBreakdown) {
      if (input.paymentBreakdown.cash > 0) await shiftService.applySaleTotals(input.shiftId, 'cash', input.paymentBreakdown.cash);
      if (input.paymentBreakdown.card > 0) await shiftService.applySaleTotals(input.shiftId, 'card', input.paymentBreakdown.card);
      if (input.paymentBreakdown.transfer > 0) await shiftService.applySaleTotals(input.shiftId, 'transfer', input.paymentBreakdown.transfer);
    } else {
      await shiftService.applySaleTotals(input.shiftId, input.paymentMethod as 'cash' | 'card' | 'transfer', finalTotal);
    }

    const portions = this.buildSalePortions(input, finalTotal);
    if (!portions.length) {
      throw new Error('Не удалось распределить оплату по счетам');
    }
    await accountService.recordSaleIncome({
      saleId,
      shiftId: input.shiftId,
      userId: input.userId,
      receiptLabel: `#${receiptNumber}`,
      portions
    });

    return sale;
  }

  private buildSalePortions(
    input: CompleteSaleInput,
    finalTotal: number
  ): Array<{ accountId: string; amount: number; method: 'cash' | 'card' | 'transfer' }> {
    if (input.paymentMethod === 'mixed' && input.paymentBreakdown && input.accountIdsMixed) {
      const br = input.paymentBreakdown;
      const acc = input.accountIdsMixed;
      const out: Array<{ accountId: string; amount: number; method: 'cash' | 'card' | 'transfer' }> = [];
      if (br.cash > 0 && acc.cash) out.push({ accountId: acc.cash, amount: Number(br.cash.toFixed(2)), method: 'cash' });
      if (br.card > 0 && acc.card) out.push({ accountId: acc.card, amount: Number(br.card.toFixed(2)), method: 'card' });
      if (br.transfer > 0 && acc.transfer) out.push({ accountId: acc.transfer, amount: Number(br.transfer.toFixed(2)), method: 'transfer' });
      const sum = out.reduce((s, p) => s + p.amount, 0);
      if (Math.abs(sum - finalTotal) > 0.02) {
        throw new Error('Суммы смешанной оплаты должны совпадать с итогом чека');
      }
      return out;
    }
    const method = input.paymentMethod as 'cash' | 'card' | 'transfer';
    return [{ accountId: input.accountId, amount: finalTotal, method }];
  }

  async getSaleWithItems(saleId: string): Promise<{ sale: Sale; items: SaleItem[] } | null> {
    const sales = await dbService.table('sales');
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return null;
    const items = (await dbService.table('sale_items')).filter((si) => si.sale_id === saleId);
    return { sale, items };
  }

  async listSalesByDate(dateStr: string): Promise<Sale[]> {
    const sales = await dbService.table('sales');
    return sales.filter((s) => s.created_at.slice(0, 10) === dateStr);
  }

  private async nextReceiptNumber(): Promise<string> {
    const sales = await dbService.table('sales');
    const next = sales.length + 1;
    return next.toString().padStart(6, '0');
  }
}

export const saleService = new SaleService();
