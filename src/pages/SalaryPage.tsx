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
  IonSelect,
  IonSelectOption,
  useIonToast
} from '@ionic/react';
import { accountService } from '../services/account.service';
import { authService } from '../services/auth.service';
import { salaryService } from '../services/salary.service';
import { Account, PayrollPeriod, SalaryTransaction, User } from '../types/models';
import { shiftService } from '../services/shift.service';

const SalaryPage: React.FC = () => {
  const [present] = useIonToast();
  const [admin, setAdmin] = useState<User | null>(null);
  const [cashiers, setCashiers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [transactions, setTransactions] = useState<SalaryTransaction[]>([]);
  const [payroll, setPayroll] = useState<PayrollPeriod | null>(null);
  const [dayDetails, setDayDetails] = useState<Array<{ date: string; worked: boolean; amount: number; shifts: number }>>([]);
  const [bonus, setBonus] = useState(20);
  const [penalty, setPenalty] = useState(10);
  const [payout, setPayout] = useState(0);
  const [comment, setComment] = useState('');
  const [payoutAccountId, setPayoutAccountId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);

  const periodStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  }, []);
  const periodEnd = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  }, []);

  const load = useCallback(async () => {
    const active = await authService.getActiveUser();
    if (!active) return;
    setAdmin(active);
    const acc = await accountService.list();
    setAccounts(acc);
    if (!payoutAccountId && acc.length) setPayoutAccountId(acc.find((a) => a.type === 'safe')?.id ?? acc[0].id);
    const c = await salaryService.listCashiers();
    setCashiers(c);

    const userId = selectedUserId || c[0]?.id;
    if (!userId) return;
    setSelectedUserId(userId);
    setTransactions(await salaryService.listTransactions(userId));
    setPayroll(await salaryService.getLatestPayroll(userId, periodStart, periodEnd));
    setDayDetails(await salaryService.getDayDetails(userId, periodStart, periodEnd));
  }, [periodEnd, periodStart, payoutAccountId, selectedUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const addBonus = async () => {
    if (!selectedUserId) return;
    await salaryService.addBonus(selectedUserId, bonus, comment || 'Бонус');
    await salaryService.generatePayroll(selectedUserId, periodStart, periodEnd);
    setComment('');
    await load();
  };

  const addPenalty = async () => {
    if (!selectedUserId) return;
    await salaryService.addPenalty(selectedUserId, penalty, comment || 'Штраф');
    await salaryService.generatePayroll(selectedUserId, periodStart, periodEnd);
    setComment('');
    await load();
  };

  const paySalary = async () => {
    if (!selectedUserId || !admin) return;
    if (!payoutAccountId) {
      present({ message: 'Выберите счёт для выплаты', duration: 1600, color: 'warning' });
      return;
    }
    const currentShift = await shiftService.getCurrentShift(admin.id);
    await salaryService.createPayout({
      userId: selectedUserId,
      periodStart,
      periodEnd,
      amount: payout,
      paymentMethod: 'cash',
      accountId: payoutAccountId,
      comment: comment || 'Выплата зарплаты',
      adminUserId: admin.id,
      currentShiftId: currentShift?.id
    });
    await salaryService.generatePayroll(selectedUserId, periodStart, periodEnd);
    present({ message: 'Выплата сохранена', duration: 1400, color: 'success' });
    setComment('');
    await load();
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Зарплата</IonCardTitle>
            <p className="ice-card-subtitle">Текущий месяц</p>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel position="stacked">Кассир</IonLabel>
              <IonSelect value={selectedUserId} onIonChange={(e) => setSelectedUserId(e.detail.value)}>
                {cashiers.map((cashier) => (
                  <IonSelectOption key={cashier.id} value={cashier.id}>{cashier.name}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Период: {periodStart} - {periodEnd}</IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Рабочих дней: {payroll?.worked_days ?? 0}</IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Ставка за день: 45 смн</IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Начислено: {payroll?.base_salary.toFixed(2) ?? '0.00'} смн</IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Бонусы: +{payroll?.bonus_total.toFixed(2) ?? '0.00'} смн</IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Штрафы: -{payroll?.penalty_total.toFixed(2) ?? '0.00'} смн</IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Выплачено: {payroll?.payout_total.toFixed(2) ?? '0.00'} смн</IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Остаток: {payroll?.balance.toFixed(2) ?? '0.00'} смн</IonLabel>
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Бонус</IonLabel>
              <IonInput type="number" value={bonus} onIonInput={(e) => setBonus(Number(e.detail.value ?? 0))} />
            </IonItem>
            <IonButton expand="block" onClick={addBonus}>
              Добавить бонус
            </IonButton>

            <IonItem>
              <IonLabel position="stacked">Штраф</IonLabel>
              <IonInput type="number" value={penalty} onIonInput={(e) => setPenalty(Number(e.detail.value ?? 0))} />
            </IonItem>
            <IonButton expand="block" color="danger" onClick={addPenalty}>
              Добавить штраф
            </IonButton>
            <IonItem>
              <IonLabel>Счёт списания выплаты</IonLabel>
              <IonSelect value={payoutAccountId} onIonChange={(e) => setPayoutAccountId(e.detail.value)}>
                {accounts.map((a) => (
                  <IonSelectOption key={a.id} value={a.id}>{a.name}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Сумма выплаты</IonLabel>
              <IonInput type="number" value={payout} onIonInput={(e) => setPayout(Number(e.detail.value ?? 0))} />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Комментарий</IonLabel>
              <IonInput value={comment} onIonInput={(e) => setComment(String(e.detail.value ?? ''))} />
            </IonItem>
            <IonButton expand="block" color="success" onClick={paySalary}>
              Выплатить
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Детали по дням</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonList>
              {dayDetails.map((row) => (
                <IonItem key={row.date}>
                  <IonLabel>
                    {row.date} - {row.worked ? 'работал' : 'не работал'} - {row.amount} смн
                    <p>Смен за день: {row.shifts}</p>
                  </IonLabel>
                </IonItem>
              ))}
            </IonList>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Транзакции зарплаты</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonList>
              {transactions.map((tx) => (
                <IonItem key={tx.id}>
                  <IonLabel>
                    {tx.type}: {tx.amount} смн
                    <p>{new Date(tx.created_at).toLocaleString()} {tx.comment ? `- ${tx.comment}` : ''}</p>
                  </IonLabel>
                </IonItem>
              ))}
            </IonList>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default SalaryPage;
