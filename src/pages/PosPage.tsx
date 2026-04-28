import { useEffect, useMemo, useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonRow,
  IonSelect,
  IonSelectOption,
  useIonToast
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { accountService } from '../services/account.service';
import { authService } from '../services/auth.service';
import { productService } from '../services/product.service';
import { saleService } from '../services/sale.service';
import { shiftService } from '../services/shift.service';
import { stockService } from '../services/stock.service';
import { Account, Category, PaymentMethod, Product, User } from '../types/models';

type Cart = Record<string, { product: Product; quantity: number }>;

const PosPage: React.FC = () => {
  const history = useHistory();
  const [present] = useIonToast();
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [cart, setCart] = useState<Cart>({});
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [mixCash, setMixCash] = useState(0);
  const [mixCard, setMixCard] = useState(0);
  const [mixTransfer, setMixTransfer] = useState(0);
  const [accCash, setAccCash] = useState('');
  const [accCard, setAccCard] = useState('');
  const [accTransfer, setAccTransfer] = useState('');

  useEffect(() => {
    const boot = async () => {
      const active = await authService.getActiveUser();
      if (!active) {
        history.replace('/login');
        return;
      }
      const shift = await shiftService.getCurrentShift(active.id);
      if (!shift) {
        history.replace('/shift');
        return;
      }
      setUser(active);
      const accList = await accountService.list();
      setAccounts(accList);
      const def = shift.account_id || accList[0]?.id || '';
      setAccountId(def);
      setAccCash(shift.account_id || def);
      setAccCard(accList.find((a) => a.type !== 'cash_register')?.id ?? def);
      setAccTransfer(accList.find((a) => a.type !== 'cash_register')?.id ?? def);
      const c = await productService.listCategories();
      setCategories(c);
      setCategoryId(c[0]?.id ?? '');
      setProducts(await productService.listActiveProducts());
    };
    boot();
  }, [history]);

  const filteredProducts = useMemo(
    () => products.filter((p) => !categoryId || p.category_id === categoryId),
    [products, categoryId]
  );

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const total = useMemo(() => Math.max(0, cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0) - discount), [cartItems, discount]);

  const addProduct = (product: Product) => {
    setCart((prev) => {
      const existing = prev[product.id];
      return {
        ...prev,
        [product.id]: {
          product,
          quantity: existing ? existing.quantity + 1 : 1
        }
      };
    });
  };

  const changeQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[productId];
      if (!current) return prev;
      const nextQty = current.quantity + delta;
      if (nextQty <= 0) {
        const clone = { ...prev };
        delete clone[productId];
        return clone;
      }
      return { ...prev, [productId]: { ...current, quantity: nextQty } };
    });
  };

  const completeSale = async () => {
    if (!user) return;
    if (!cartItems.length) {
      present({ message: 'Корзина пустая', duration: 1400, color: 'warning' });
      return;
    }
    const shift = await shiftService.getCurrentShift(user.id);
    if (!shift) {
      present({ message: 'Откройте смену', duration: 1400, color: 'danger' });
      history.replace('/shift');
      return;
    }
    try {
      const stockCheck = await stockService.validateCartStock(cartItems);
      if (stockCheck.warnings.length) {
        present({ message: stockCheck.warnings[0], duration: 2000, color: 'warning' });
      }
      if (paymentMethod === 'mixed') {
        const sumMix = Number((mixCash + mixCard + mixTransfer).toFixed(2));
        if (Math.abs(sumMix - total) > 0.02) {
          present({ message: 'Суммы наличные + карта + перевод должны равняться итогу', duration: 2200, color: 'warning' });
          return;
        }
        if (mixCash > 0 && !accCash) {
          present({ message: 'Выберите счёт для наличных', duration: 1600, color: 'warning' });
          return;
        }
        if (mixCard > 0 && !accCard) {
          present({ message: 'Выберите счёт для карты', duration: 1600, color: 'warning' });
          return;
        }
        if (mixTransfer > 0 && !accTransfer) {
          present({ message: 'Выберите счёт для перевода', duration: 1600, color: 'warning' });
          return;
        }
      } else if (!accountId) {
        present({ message: 'Выберите счёт для зачисления', duration: 1800, color: 'warning' });
        return;
      }

      const sale = await saleService.createSale({
        userId: user.id,
        shiftId: shift.id,
        items: cartItems,
        discount,
        paymentMethod,
        accountId: accountId || accCash,
        accountIdsMixed:
          paymentMethod === 'mixed'
            ? { cash: accCash, card: accCard, transfer: accTransfer }
            : undefined,
        paymentBreakdown:
          paymentMethod === 'mixed' ? { cash: mixCash, card: mixCard, transfer: mixTransfer } : undefined
      });
      setCart({});
      setDiscount(0);
      history.push(`/receipt/${sale.id}`);
    } catch (error) {
      present({
        message: error instanceof Error ? error.message : 'Ошибка продажи',
        duration: 2200,
        color: 'danger'
      });
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="ion-padding">
        <IonGrid className="pos-layout">
          <IonRow className="ion-align-items-stretch">
            <IonCol size="12" sizeMd="7" sizeLg="8">
              <IonCard className="ion-no-margin">
                <IonCardHeader>
                  <IonCardTitle>Товары</IonCardTitle>
                  <p className="ice-card-subtitle">Выберите категорию и позицию</p>
                </IonCardHeader>
                <IonCardContent>
                  <IonItem lines="none" className="ion-margin-bottom">
                    <IonLabel position="stacked">Категория</IonLabel>
                    <IonSelect interface="popover" value={categoryId} onIonChange={(e) => setCategoryId(e.detail.value)}>
                      {categories.map((c) => (
                        <IonSelectOption key={c.id} value={c.id}>
                          {c.name}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                  <IonGrid className="pos-product-grid ion-no-padding">
                    <IonRow>
                      {filteredProducts.map((product) => (
                        <IonCol size="12" sizeSm="6" sizeMd="6" sizeLg="4" key={product.id}>
                          <IonButton
                            expand="block"
                            className="pos-tile-button"
                            onClick={() => addProduct(product)}
                          >
                            <span className="ion-text-wrap">
                              {product.name}
                              <br />
                              <small>{product.price} смн</small>
                            </span>
                          </IonButton>
                        </IonCol>
                      ))}
                    </IonRow>
                  </IonGrid>
                </IonCardContent>
              </IonCard>
            </IonCol>
            <IonCol size="12" sizeMd="5" sizeLg="4">
              <IonCard className="ion-no-margin">
                <IonCardHeader>
                  <IonCardTitle>Корзина</IonCardTitle>
                  <p className="ice-card-subtitle">
                    {cartItems.length ? `${cartItems.length} поз.` : 'Пусто'}
                  </p>
                </IonCardHeader>
                <IonCardContent>
                  <IonList className="pos-cart-qty">
                    {cartItems.map((item) => (
                      <IonItem key={item.product.id} lines="full">
                        <IonLabel>
                          <strong>{item.product.name}</strong>
                          <p className="ion-text-wrap ion-margin-top">
                            {item.quantity} × {item.product.price} = {(item.product.price * item.quantity).toFixed(2)} смн
                          </p>
                        </IonLabel>
                        <IonButton slot="end" size="small" fill="outline" color="medium" onClick={() => changeQty(item.product.id, -1)}>
                          −
                        </IonButton>
                        <IonButton slot="end" size="small" fill="solid" color="primary" onClick={() => changeQty(item.product.id, 1)}>
                          +
                        </IonButton>
                      </IonItem>
                    ))}
                  </IonList>
                  <IonItem className="ion-margin-top">
                    <IonLabel>Скидка (смн)</IonLabel>
                    <IonButton fill="outline" size="small" onClick={() => setDiscount((d) => Math.max(0, d - 1))}>
                      −
                    </IonButton>
                    <IonBadge color="primary">{discount}</IonBadge>
                    <IonButton fill="outline" size="small" onClick={() => setDiscount((d) => d + 1)}>
                      +
                    </IonButton>
                  </IonItem>
                  <IonItem>
                    <IonLabel position="stacked">Способ оплаты</IonLabel>
                    <IonSelect interface="popover" value={paymentMethod} onIonChange={(e) => setPaymentMethod(e.detail.value)}>
                      <IonSelectOption value="cash">Наличные</IonSelectOption>
                      <IonSelectOption value="card">Карта</IonSelectOption>
                      <IonSelectOption value="transfer">Перевод</IonSelectOption>
                      <IonSelectOption value="mixed">Смешанная</IonSelectOption>
                    </IonSelect>
                  </IonItem>
                  {paymentMethod !== 'mixed' && (
                    <IonItem>
                      <IonLabel position="stacked">Счёт выручки</IonLabel>
                      <IonSelect interface="popover" value={accountId} onIonChange={(e) => setAccountId(e.detail.value)}>
                        {accounts.map((a) => (
                          <IonSelectOption key={a.id} value={a.id}>
                            {a.name}
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                    </IonItem>
                  )}
                  {paymentMethod === 'mixed' && (
                    <>
                      <IonItem>
                        <IonLabel position="stacked">Наличные</IonLabel>
                        <IonInput inputmode="decimal" type="number" value={mixCash} onIonInput={(e) => setMixCash(Number(e.detail.value ?? 0))} />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Счёт (нал)</IonLabel>
                        <IonSelect interface="popover" value={accCash} onIonChange={(e) => setAccCash(e.detail.value)}>
                          {accounts.map((a) => (
                            <IonSelectOption key={a.id} value={a.id}>
                              {a.name}
                            </IonSelectOption>
                          ))}
                        </IonSelect>
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Карта</IonLabel>
                        <IonInput inputmode="decimal" type="number" value={mixCard} onIonInput={(e) => setMixCard(Number(e.detail.value ?? 0))} />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Счёт (карта)</IonLabel>
                        <IonSelect interface="popover" value={accCard} onIonChange={(e) => setAccCard(e.detail.value)}>
                          {accounts.map((a) => (
                            <IonSelectOption key={a.id} value={a.id}>
                              {a.name}
                            </IonSelectOption>
                          ))}
                        </IonSelect>
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Перевод</IonLabel>
                        <IonInput inputmode="decimal" type="number" value={mixTransfer} onIonInput={(e) => setMixTransfer(Number(e.detail.value ?? 0))} />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Счёт (перевод)</IonLabel>
                        <IonSelect interface="popover" value={accTransfer} onIonChange={(e) => setAccTransfer(e.detail.value)}>
                          {accounts.map((a) => (
                            <IonSelectOption key={a.id} value={a.id}>
                              {a.name}
                            </IonSelectOption>
                          ))}
                        </IonSelect>
                      </IonItem>
                    </>
                  )}
                  <IonItem lines="none" className="pos-total-line ion-margin-top">
                    <IonLabel>Итого к оплате</IonLabel>
                    <IonLabel slot="end">{total.toFixed(2)} смн</IonLabel>
                  </IonItem>
                  <IonButton expand="block" size="large" color="success" className="ion-margin-top" onClick={completeSale}>
                    Завершить продажу
                  </IonButton>
                  <IonButton expand="block" fill="outline" color="medium" onClick={() => setCart({})}>
                    Очистить корзину
                  </IonButton>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
};

export default PosPage;
