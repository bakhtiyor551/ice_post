import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton
} from '@ionic/react';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';
import { DailyReport, ExpenseReport, LossReportRow, ProductReportRow, ReportAlert, reportService, StockReport } from '../services/report.service';

interface CashierReportRow {
  user_id: string;
  user_name: string;
  sales: number;
  checks: number;
  avg_check: number;
}

type ReportTab = 'daily' | 'products' | 'expenses' | 'stock' | 'salary' | 'cashiers' | 'profit' | 'losses' | 'payments';

const ReportsPage: React.FC = () => {
  const [tab, setTab] = useState<ReportTab>('daily');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [dailyData, setDailyData] = useState<DailyReport>({
    totalSales: 0,
    cogs: 0,
    totalExpenses: 0,
    totalSalary: 0,
    grossProfit: 0,
    netProfit: 0,
    payments: { cash: 0, card: 0, transfer: 0 },
    checksCount: 0,
    avgCheck: 0
  });
  const [productsData, setProductsData] = useState<ProductReportRow[]>([]);
  const [expensesData, setExpensesData] = useState<ExpenseReport>({ rows: [], byCategory: [] });
  const [stockData, setStockData] = useState<StockReport>({ items: [], low: [] });
  const [salaryData, setSalaryData] = useState<Array<Record<string, number | string>>>([]);
  const [cashiersData, setCashiersData] = useState<CashierReportRow[]>([]);
  const [profitData, setProfitData] = useState({ revenue: 0, cogs: 0, expenses: 0, salary: 0, net_profit: 0 });
  const [lossesData, setLossesData] = useState<LossReportRow[]>([]);
  const [paymentsData, setPaymentsData] = useState({ cash: 0, card: 0, transfer: 0 });
  const [alerts, setAlerts] = useState<ReportAlert[]>([]);

  const dateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    setPeriodStart(dateStr);
    setPeriodEnd(dateStr);
  }, [dateStr]);

  const applyPreset = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
    const now = new Date();
    if (preset === 'today') {
      const d = now.toISOString().slice(0, 10);
      setPeriodStart(d);
      setPeriodEnd(d);
      return;
    }
    if (preset === 'yesterday') {
      const y = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
      setPeriodStart(y);
      setPeriodEnd(y);
      return;
    }
    if (preset === 'week') {
      const start = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
      setPeriodStart(start);
      setPeriodEnd(now.toISOString().slice(0, 10));
      return;
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  const load = useCallback(async () => {
    if (!periodStart || !periodEnd) return;
    setDailyData(await reportService.daily(periodEnd));
    setProductsData(await reportService.products(periodStart, periodEnd));
    setExpensesData(await reportService.expenses(periodStart, periodEnd));
    setStockData(await reportService.stock());
    setSalaryData(await reportService.salary(periodStart, periodEnd));
    setCashiersData(await reportService.cashiers(periodStart, periodEnd));
    setProfitData(await reportService.profit(periodStart, periodEnd));
    setLossesData(await reportService.losses(periodStart, periodEnd));
    setPaymentsData(await reportService.payments(periodStart, periodEnd));
    setAlerts(await reportService.alerts(periodStart, periodEnd));
  }, [periodEnd, periodStart]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = () => {
    let csv = '';
    if (tab === 'products') {
      csv = `Товар,Количество,Продажи,Себестоимость,Прибыль\n${productsData.map((r) => `${r.name},${r.quantity},${r.sales},${r.cogs},${r.profit}`).join('\n')}`;
    } else if (tab === 'expenses') {
      csv = `Категория,Сумма\n${expensesData.byCategory.map((r) => `${r.category_id},${r.amount}`).join('\n')}`;
    } else if (tab === 'cashiers') {
      csv = `Кассир,Продажи,Чеки,Средний чек\n${cashiersData.map((r) => `${r.user_name},${r.sales},${r.checks},${r.avg_check}`).join('\n')}`;
    } else if (tab === 'salary') {
      csv = `Кассир,Дней,Начислено,Бонусы,Штрафы,Выплачено,Остаток\n${salaryData.map((r) => `${r.user_name},${r.worked_days},${r.daily_salary_total},${r.bonus_total},${r.penalty_total},${r.payout_total},${r.balance}`).join('\n')}`;
    } else {
      csv = `Показатель,Сумма\nВыручка,${profitData.revenue}\nСебестоимость,${profitData.cogs}\nРасходы,${profitData.expenses}\nЗарплата,${profitData.salary}\nЧистая прибыль,${profitData.net_profit}`;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${tab}-${periodStart}-${periodEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildSummaryText = (): string => {
    if (tab === 'daily') {
      return `Отчет за день ${periodEnd}
Продажи: ${dailyData.totalSales.toFixed(2)}
Себестоимость: ${dailyData.cogs.toFixed(2)}
Расходы: ${dailyData.totalExpenses.toFixed(2)}
Зарплата: ${dailyData.totalSalary.toFixed(2)}
Чистая прибыль: ${dailyData.netProfit.toFixed(2)}`;
    }
    if (tab === 'payments') {
      return `Оплаты за период ${periodStart} - ${periodEnd}
Наличные: ${paymentsData.cash.toFixed(2)}
Карта: ${paymentsData.card.toFixed(2)}
Перевод: ${paymentsData.transfer.toFixed(2)}`;
    }
    return `Отчет ${tab} за период ${periodStart} - ${periodEnd}
Выручка: ${profitData.revenue.toFixed(2)}
Себестоимость: ${profitData.cogs.toFixed(2)}
Расходы: ${profitData.expenses.toFixed(2)}
Зарплата: ${profitData.salary.toFixed(2)}
Чистая прибыль: ${profitData.net_profit.toFixed(2)}`;
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    const lines = buildSummaryText().split('\n');
    doc.setFontSize(12);
    let y = 16;
    for (const line of lines) {
      doc.text(line, 14, y);
      y += 8;
    }
    doc.save(`report-${tab}-${periodStart}-${periodEnd}.pdf`);
  };

  const shareReport = async () => {
    const text = buildSummaryText();
    await Share.share({
      title: `Отчет ${tab}`,
      text,
      dialogTitle: 'Отправить в Telegram / WhatsApp'
    });
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Фильтр периода</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel position="stacked">Начало</IonLabel>
              <IonInput type="date" value={periodStart} onIonInput={(e) => setPeriodStart(String(e.detail.value ?? ''))} />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Конец</IonLabel>
              <IonInput type="date" value={periodEnd} onIonInput={(e) => setPeriodEnd(String(e.detail.value ?? ''))} />
            </IonItem>
            <div className="ice-filter-actions">
              <IonButton size="small" fill="outline" onClick={() => applyPreset('today')}>Сегодня</IonButton>
              <IonButton size="small" fill="outline" onClick={() => applyPreset('yesterday')}>Вчера</IonButton>
              <IonButton size="small" fill="outline" onClick={() => applyPreset('week')}>Неделя</IonButton>
              <IonButton size="small" fill="outline" onClick={() => applyPreset('month')}>Месяц</IonButton>
              <IonButton size="small" onClick={load}>Обновить</IonButton>
              <IonButton size="small" color="success" onClick={exportCsv}>Экспорт CSV</IonButton>
              <IonButton size="small" color="tertiary" onClick={exportPdf}>Экспорт PDF</IonButton>
              <IonButton size="small" color="primary" onClick={shareReport}>Поделиться</IonButton>
            </div>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Уведомления</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonList>
              {alerts.map((alert, idx) => (
                <IonItem key={`${alert.type}-${idx}`}>
                  <IonLabel>⚠ {alert.message}</IonLabel>
                </IonItem>
              ))}
              {alerts.length === 0 && (
                <IonItem lines="none">
                  <IonLabel>Критичных уведомлений нет</IonLabel>
                </IonItem>
              )}
            </IonList>
          </IonCardContent>
        </IonCard>

        <div className="ice-scroll-segment ion-margin-bottom">
          <IonSegment scrollable value={tab} onIonChange={(e) => setTab(e.detail.value as ReportTab)}>
            <IonSegmentButton value="daily"><IonLabel>День</IonLabel></IonSegmentButton>
            <IonSegmentButton value="products"><IonLabel>Товары</IonLabel></IonSegmentButton>
            <IonSegmentButton value="payments"><IonLabel>Оплаты</IonLabel></IonSegmentButton>
            <IonSegmentButton value="expenses"><IonLabel>Расходы</IonLabel></IonSegmentButton>
            <IonSegmentButton value="stock"><IonLabel>Склад</IonLabel></IonSegmentButton>
            <IonSegmentButton value="losses"><IonLabel>Потери</IonLabel></IonSegmentButton>
            <IonSegmentButton value="salary"><IonLabel>Зарплата</IonLabel></IonSegmentButton>
            <IonSegmentButton value="cashiers"><IonLabel>Кассиры</IonLabel></IonSegmentButton>
            <IonSegmentButton value="profit"><IonLabel>Прибыль</IonLabel></IonSegmentButton>
          </IonSegment>
        </div>

        {tab === 'daily' && (
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Отчёт за {dateStr}</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem lines="none">
              <IonLabel>Продажи: {dailyData.totalSales.toFixed(2)} смн</IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Себестоимость: {dailyData.cogs.toFixed(2)} смн</IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Расходы: {dailyData.totalExpenses.toFixed(2)} смн</IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Зарплата: {dailyData.totalSalary.toFixed(2)} смн</IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Валовая прибыль: {dailyData.grossProfit.toFixed(2)} смн</IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Чистая прибыль: {dailyData.netProfit.toFixed(2)} смн</IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Наличные: {dailyData.payments.cash.toFixed(2)} | Карта: {dailyData.payments.card.toFixed(2)} | Перевод: {dailyData.payments.transfer.toFixed(2)}</IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Чеков: {dailyData.checksCount} | Средний чек: {dailyData.avgCheck.toFixed(2)} смн</IonLabel>
            </IonItem>
          </IonCardContent>
        </IonCard>
        )}

        {tab === 'products' && (
          <IonCard>
            <IonCardHeader><IonCardTitle>По товарам</IonCardTitle></IonCardHeader>
            <IonCardContent>
              <IonList>
                {productsData.map((p) => (
                  <IonItem key={String(p.product_id)}>
                    <IonLabel>{String(p.name)} - {Number(p.quantity).toFixed(2)} шт - {Number(p.sales).toFixed(2)} смн (прибыль {Number(p.profit).toFixed(2)})</IonLabel>
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>
        )}

        {tab === 'payments' && (
          <IonCard>
            <IonCardHeader><IonCardTitle>По оплатам</IonCardTitle></IonCardHeader>
            <IonCardContent>
              <IonItem lines="none"><IonLabel>Наличные: {paymentsData.cash.toFixed(2)} смн</IonLabel></IonItem>
              <IonItem lines="none"><IonLabel>Карта: {paymentsData.card.toFixed(2)} смн</IonLabel></IonItem>
              <IonItem lines="none"><IonLabel>Перевод: {paymentsData.transfer.toFixed(2)} смн</IonLabel></IonItem>
            </IonCardContent>
          </IonCard>
        )}

        {tab === 'expenses' && (
          <IonCard>
            <IonCardHeader><IonCardTitle>По расходам</IonCardTitle></IonCardHeader>
            <IonCardContent>
              <IonList>
                {expensesData.byCategory.map((e) => (
                  <IonItem key={String(e.category_id)}>
                    <IonLabel>{String(e.category_id)} - {Number(e.amount).toFixed(2)} смн</IonLabel>
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>
        )}

        {tab === 'stock' && (
          <IonCard>
            <IonCardHeader><IonCardTitle>По складу</IonCardTitle></IonCardHeader>
            <IonCardContent>
              <IonList>
                {stockData.items.map((i) => (
                  <IonItem key={String(i.id)}>
                    <IonLabel>{String(i.name)}: {Number(i.quantity).toFixed(2)} {String(i.unit)}</IonLabel>
                  </IonItem>
                ))}
              </IonList>
              <IonCardTitle>Низкий остаток</IonCardTitle>
              <IonList>
                {stockData.low.map((i) => (
                  <IonItem key={`low-${String(i.id)}`}>
                    <IonLabel>⚠ {String(i.name)} — {Number(i.quantity).toFixed(2)} {String(i.unit)} (мин {Number(i.min_quantity).toFixed(2)})</IonLabel>
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>
        )}

        {tab === 'losses' && (
          <IonCard>
            <IonCardHeader><IonCardTitle>По потерям</IonCardTitle></IonCardHeader>
            <IonCardContent>
              <IonList>
                {lossesData.map((l, idx) => (
                  <IonItem key={`${String(l.stock_item_id)}-${idx}`}>
                    <IonLabel>{String(l.name)}: {Number(l.quantity).toFixed(2)} {String(l.unit)} - {String(l.reason)} - {Number(l.amount).toFixed(2)} смн</IonLabel>
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>
        )}

        {tab === 'salary' && (
          <IonCard>
            <IonCardHeader><IonCardTitle>По зарплате</IonCardTitle></IonCardHeader>
            <IonCardContent>
              <IonList>
                {salaryData.map((s) => (
                  <IonItem key={String(s.user_id)}>
                    <IonLabel>{String(s.user_name)}: {Number(s.worked_days)} дней, начислено {Number(s.final_salary).toFixed(2)}, выплачено {Number(s.payout_total).toFixed(2)}, остаток {Number(s.balance).toFixed(2)}</IonLabel>
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>
        )}

        {tab === 'cashiers' && (
          <IonCard>
            <IonCardHeader><IonCardTitle>По кассирам</IonCardTitle></IonCardHeader>
            <IonCardContent>
              <IonList>
                {cashiersData.map((c) => (
                  <IonItem key={String(c.user_id)}>
                    <IonLabel>{String(c.user_name)}: продажи {Number(c.sales).toFixed(2)}, чеков {Number(c.checks)}, средний чек {Number(c.avg_check).toFixed(2)}</IonLabel>
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>
        )}

        {tab === 'profit' && (
          <IonCard>
            <IonCardHeader><IonCardTitle>Отчёт по прибыли</IonCardTitle></IonCardHeader>
            <IonCardContent>
              <IonItem lines="none"><IonLabel>Выручка: {profitData.revenue.toFixed(2)}</IonLabel></IonItem>
              <IonItem lines="none"><IonLabel>Себестоимость: {profitData.cogs.toFixed(2)}</IonLabel></IonItem>
              <IonItem lines="none"><IonLabel>Расходы: {profitData.expenses.toFixed(2)}</IonLabel></IonItem>
              <IonItem lines="none"><IonLabel>Зарплата: {profitData.salary.toFixed(2)}</IonLabel></IonItem>
              <IonItem lines="none"><IonLabel>Чистая прибыль: {profitData.net_profit.toFixed(2)}</IonLabel></IonItem>
            </IonCardContent>
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ReportsPage;
