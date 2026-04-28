import { useEffect, useMemo, useState } from 'react';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonItem,
  IonLabel,
  IonPage,
  IonRow,
  IonSelect,
  IonSelectOption,
  useIonToast
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { User } from '../types/models';
import { dbService } from '../services/db.service';
import { expenseService } from '../services/expense.service';

const pinKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const LoginPage: React.FC = () => {
  const history = useHistory();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [pin, setPin] = useState('');
  const [present] = useIonToast();

  useEffect(() => {
    dbService.initialize().then(async () => {
      setUsers(await authService.listCashiers());
      const active = await authService.getActiveUser();
      if (active) history.replace('/pos');
    });
  }, [history]);

  const pinMask = useMemo(() => '•'.repeat(pin.length), [pin.length]);

  const enter = async () => {
    if (!selectedUser || pin.length < 4) {
      present({ message: 'Выберите кассира и введите PIN', duration: 1800, color: 'warning' });
      return;
    }
    const user = await authService.loginByPin(selectedUser, pin);
    if (!user) {
      present({ message: 'Неверный PIN', duration: 1800, color: 'danger' });
      setPin('');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    await expenseService.generateRecurringExpenses(today, user.id);
    history.replace('/pos');
  };

  return (
    <IonPage>
      <IonContent fullscreen className="ion-padding">
        <div className="login-shell">
          <div className="login-brand">
            <h1>Ice POS</h1>
            <p>Вход кассира по PIN</p>
          </div>
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Вход в систему</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem lines="none" className="ion-margin-bottom">
                <IonLabel position="stacked">Кассир</IonLabel>
                <IonSelect
                  interface="popover"
                  value={selectedUser}
                  placeholder="Выберите имя"
                  onIonChange={(e) => setSelectedUser(e.detail.value)}
                >
                  {users.map((user) => (
                    <IonSelectOption key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>

              <IonItem lines="full" className="ion-margin-bottom">
                <IonLabel>
                  <span style={{ opacity: 0.75 }}>PIN</span>
                  <p style={{ fontSize: '1.35rem', letterSpacing: '0.25em', marginTop: 8 }}>{pinMask || '····'}</p>
                </IonLabel>
              </IonItem>

              <IonGrid className="login-pin-pad ion-no-padding">
                <IonRow>
                  {pinKeys.map((k) => (
                    <IonCol size="4" key={k}>
                      <IonButton expand="block" fill="solid" color="light" onClick={() => setPin((prev) => (prev.length < 4 ? prev + k : prev))}>
                        {k}
                      </IonButton>
                    </IonCol>
                  ))}
                  <IonCol size="6">
                    <IonButton expand="block" fill="outline" color="medium" onClick={() => setPin((prev) => prev.slice(0, -1))}>
                      Стереть
                    </IonButton>
                  </IonCol>
                  <IonCol size="6">
                    <IonButton expand="block" color="success" onClick={enter}>
                      Войти
                    </IonButton>
                  </IonCol>
                </IonRow>
              </IonGrid>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
