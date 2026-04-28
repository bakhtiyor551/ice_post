import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  useIonToast,
  useIonViewWillEnter
} from '@ionic/react';
import { authService } from '../services/auth.service';
import { accountService } from '../services/account.service';
import { Account, AccountTransaction, AccountTransactionType, AccountType, User } from '../types/models';

const TYPE_LABELS: Record<AccountTransactionType, string> = {
  income: 'Доход',
  expense: 'Расход',
  transfer: 'Перевод',
  correction: 'Корректировка'
};

const ACC_TYPE_LABELS: Record<AccountType, string> = {
  cash_register: 'Касса точки',
  safe: 'Сейф',
  owner: 'У владельца',
  other: 'Другое'
};

const AccountsPage: React.FC = () => {
  const [present] = useIonToast();
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [detailAccount, setDetailAccount] = useState<Account | null>(null);
  const [history, setHistory] = useState<AccountTransaction[]>([]);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterType, setFilterType] = useState<AccountTransactionType | ''>('');
  const [filterUser, setFilterUser] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterMin, setFilterMin] = useState<number | ''>('');
  const [filterMax, setFilterMax] = useState<number | ''>('');

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AccountType>('other');
  const [incomeAmount, setIncomeAmount] = useState(0);
  const [incomeComment, setIncomeComment] = useState('');
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [expenseComment, setExpenseComment] = useState('');
  const [trFrom, setTrFrom] = useState('');
  const [trTo, setTrTo] = useState('');
  const [trAmount, setTrAmount] = useState(0);
  const [trComment, setTrComment] = useState('');
  const [corrActual, setCorrActual] = useState(0);
  const [corrComment, setCorrComment] = useState('');

  const loadAccounts = useCallback(async () => {
    const list = await accountService.list(true);
    setAccounts(list);
    if (!trFrom && list.length) setTrFrom(list[0].id);
    if (!trTo && list.length > 1) setTrTo(list[1].id);
    setDetailAccount((prev) => {
      if (!prev) return prev;
      const next = list.find((a) => a.id === prev.id);
      return next ?? prev;
    });
  }, [trFrom, trTo]);

  useEffect(() => {
    authService.getActiveUser().then(setUser);
    loadAccounts();
  }, [loadAccounts]);

  /** При переключении вкладки подтягиваем актуальные балансы (расходы/продажи меняют суммы в фоне). */
  useIonViewWillEnter(() => {
    void loadAccounts();
  });

  const loadHistory = useCallback(async () => {
    if (!detailAccount) return;
    const rows = await accountService.listTransactionsForAccount(detailAccount.id, {
      from: filterFrom || undefined,
      to: filterTo || undefined,
      type: filterType || undefined,
      userId: filterUser || undefined,
      shiftId: filterShift || undefined,
      minAmount: filterMin === '' ? undefined : Number(filterMin),
      maxAmount: filterMax === '' ? undefined : Number(filterMax)
    });
    setHistory(rows);
  }, [detailAccount, filterFrom, filterTo, filterType, filterUser, filterShift, filterMin, filterMax]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const openDetail = (acc: Account) => {
    setDetailAccount(acc);
    setFilterFrom('');
    setFilterTo('');
    setFilterType('');
    setFilterUser('');
    setFilterShift('');
    setFilterMin('');
    setFilterMax('');
  };

  const lineLabel = (t: AccountTransaction) => {
    const sign = t.direction === 'in' ? '+' : '−';
    return `${sign}${t.amount.toFixed(2)} смн — ${t.comment ?? TYPE_LABELS[t.type]}`;
  };

  const createAccount = async () => {
    if (!newName.trim()) return;
    try {
      await accountService.createAccount({ name: newName, type: newType });
      setNewName('');
      present({ message: 'Счёт создан', duration: 1200, color: 'success' });
      await loadAccounts();
    } catch (e) {
      present({ message: e instanceof Error ? e.message : 'Ошибка', duration: 1800, color: 'danger' });
    }
  };

  const removeAccount = async (a: Account) => {
    try {
      await accountService.deleteAccount(a.id);
      present({ message: 'Удалено', duration: 1200, color: 'success' });
      await loadAccounts();
    } catch (e) {
      present({ message: e instanceof Error ? e.message : 'Ошибка', duration: 2000, color: 'danger' });
    }
  };

  const addManualIncome = async () => {
    if (!detailAccount) return;
    try {
      const ref = `manual_${Date.now()}`;
      await accountService.recordIncome({
        accountId: detailAccount.id,
        amount: incomeAmount,
        referenceType: 'manual',
        referenceId: ref,
        userId: user?.id,
        comment: incomeComment || 'Ручной доход'
      });
      setIncomeAmount(0);
      setIncomeComment('');
      present({ message: 'Доход записан', duration: 1200, color: 'success' });
      await loadAccounts();
      await loadHistory();
    } catch (e) {
      present({ message: e instanceof Error ? e.message : 'Ошибка', duration: 2000, color: 'danger' });
    }
  };

  const addManualExpense = async () => {
    if (!detailAccount) return;
    try {
      await accountService.recordExpense({
        accountId: detailAccount.id,
        amount: expenseAmount,
        referenceType: 'manual',
        referenceId: `manual_${Date.now()}`,
        userId: user?.id,
        comment: expenseComment || 'Расход'
      });
      setExpenseAmount(0);
      setExpenseComment('');
      present({ message: 'Расход записан', duration: 1200, color: 'success' });
      await loadAccounts();
      await loadHistory();
    } catch (e) {
      present({ message: e instanceof Error ? e.message : 'Ошибка', duration: 2000, color: 'danger' });
    }
  };

  const doTransfer = async () => {
    try {
      await accountService.recordTransfer({
        fromAccountId: trFrom,
        toAccountId: trTo,
        amount: trAmount,
        userId: user?.id,
        comment: trComment || 'Перевод'
      });
      setTrAmount(0);
      setTrComment('');
      present({ message: 'Перевод выполнен', duration: 1200, color: 'success' });
      await loadAccounts();
      if (detailAccount) await loadHistory();
    } catch (e) {
      present({ message: e instanceof Error ? e.message : 'Ошибка', duration: 2000, color: 'danger' });
    }
  };

  const doCorrection = async () => {
    if (!detailAccount) return;
    const system = detailAccount.balance;
    const delta = Number((corrActual - system).toFixed(2));
    try {
      await accountService.recordCorrection({
        accountId: detailAccount.id,
        delta,
        referenceId: `corr_${Date.now()}`,
        userId: user?.id,
        comment: corrComment || (delta < 0 ? 'Недостача' : 'Излишек')
      });
      setCorrActual(0);
      setCorrComment('');
      present({ message: 'Корректировка сохранена', duration: 1200, color: 'success' });
      await loadAccounts();
      const refreshed = await accountService.get(detailAccount.id);
      if (refreshed) setDetailAccount(refreshed);
      await loadHistory();
    } catch (e) {
      present({ message: e instanceof Error ? e.message : 'Ошибка', duration: 2000, color: 'danger' });
    }
  };

  const summaryText = useMemo(() => {
    const t = accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
    return t.toFixed(2);
  }, [accounts]);

  if (detailAccount) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={() => setDetailAccount(null)}>Назад</IonButton>
            </IonButtons>
            <IonTitle>{detailAccount.name}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Остаток: {detailAccount.balance.toFixed(2)} смн</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem>
                <IonLabel position="stacked">Дата с</IonLabel>
                <IonInput type="date" value={filterFrom} onIonInput={(e) => setFilterFrom(String(e.detail.value ?? ''))} />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Дата по</IonLabel>
                <IonInput type="date" value={filterTo} onIonInput={(e) => setFilterTo(String(e.detail.value ?? ''))} />
              </IonItem>
              <IonItem>
                <IonLabel>Тип операции</IonLabel>
                <IonSelect
                  value={filterType}
                  onIonChange={(e) => setFilterType((e.detail.value as AccountTransactionType | '') ?? '')}
                >
                  <IonSelectOption value="">Все</IonSelectOption>
                  <IonSelectOption value="income">Доход</IonSelectOption>
                  <IonSelectOption value="expense">Расход</IonSelectOption>
                  <IonSelectOption value="transfer">Перевод</IonSelectOption>
                  <IonSelectOption value="correction">Корректировка</IonSelectOption>
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">ID кассира (фильтр)</IonLabel>
                <IonInput value={filterUser} onIonInput={(e) => setFilterUser(String(e.detail.value ?? ''))} />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">ID смены</IonLabel>
                <IonInput value={filterShift} onIonInput={(e) => setFilterShift(String(e.detail.value ?? ''))} />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Сумма от</IonLabel>
                <IonInput
                  type="number"
                  value={filterMin === '' ? '' : filterMin}
                  onIonInput={(e) => setFilterMin(e.detail.value === '' ? '' : Number(e.detail.value))}
                />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Сумма до</IonLabel>
                <IonInput
                  type="number"
                  value={filterMax === '' ? '' : filterMax}
                  onIonInput={(e) => setFilterMax(e.detail.value === '' ? '' : Number(e.detail.value))}
                />
              </IonItem>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>История</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                {history.map((t) => (
                  <IonItem key={t.id}>
                    <IonLabel className="ion-text-wrap">{lineLabel(t)}</IonLabel>
                    <IonLabel slot="end" className="ion-text-sm">{t.created_at.slice(0, 16)}</IonLabel>
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>+ Доход</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem>
                <IonLabel position="stacked">Сумма</IonLabel>
                <IonInput type="number" value={incomeAmount} onIonInput={(e) => setIncomeAmount(Number(e.detail.value ?? 0))} />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Комментарий</IonLabel>
                <IonInput value={incomeComment} onIonInput={(e) => setIncomeComment(String(e.detail.value ?? ''))} />
              </IonItem>
              <IonButton expand="block" onClick={addManualIncome}>Сохранить доход</IonButton>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>− Расход</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem>
                <IonLabel position="stacked">Сумма</IonLabel>
                <IonInput type="number" value={expenseAmount} onIonInput={(e) => setExpenseAmount(Number(e.detail.value ?? 0))} />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Комментарий</IonLabel>
                <IonInput value={expenseComment} onIonInput={(e) => setExpenseComment(String(e.detail.value ?? ''))} />
              </IonItem>
              <IonButton expand="block" color="danger" onClick={addManualExpense}>Сохранить расход</IonButton>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Корректировка</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem lines="none">
                <IonLabel>По системе: {detailAccount.balance.toFixed(2)} смн</IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Фактически в кассе / на счёте</IonLabel>
                <IonInput type="number" value={corrActual} onIonInput={(e) => setCorrActual(Number(e.detail.value ?? 0))} />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Комментарий</IonLabel>
                <IonInput value={corrComment} onIonInput={(e) => setCorrComment(String(e.detail.value ?? ''))} />
              </IonItem>
              <IonButton expand="block" color="warning" onClick={doCorrection}>
                Применить корректировку (разница: {(corrActual - detailAccount.balance).toFixed(2)})
              </IonButton>
            </IonCardContent>
          </IonCard>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Счета</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
            <IonCardHeader>
            <IonCardTitle>
              Всего по счетам:{' '}
              <span style={{ color: Number(summaryText) < 0 ? 'var(--ion-color-danger)' : undefined }}>
                {summaryText}
              </span>{' '}
              смн
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonList>
              {accounts.filter((a) => a.is_active).map((a) => (
                <IonItem key={a.id} button onClick={() => openDetail(a)}>
                  <IonLabel>
                    <h2>{a.name}</h2>
                    <p>{ACC_TYPE_LABELS[a.type]}</p>
                  </IonLabel>
                  <IonLabel
                    slot="end"
                    style={{ color: a.balance < 0 ? 'var(--ion-color-danger)' : undefined }}
                  >
                    {a.balance.toFixed(2)} смн
                  </IonLabel>
                  <IonButton slot="end" fill="clear" color="medium" onClick={(e) => { e.stopPropagation(); removeAccount(a); }}>
                    ✕
                  </IonButton>
                </IonItem>
              ))}
            </IonList>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Новый счёт</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel position="stacked">Название</IonLabel>
              <IonInput value={newName} onIonInput={(e) => setNewName(String(e.detail.value ?? ''))} />
            </IonItem>
            <IonItem>
              <IonLabel>Тип</IonLabel>
              <IonSelect value={newType} onIonChange={(e) => setNewType(e.detail.value as AccountType)}>
                <IonSelectOption value="cash_register">Касса точки</IonSelectOption>
                <IonSelectOption value="safe">Сейф</IonSelectOption>
                <IonSelectOption value="owner">У владельца</IonSelectOption>
                <IonSelectOption value="other">Другое</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonButton expand="block" onClick={createAccount}>Создать</IonButton>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>⇄ Перевод между счетами</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel>Откуда</IonLabel>
              <IonSelect value={trFrom} onIonChange={(e) => setTrFrom(e.detail.value)}>
                {accounts.map((a) => (
                  <IonSelectOption key={a.id} value={a.id}>{a.name}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonLabel>Куда</IonLabel>
              <IonSelect value={trTo} onIonChange={(e) => setTrTo(e.detail.value)}>
                {accounts.map((a) => (
                  <IonSelectOption key={a.id} value={a.id}>{a.name}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Сумма</IonLabel>
              <IonInput type="number" value={trAmount} onIonInput={(e) => setTrAmount(Number(e.detail.value ?? 0))} />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Комментарий</IonLabel>
              <IonInput value={trComment} onIonInput={(e) => setTrComment(String(e.detail.value ?? ''))} />
            </IonItem>
            <IonButton expand="block" onClick={doTransfer}>Перевести</IonButton>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default AccountsPage;
