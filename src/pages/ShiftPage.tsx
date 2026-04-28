import { useCallback, useMemo, useState } from 'react';
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
  IonPage,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  useIonToast,
  useIonViewWillEnter
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { accountService } from '../services/account.service';
import { authService } from '../services/auth.service';
import { salaryService } from '../services/salary.service';
import { shiftService } from '../services/shift.service';
import { Account, Shift, User } from '../types/models';

const ShiftPage: React.FC = () => {
  const [present] = useIonToast();
  const history = useHistory();
  const [user, setUser] = useState<User | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [startCash, setStartCash] = useState(0);
  const [endCash, setEndCash] = useState(0);
  const [openComment, setOpenComment] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [shiftAccountId, setShiftAccountId] = useState('');

  const load = useCallback(async () => {
    const active = await authService.getActiveUser();
    if (!active) {
      history.replace('/login');
      return;
    }
    setUser(active);
    setShift(await shiftService.getCurrentShift(active.id));
    const acc = await accountService.list();
    setAccounts(acc);
    setShiftAccountId((prev) => {
        const id = prev || (acc.find((a) => a.type === 'cash_register')?.id ?? acc[0]?.id ?? '');
      const bal = acc.find((a) => a.id === id)?.balance ?? 0;
      setStartCash(Number(bal.toFixed(2)));
      return id;
    });
  }, [history]);

  useIonViewWillEnter(() => {
    void load();
  });

  const cashShouldBe = useMemo(() => {
    if (!shift) return 0;
    const expected =
      shift.expected_cash ??
      Number((shift.start_cash + shift.cash_sales - shift.cash_expenses).toFixed(2));
    return expected;
  }, [shift]);

  const liveDifference = useMemo(() => {
    if (!shift) return 0;
    return Number((endCash - cashShouldBe).toFixed(2));
  }, [shift, endCash, cashShouldBe]);

  const openShift = async () => {
    if (!user) return;
    if (!shiftAccountId) {
      present({ message: 'Выберите счёт смены', duration: 1600, color: 'warning' });
      return;
    }
    const opened = await shiftService.openShift(user.id, startCash, shiftAccountId, openComment);
    setShift(opened);
    present({ message: 'Смена открыта. Начальная касса сохранена, продажи разрешены.', duration: 2200, color: 'success' });
  };

  const closeShift = async () => {
    if (!shift || !user) return;
    const closed = await shiftService.closeShift(shift.id, endCash);
    if (closed) {
      await salaryService.generateDailySalaryForShift(user.id, closed.id, user.daily_salary_rate || 45);
      if (closed.difference < 0) {
        await salaryService.addPenalty(user.id, Math.abs(closed.difference), 'Недостача по смене');
        present({
          message: `Смена закрыта. Недостача ${closed.difference.toFixed(2)} смн: корректировка по счёту и штраф созданы.`,
          duration: 3200,
          color: 'warning'
        });
      } else {
        present({ message: 'Смена закрыта', duration: 1200, color: 'success' });
      }
      setShift(null);
      setEndCash(0);
    }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        {!shift ? (
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Открыть смену</IonCardTitle>
              <p className="ice-card-subtitle">Наличные в кассе на старт</p>
            </IonCardHeader>
            <IonCardContent>
              <IonItem lines="none">
                <IonLabel className="ion-text-wrap" style={{ fontSize: '0.85rem', opacity: 0.85 }}>
                  Начальная касса — деньги, уже лежащие в ящике (сдача). Не считается доходом; нужна, чтобы в конце смены
                  сравнить ожидаемый и фактический остаток наличных.
                </IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Выберите счёт</IonLabel>
                <IonSelect
                  interface="popover"
                  placeholder="Счёт кассы"
                  value={shiftAccountId}
                  onIonChange={(e) => {
                    const id = String(e.detail.value ?? '');
                    setShiftAccountId(id);
                    const a = accounts.find((x) => x.id === id);
                    if (a) setStartCash(Number(a.balance.toFixed(2)));
                  }}
                >
                  {accounts.map((a) => (
                    <IonSelectOption key={a.id} value={a.id}>
                      {a.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Начальная касса, смн</IonLabel>
                <IonInput
                  inputmode="decimal"
                  type="number"
                  value={startCash}
                  onIonInput={(e) => setStartCash(Number(e.detail.value ?? 0))}
                />
              </IonItem>
              <IonNote color="medium" className="ion-padding-horizontal ion-margin-bottom">
                Начальная касса подставляется с баланса выбранного счёта; при смене счёта сумма обновляется. Можно изменить
                вручную.
              </IonNote>
              <IonItem>
                <IonLabel position="stacked">Комментарий</IonLabel>
                <IonTextarea
                  autoGrow
                  value={openComment}
                  placeholder="Например: деньги на сдачу"
                  onIonInput={(e) => setOpenComment(String(e.detail.value ?? ''))}
                />
              </IonItem>
              <IonButton expand="block" onClick={openShift}>
                Открыть смену
              </IonButton>
            </IonCardContent>
          </IonCard>
        ) : (
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Закрыть смену</IonCardTitle>
              <p className="ice-card-subtitle">Сверка кассы</p>
            </IonCardHeader>
            <IonCardContent>
              <IonItem lines="none">
                <IonLabel>Кассир: {user?.name}</IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonLabel>Счёт: {accounts.find((a) => a.id === shift.account_id)?.name ?? shift.account_id}</IonLabel>
              </IonItem>
              {shift.open_comment ? (
                <IonItem lines="none">
                  <IonLabel>Комментарий при открытии: {shift.open_comment}</IonLabel>
                </IonItem>
              ) : null}
              <IonItem lines="none">
                <IonLabel>Начальная касса: {shift.start_cash.toFixed(2)} смн</IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonLabel>Продажи (наличные в кассу): {shift.cash_sales.toFixed(2)} смн</IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonLabel>Карта / перевод (не в ящике): {(shift.card_sales + shift.transfer_sales).toFixed(2)} смн</IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonLabel>Расходы (наличные из кассы): {shift.cash_expenses.toFixed(2)} смн</IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonLabel>
                  <strong>Должно быть в кассе: {cashShouldBe.toFixed(2)} смн</strong>
                </IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonLabel className="ion-text-wrap" style={{ fontSize: '0.85rem', opacity: 0.85 }}>
                  Формула: начальная касса + наличные продажи − наличные расходы. Доход в отчётах — только из продаж, без
                  начальной кассы.
                </IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Фактически в кассе, смн</IonLabel>
                <IonInput
                  inputmode="decimal"
                  type="number"
                  value={endCash}
                  onIonInput={(e) => setEndCash(Number(e.detail.value ?? 0))}
                />
              </IonItem>
              <IonItem lines="none">
                <IonLabel>
                  Разница (факт − должно быть):{' '}
                  <strong style={{ color: liveDifference < 0 ? 'var(--ion-color-danger)' : undefined }}>
                    {liveDifference.toFixed(2)} смн
                  </strong>
                </IonLabel>
              </IonItem>
              <IonButton expand="block" color="danger" onClick={closeShift}>
                Закрыть смену
              </IonButton>
            </IonCardContent>
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ShiftPage;
