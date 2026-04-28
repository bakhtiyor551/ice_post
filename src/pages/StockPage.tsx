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
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonText,
  IonToggle,
  useIonAlert,
  useIonToast
} from '@ionic/react';
import { accountService } from '../services/account.service';
import { authService } from '../services/auth.service';
import { expenseService } from '../services/expense.service';
import { shiftService } from '../services/shift.service';
import { stockService } from '../services/stock.service';
import { Account, ExpenseCategory, StockCategory, StockItem, StockMovement, StockUnit, User } from '../types/models';

const STOCK_CATEGORIES: StockCategory[] = ['Сырьё', 'Упаковка', 'Дополнительно'];
const STOCK_UNITS_LIST: StockUnit[] = ['шт', 'кг', 'г', 'л', 'мл', 'пачка', 'коробка'];

const StockPage: React.FC = () => {
  const [present] = useIonToast();
  const [presentAlert] = useIonAlert();
  const [tab, setTab] = useState<'stock' | 'edit' | 'income' | 'writeoff' | 'inventory' | 'history' | 'low'>('stock');
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<StockItem[]>([]);
  const [lowItems, setLowItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<StockUnit>('шт');
  const [amount, setAmount] = useState(0);
  const [supplier, setSupplier] = useState('');
  const [reason, setReason] = useState('Порча');
  const [comment, setComment] = useState('');
  const [inventoryActual, setInventoryActual] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [incomeAccountId, setIncomeAccountId] = useState('');
  const [incomeCategoryId, setIncomeCategoryId] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'transfer'>('cash');

  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<StockCategory>('Сырьё');
  const [editUnit, setEditUnit] = useState<StockUnit>('шт');
  const [editMinQty, setEditMinQty] = useState(0);
  const [editSupplier, setEditSupplier] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editPurchasePrice, setEditPurchasePrice] = useState(0);
  const [editAverageCost, setEditAverageCost] = useState(0);

  const load = useCallback(async () => {
    const [activeUser, stockItems, lowStock, history, acc, cats] = await Promise.all([
      authService.getActiveUser(),
      stockService.getItems('', true),
      stockService.getLowStockItems(),
      stockService.getMovements(),
      accountService.list(),
      expenseService.listCategories()
    ]);
    setUser(activeUser);
    setAccounts(acc);
    setExpenseCategories(cats);
    if (!incomeAccountId && acc.length) setIncomeAccountId(acc.find((a) => a.type === 'cash_register')?.id ?? acc[0].id);
    if (!incomeCategoryId && cats.length) setIncomeCategoryId(cats[0].id);
    setItems(stockItems);
    setLowItems(lowStock);
    setMovements(history);
    if (!selectedItemId && stockItems.length) {
      const first = stockItems.find((i) => i.is_active) ?? stockItems[0];
      setSelectedItemId(first.id);
      setUnit(first.unit);
    }
  }, [incomeAccountId, incomeCategoryId, selectedItemId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const item = items.find((i) => i.id === selectedItemId);
    if (item) setUnit(item.unit);
  }, [selectedItemId, items]);

  useEffect(() => {
    const item = items.find((i) => i.id === selectedItemId);
    if (!item) return;
    setEditName(item.name);
    setEditCategory(item.category);
    setEditUnit(item.unit);
    setEditMinQty(item.min_quantity);
    setEditSupplier(item.supplier ?? '');
    setEditActive(item.is_active);
    setEditPurchasePrice(item.purchase_price);
    setEditAverageCost(item.average_cost);
  }, [selectedItemId, items]);

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const activeItems = useMemo(() => items.filter((i) => i.is_active), [items]);

  const confirmZeroAllStock = () => {
    void presentAlert({
      header: 'Обнулить остатки',
      message: 'У всех позиций остаток станет 0. Минимальные нормы и средняя себестоимость не меняются.',
      buttons: [
        { text: 'Отмена', role: 'cancel' },
        {
          text: 'Обнулить все',
          handler: () => {
            void (async () => {
              try {
                await stockService.zeroAllQuantities();
                present({ message: 'Все остатки обнулены', duration: 1600, color: 'success' });
                await load();
              } catch (e) {
                present({
                  message: e instanceof Error ? e.message : 'Ошибка',
                  duration: 2000,
                  color: 'danger'
                });
              }
            })();
          }
        }
      ]
    });
  };

  const saveEditedItem = async () => {
    if (!selectedItemId) return;
    try {
      await stockService.updateStockItem(selectedItemId, {
        name: editName,
        category: editCategory,
        unit: editUnit,
        min_quantity: editMinQty,
        supplier: editSupplier.trim() || undefined,
        is_active: editActive,
        purchase_price: Number(editPurchasePrice),
        average_cost: Number(editAverageCost)
      });
      present({ message: 'Товар обновлён', duration: 1400, color: 'success' });
      await load();
    } catch (e) {
      present({ message: e instanceof Error ? e.message : 'Ошибка', duration: 2000, color: 'danger' });
    }
  };

  const income = async () => {
    if (!selectedItem || !user) return;
    if (!incomeAccountId || !incomeCategoryId) {
      present({ message: 'Выберите счёт и категорию расхода', duration: 1800, color: 'warning' });
      return;
    }
    const shift = await shiftService.getCurrentShift(user.id);
    try {
      await stockService.addIncome({
        stockItemId: selectedItem.id,
        quantity,
        unit,
        totalAmount: amount,
        accountId: incomeAccountId,
        expenseCategoryId: incomeCategoryId,
        paymentMethod: payMethod,
        supplier,
        comment,
        userId: user.id,
        shiftId: shift?.id
      });
      present({ message: 'Приход сохранён', duration: 1400, color: 'success' });
      await load();
    } catch (e) {
      present({ message: e instanceof Error ? e.message : 'Ошибка', duration: 2200, color: 'danger' });
    }
  };

  const writeoff = async () => {
    if (!selectedItem) return;
    await stockService.writeOff({
      stockItemId: selectedItem.id,
      quantity,
      unit,
      reason,
      comment,
      userId: user?.id
    });
    present({ message: 'Списание сохранено', duration: 1400, color: 'success' });
    await load();
  };

  const correction = async () => {
    if (!selectedItem) return;
    await stockService.correctQuantity({
      stockItemId: selectedItem.id,
      actualQuantity: inventoryActual,
      unit,
      comment,
      userId: user?.id
    });
    present({ message: 'Корректировка сохранена', duration: 1400, color: 'success' });
    await load();
  };

  const inventory = async () => {
    if (!selectedItem || !user) return;
    await stockService.runInventory({
      userId: user.id,
      comment,
      items: [{ stockItemId: selectedItem.id, actualQuantity: inventoryActual, unit }]
    });
    present({ message: 'Инвентаризация сохранена', duration: 1400, color: 'success' });
    await load();
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="ice-scroll-segment ion-margin-bottom">
          <IonSegment scrollable value={tab} onIonChange={(e) => setTab(e.detail.value as typeof tab)}>
            <IonSegmentButton value="stock"><IonLabel>Склад</IonLabel></IonSegmentButton>
            <IonSegmentButton value="edit"><IonLabel>Товар</IonLabel></IonSegmentButton>
            <IonSegmentButton value="income"><IonLabel>Приход</IonLabel></IonSegmentButton>
            <IonSegmentButton value="writeoff"><IonLabel>Списание</IonLabel></IonSegmentButton>
            <IonSegmentButton value="inventory"><IonLabel>Инвентар.</IonLabel></IonSegmentButton>
            <IonSegmentButton value="history"><IonLabel>История</IonLabel></IonSegmentButton>
            <IonSegmentButton value="low"><IonLabel>Нужно купить</IonLabel></IonSegmentButton>
          </IonSegment>
        </div>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Складской модуль</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {tab === 'stock' && (
              <>
                <IonList>
                  {activeItems.map((item) => (
                    <IonItem key={item.id}>
                      <IonLabel>
                        {item.name} ({item.category})
                        <p>
                          Остаток: {item.quantity} {item.unit} | Мин: {item.min_quantity} | Закуп: {item.purchase_price} | Ср.: {item.average_cost} смн
                        </p>
                        {item.quantity < item.min_quantity && <IonText color="warning">⚠ Заканчивается</IonText>}
                      </IonLabel>
                      <IonButton
                        slot="end"
                        size="small"
                        fill="outline"
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setTab('edit');
                        }}
                      >
                        Изменить
                      </IonButton>
                    </IonItem>
                  ))}
                </IonList>
                <IonButton expand="block" fill="outline" color="danger" className="ion-margin-top" onClick={confirmZeroAllStock}>
                  Обнулить все остатки на складе
                </IonButton>
              </>
            )}

            {tab === 'edit' && (
              <>
                <IonItem>
                  <IonLabel position="stacked">Позиция</IonLabel>
                  <IonSelect
                    value={selectedItemId}
                    onIonChange={(e) => {
                      setSelectedItemId(e.detail.value);
                    }}
                  >
                    {items.map((item) => (
                      <IonSelectOption key={item.id} value={item.id}>
                        {item.name}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Название</IonLabel>
                  <IonInput value={editName} onIonInput={(e) => setEditName(String(e.detail.value ?? ''))} />
                </IonItem>
                <IonItem>
                  <IonLabel>Категория</IonLabel>
                  <IonSelect value={editCategory} onIonChange={(e) => setEditCategory(e.detail.value as StockCategory)}>
                    {STOCK_CATEGORIES.map((c) => (
                      <IonSelectOption key={c} value={c}>{c}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel>Единица учёта</IonLabel>
                  <IonSelect value={editUnit} onIonChange={(e) => setEditUnit(e.detail.value as StockUnit)}>
                    {STOCK_UNITS_LIST.map((u) => (
                      <IonSelectOption key={u} value={u}>{u}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Минимальный остаток</IonLabel>
                  <IonInput
                    type="number"
                    value={editMinQty}
                    onIonInput={(e) => setEditMinQty(Number(e.detail.value ?? 0))}
                  />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Цена закупки (за 1 ед., смн)</IonLabel>
                  <IonInput
                    type="number"
                    step="any"
                    value={editPurchasePrice}
                    onIonInput={(e) => setEditPurchasePrice(Number(e.detail.value ?? 0))}
                  />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Средняя себестоимость (за 1 ед., смн)</IonLabel>
                  <IonInput
                    type="number"
                    step="any"
                    value={editAverageCost}
                    onIonInput={(e) => setEditAverageCost(Number(e.detail.value ?? 0))}
                  />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Поставщик</IonLabel>
                  <IonInput value={editSupplier} onIonInput={(e) => setEditSupplier(String(e.detail.value ?? ''))} />
                </IonItem>
                <IonItem>
                  <IonLabel>Активна на складе</IonLabel>
                  <IonToggle checked={editActive} onIonChange={(e) => setEditActive(e.detail.checked)} />
                </IonItem>
                <IonButton expand="block" color="primary" onClick={saveEditedItem}>
                  Сохранить изменения
                </IonButton>
                <IonText color="medium">
                  <p className="ion-padding-start ion-padding-end">
                    Остаток меняется приходом, списанием и продажами. Цены закупки и среднюю себестоимость можно править
                    вручную; при новом приходе средняя пересчитывается автоматически.
                  </p>
                </IonText>
              </>
            )}

            {(tab === 'income' || tab === 'writeoff' || tab === 'inventory') && (
              <>
                <IonItem>
                  <IonLabel position="stacked">Товар</IonLabel>
                  <IonSelect value={selectedItemId} onIonChange={(e) => setSelectedItemId(e.detail.value)}>
                    {activeItems.map((item) => (
                      <IonSelectOption key={item.id} value={item.id}>{item.name}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Количество</IonLabel>
                  <IonInput type="number" value={quantity} onIonInput={(e) => setQuantity(Number(e.detail.value ?? 0))} />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Единица</IonLabel>
                  <IonSelect value={unit} onIonChange={(e) => setUnit(e.detail.value)}>
                    {STOCK_UNITS_LIST.map((u) => (
                      <IonSelectOption key={u} value={u}>{u}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                {(tab === 'income' || tab === 'writeoff') && (
                  <IonItem>
                    <IonLabel position="stacked">Комментарий</IonLabel>
                    <IonInput value={comment} onIonInput={(e) => setComment(String(e.detail.value ?? ''))} />
                  </IonItem>
                )}
              </>
            )}

            {tab === 'income' && (
              <>
                <IonItem>
                  <IonLabel position="stacked">Сумма закупки (спишется со счёта)</IonLabel>
                  <IonInput type="number" value={amount} onIonInput={(e) => setAmount(Number(e.detail.value ?? 0))} />
                </IonItem>
                <IonItem>
                  <IonLabel>Счёт оплаты</IonLabel>
                  <IonSelect value={incomeAccountId} onIonChange={(e) => setIncomeAccountId(e.detail.value)}>
                    {accounts.map((a) => (
                      <IonSelectOption key={a.id} value={a.id}>{a.name}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel>Категория расхода</IonLabel>
                  <IonSelect value={incomeCategoryId} onIonChange={(e) => setIncomeCategoryId(e.detail.value)}>
                    {expenseCategories.map((c) => (
                      <IonSelectOption key={c.id} value={c.id}>{c.name}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel>Способ оплаты</IonLabel>
                  <IonSelect value={payMethod} onIonChange={(e) => setPayMethod(e.detail.value)}>
                    <IonSelectOption value="cash">Наличные</IonSelectOption>
                    <IonSelectOption value="card">Карта</IonSelectOption>
                    <IonSelectOption value="transfer">Перевод</IonSelectOption>
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Поставщик</IonLabel>
                  <IonInput value={supplier} onIonInput={(e) => setSupplier(String(e.detail.value ?? ''))} />
                </IonItem>
                <IonButton expand="block" onClick={income}>Сохранить приход</IonButton>
              </>
            )}

            {tab === 'writeoff' && (
              <>
                <IonItem>
                  <IonLabel position="stacked">Причина</IonLabel>
                  <IonSelect value={reason} onIonChange={(e) => setReason(e.detail.value)}>
                    {['Порча', 'Ошибка', 'Тест', 'Кража', 'Потеря', 'Личное использование', 'Прочее'].map((r) => (
                      <IonSelectOption key={r} value={r}>{r}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonButton expand="block" color="danger" onClick={writeoff}>Сохранить списание</IonButton>
              </>
            )}

            {tab === 'inventory' && (
              <>
                <IonItem>
                  <IonLabel position="stacked">Фактический остаток</IonLabel>
                  <IonInput type="number" value={inventoryActual} onIonInput={(e) => setInventoryActual(Number(e.detail.value ?? 0))} />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Комментарий</IonLabel>
                  <IonInput value={comment} onIonInput={(e) => setComment(String(e.detail.value ?? ''))} />
                </IonItem>
                <IonButton expand="block" onClick={correction}>Корректировка</IonButton>
                <IonButton expand="block" fill="outline" onClick={inventory}>Инвентаризация</IonButton>
              </>
            )}

            {tab === 'history' && (
              <IonList>
                {movements.map((m) => {
                  const item = items.find((i) => i.id === m.stock_item_id);
                  return (
                    <IonItem key={m.id}>
                      <IonLabel>
                        {(m.quantity > 0 ? '+' : '') + m.quantity} {m.unit} {item?.name ?? m.stock_item_id}
                        <p>{m.type} {m.reason ? `- ${m.reason}` : ''}</p>
                      </IonLabel>
                    </IonItem>
                  );
                })}
              </IonList>
            )}

            {tab === 'low' && (
              <IonList>
                {lowItems.map((item) => (
                  <IonItem key={item.id}>
                    <IonLabel>
                      {item.name} - осталось {item.quantity} {item.unit}, минимум {item.min_quantity}
                    </IonLabel>
                  </IonItem>
                ))}
                {!lowItems.length && <IonText color="success">Минимальные остатки в норме</IonText>}
              </IonList>
            )}
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default StockPage;
