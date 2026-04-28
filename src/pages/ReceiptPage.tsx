import { useEffect, useState } from 'react';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonList,
  IonPage
} from '@ionic/react';
import { RouteComponentProps, useHistory } from 'react-router-dom';
import { saleService } from '../services/sale.service';
import { dbService } from '../services/db.service';
import { Sale, SaleItem, User } from '../types/models';

interface ReceiptParams {
  id: string;
}

const ReceiptPage: React.FC<RouteComponentProps<ReceiptParams>> = ({ match }) => {
  const history = useHistory();
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [productNames, setProductNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      const full = await saleService.getSaleWithItems(match.params.id);
      if (!full) return;
      setSale(full.sale);
      setItems(full.items);
      const users = await dbService.table('users');
      setUser(users.find((u) => u.id === full.sale.user_id) ?? null);
      const products = await dbService.table('products');
      setProductNames(Object.fromEntries(products.map((p) => [p.id, p.name])));
    };
    load();
  }, [match.params.id]);

  if (!sale) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <IonCard>
            <IonCardContent className="ion-text-center ion-padding">
              <p>Чек не найден</p>
              <IonButton expand="block" onClick={() => history.push('/pos')}>
                На кассу
              </IonButton>
            </IonCardContent>
          </IonCard>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Чек №{sale.receipt_number}</IonCardTitle>
            <p className="ice-card-subtitle">Спасибо за покупку</p>
          </IonCardHeader>
          <IonCardContent>
            <IonItem lines="none">
              <IonLabel className="ion-text-wrap">
                <small style={{ opacity: 0.8 }}>Дата и время</small>
                <p>{new Date(sale.created_at).toLocaleString('ru-RU')}</p>
              </IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>
                <small style={{ opacity: 0.8 }}>Кассир</small>
                <p>{user?.name ?? '—'}</p>
              </IonLabel>
            </IonItem>
            <IonList className="ion-margin-top ion-margin-bottom">
              {items.map((item) => (
                <IonItem key={item.id} lines="full">
                  <IonLabel className="ion-text-wrap">
                    {productNames[item.product_id] ?? item.product_id}
                    <p>
                      {item.quantity} шт — {item.total.toFixed(2)} смн
                    </p>
                  </IonLabel>
                </IonItem>
              ))}
            </IonList>
            <IonItem lines="none" className="pos-total-line">
              <IonLabel>Итого</IonLabel>
              <IonLabel slot="end">{sale.total_amount.toFixed(2)} смн</IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Оплата: {sale.payment_method}</IonLabel>
            </IonItem>
            <IonButton expand="block" size="large" className="ion-margin-top" onClick={() => history.push('/pos')}>
              Новая продажа
            </IonButton>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default ReceiptPage;
