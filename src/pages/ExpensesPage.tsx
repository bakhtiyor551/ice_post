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
  useIonToast
} from '@ionic/react';
import { accountService } from '../services/account.service';
import { authService } from '../services/auth.service';
import { expenseService } from '../services/expense.service';
import { shiftService } from '../services/shift.service';
import { Account, Expense, ExpenseCategory, User } from '../types/models';

const ExpensesPage: React.FC = () => {
  const [present] = useIonToast();
  const [tab, setTab] = useState<'list' | 'add' | 'recurring'>('list');
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState(0);
  const [comment, setComment] = useState('');
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [editExpenseId, setEditExpenseId] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'variable' | 'fixed' | 'one_time'>('variable');
  const [recAmount, setRecAmount] = useState(0);
  const [recCategoryId, setRecCategoryId] = useState('');
  const [recFrequency, setRecFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const dateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const load = useCallback(async () => {
    const active = await authService.getActiveUser();
    if (!active) return;
    setUser(active);
    setUsers(await authService.listCashiers());
    const acc = await accountService.list();
    setAccounts(acc);
    if (!expenseAccountId && acc.length) setExpenseAccountId(acc[0].id);
    const cats = await expenseService.listCategories();
    setCategories(cats);
    if (!categoryId && cats.length) setCategoryId(cats[0].id);
    if (!recCategoryId && cats.length) setRecCategoryId(cats[0].id);
    setAllExpenses(
      await expenseService.listExpenses({
        categoryId: filterCategory || undefined,
        userId: filterUser || undefined,
        shiftId: filterShift || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined
      })
    );
  }, [categoryId, expenseAccountId, filterCategory, filterFrom, filterShift, filterTo, filterUser, recCategoryId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!user) return;
    const shift = await shiftService.getCurrentShift(user.id);
    if (!shift && method === 'cash') {
      present({ message: 'Для наличного расхода сначала откройте смену', duration: 1800, color: 'warning' });
      return;
    }
    if (!expenseAccountId) {
      present({ message: 'Выберите счёт списания', duration: 1600, color: 'warning' });
      return;
    }
    try {
      await expenseService.createExpense({
        category_id: categoryId,
        amount,
        payment_method: method,
        account_id: expenseAccountId,
        comment,
        user_id: user.id,
        shift_id: shift?.id,
        expense_date: dateStr
      });
      setAmount(0);
      setComment('');
      setEditExpenseId('');
      setTab('list');
      await load();
    } catch (error) {
      present({ message: error instanceof Error ? error.message : 'Ошибка расхода', duration: 1600, color: 'danger' });
    }
  };

  const saveEdit = async () => {
    if (!editExpenseId) return;
    if (!expenseAccountId) {
      present({ message: 'Выберите счёт списания', duration: 1600, color: 'warning' });
      return;
    }
    await expenseService.updateExpense(editExpenseId, {
      category_id: categoryId,
      amount,
      payment_method: method,
      account_id: expenseAccountId,
      comment
    });
    setEditExpenseId('');
    setAmount(0);
    setComment('');
    setTab('list');
    await load();
  };

  const startEdit = (exp: Expense) => {
    setEditExpenseId(exp.id);
    setCategoryId(exp.category_id);
    setAmount(exp.amount);
    setMethod(exp.payment_method);
    setExpenseAccountId(exp.account_id ?? accounts[0]?.id ?? '');
    setComment(exp.comment ?? '');
    setTab('add');
  };

  const removeExpense = async (id: string) => {
    await expenseService.softDeleteExpense(id);
    await load();
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    await expenseService.createCategory({ name: newCategoryName, type: newCategoryType });
    setNewCategoryName('');
    await load();
  };

  const addRecurring = async () => {
    await expenseService.createRecurring({
      category_id: recCategoryId,
      amount: recAmount,
      frequency: recFrequency,
      start_date: dateStr,
      is_active: true
    });
    present({ message: 'Повторяющийся расход добавлен', duration: 1200, color: 'success' });
  };

  const generateRecurring = async () => {
    if (!user) return;
    const shift = await shiftService.getCurrentShift(user.id);
    const count = await expenseService.generateRecurringExpenses(dateStr, user.id, shift?.id);
    present({ message: `Создано расходов: ${count}`, duration: 1200, color: 'success' });
    await load();
  };

  const expenseAnalytics = useMemo(() => {
    const total = allExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const map = new Map<string, number>();
    for (const exp of allExpenses) {
      map.set(exp.category_id, (map.get(exp.category_id) ?? 0) + exp.amount);
    }
    const byCategory = Array.from(map.entries())
      .map(([categoryId, amount]) => ({
        categoryId,
        categoryName: categories.find((c) => c.id === categoryId)?.name ?? categoryId,
        amount,
        percent: total > 0 ? (amount / total) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
    return { total, byCategory };
  }, [allExpenses, categories]);

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="ice-scroll-segment ion-margin-bottom">
          <IonSegment scrollable value={tab} onIonChange={(e) => setTab(e.detail.value as typeof tab)}>
            <IonSegmentButton value="list"><IonLabel>История</IonLabel></IonSegmentButton>
            <IonSegmentButton value="add"><IonLabel>Добавить</IonLabel></IonSegmentButton>
            <IonSegmentButton value="recurring"><IonLabel>Авторасходы</IonLabel></IonSegmentButton>
          </IonSegment>
        </div>

        {tab === 'list' && (
          <>
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Фильтры</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonItem>
                  <IonLabel position="stacked">Категория</IonLabel>
                  <IonSelect value={filterCategory} onIonChange={(e) => setFilterCategory(e.detail.value)}>
                    <IonSelectOption value="">Все</IonSelectOption>
                    {categories.map((c) => (
                      <IonSelectOption key={c.id} value={c.id}>{c.name}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Кассир</IonLabel>
                  <IonSelect value={filterUser} onIonChange={(e) => setFilterUser(e.detail.value)}>
                    <IonSelectOption value="">Все</IonSelectOption>
                    {users.map((u) => (
                      <IonSelectOption key={u.id} value={u.id}>{u.name}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">ID смены</IonLabel>
                  <IonInput value={filterShift} onIonInput={(e) => setFilterShift(String(e.detail.value ?? ''))} />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Дата от</IonLabel>
                  <IonInput type="date" value={filterFrom} onIonInput={(e) => setFilterFrom(String(e.detail.value ?? ''))} />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Дата до</IonLabel>
                  <IonInput type="date" value={filterTo} onIonInput={(e) => setFilterTo(String(e.detail.value ?? ''))} />
                </IonItem>
                <IonButton expand="block" onClick={load}>Применить</IonButton>
              </IonCardContent>
            </IonCard>

            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Аналитика расходов</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonItem lines="none">
                  <IonLabel>Всего расходов: {expenseAnalytics.total.toFixed(2)} смн</IonLabel>
                </IonItem>
                <IonList>
                  {expenseAnalytics.byCategory.map((row) => (
                    <IonItem key={row.categoryId}>
                      <IonLabel>
                        {row.categoryName} — {row.amount.toFixed(2)} смн ({row.percent.toFixed(1)}%)
                      </IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              </IonCardContent>
            </IonCard>

            <IonCard>
              <IonCardHeader>
                <IonCardTitle>История расходов</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonList>
                  {allExpenses.map((exp) => (
                    <IonItem key={exp.id}>
                      <IonLabel>
                        {categories.find((c) => c.id === exp.category_id)?.name ?? exp.category_id} — {exp.amount} смн ({exp.payment_method})
                      <p>
                        {exp.expense_date} | счёт: {accounts.find((a) => a.id === exp.account_id)?.name ?? exp.account_id ?? '—'}
                        | user: {exp.user_id} | shift: {exp.shift_id ?? '-'} {exp.comment ? `— ${exp.comment}` : ''}
                      </p>
                      </IonLabel>
                      <IonButton size="small" fill="outline" onClick={() => startEdit(exp)}>Изм</IonButton>
                      <IonButton size="small" color="danger" fill="outline" onClick={() => removeExpense(exp.id)}>Удалить</IonButton>
                    </IonItem>
                  ))}
                </IonList>
              </IonCardContent>
            </IonCard>
          </>
        )}

        {tab === 'add' && (
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>{editExpenseId ? 'Редактировать расход' : 'Добавить расход'}</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem>
                <IonLabel position="stacked">Категория</IonLabel>
                <IonSelect value={categoryId} onIonChange={(e) => setCategoryId(e.detail.value)}>
                  {categories.map((c) => (
                    <IonSelectOption key={c.id} value={c.id}>{c.name}</IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Сумма</IonLabel>
                <IonInput type="number" value={amount} onIonInput={(e) => setAmount(Number(e.detail.value ?? 0))} />
              </IonItem>
              <IonItem>
                <IonLabel>Счёт списания</IonLabel>
                <IonSelect value={expenseAccountId} onIonChange={(e) => setExpenseAccountId(e.detail.value)}>
                  {accounts.map((a) => (
                    <IonSelectOption key={a.id} value={a.id}>{a.name}</IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Способ оплаты</IonLabel>
                <IonSelect value={method} onIonChange={(e) => setMethod(e.detail.value)}>
                  <IonSelectOption value="cash">Наличные</IonSelectOption>
                  <IonSelectOption value="card">Карта</IonSelectOption>
                  <IonSelectOption value="transfer">Перевод</IonSelectOption>
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Комментарий</IonLabel>
                <IonInput value={comment} onIonInput={(e) => setComment(String(e.detail.value ?? ''))} />
              </IonItem>
              {!editExpenseId && <IonButton expand="block" onClick={create}>Сохранить</IonButton>}
              {editExpenseId && <IonButton expand="block" onClick={saveEdit}>Сохранить изменения</IonButton>}
            </IonCardContent>
          </IonCard>
        )}

        {tab === 'recurring' && (
          <>
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Категории расходов</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonItem>
                  <IonLabel position="stacked">Название</IonLabel>
                  <IonInput value={newCategoryName} onIonInput={(e) => setNewCategoryName(String(e.detail.value ?? ''))} />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Тип</IonLabel>
                  <IonSelect value={newCategoryType} onIonChange={(e) => setNewCategoryType(e.detail.value)}>
                    <IonSelectOption value="variable">Переменный</IonSelectOption>
                    <IonSelectOption value="fixed">Постоянный</IonSelectOption>
                    <IonSelectOption value="one_time">Разовый</IonSelectOption>
                  </IonSelect>
                </IonItem>
                <IonButton expand="block" onClick={addCategory}>Добавить категорию</IonButton>
              </IonCardContent>
            </IonCard>

            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Повторяющийся расход</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonItem>
                  <IonLabel position="stacked">Категория</IonLabel>
                  <IonSelect value={recCategoryId} onIonChange={(e) => setRecCategoryId(e.detail.value)}>
                    {categories.map((c) => (
                      <IonSelectOption key={c.id} value={c.id}>{c.name}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Сумма</IonLabel>
                  <IonInput type="number" value={recAmount} onIonInput={(e) => setRecAmount(Number(e.detail.value ?? 0))} />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Частота</IonLabel>
                  <IonSelect value={recFrequency} onIonChange={(e) => setRecFrequency(e.detail.value)}>
                    <IonSelectOption value="daily">День</IonSelectOption>
                    <IonSelectOption value="weekly">Неделя</IonSelectOption>
                    <IonSelectOption value="monthly">Месяц</IonSelectOption>
                  </IonSelect>
                </IonItem>
                <IonButton expand="block" onClick={addRecurring}>Добавить авторасход</IonButton>
                <IonButton expand="block" fill="outline" onClick={generateRecurring}>Сгенерировать сегодня</IonButton>
              </IonCardContent>
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ExpensesPage;
