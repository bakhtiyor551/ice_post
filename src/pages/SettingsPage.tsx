import { useCallback, useEffect, useState } from 'react';
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
  IonSelect,
  IonSelectOption,
  IonToggle,
  useIonToast,
  useIonViewWillEnter
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { productService } from '../services/product.service';
import { syncService } from '../services/sync.service';
import { Category, Product, User } from '../types/models';

const SettingsPage: React.FC = () => {
  const [status, setStatus] = useState('Idle');
  const [present] = useIonToast();
  const history = useHistory();

  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedProdId, setSelectedProdId] = useState('');
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editCost, setEditCost] = useState(0);
  const [editCatId, setEditCatId] = useState('');
  const [editActive, setEditActive] = useState(true);

  const loadProductsEditor = useCallback(async () => {
    const [u, prods, cats] = await Promise.all([
      authService.getActiveUser(),
      productService.listProducts(),
      productService.listCategories()
    ]);
    setUser(u);
    const sorted = [...prods].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    setProducts(sorted);
    setCategories(cats);
    setSelectedProdId((prev) => {
      if (prev && sorted.some((p) => p.id === prev)) return prev;
      return sorted[0]?.id ?? '';
    });
  }, []);

  useIonViewWillEnter(() => {
    void loadProductsEditor();
  });

  useEffect(() => {
    const p = products.find((x) => x.id === selectedProdId);
    if (!p) return;
    setEditName(p.name);
    setEditPrice(p.price);
    setEditCost(p.cost_price);
    setEditCatId(p.category_id);
    setEditActive(p.is_active);
  }, [selectedProdId, products]);

  const saveProductEdit = async () => {
    if (!selectedProdId) return;
    try {
      await productService.updateProduct(selectedProdId, {
        name: editName,
        price: Number(editPrice),
        cost_price: Number(editCost),
        category_id: editCatId,
        is_active: editActive
      });
      present({ message: 'Товар сохранён. На кассе обновится при следующем заходе на экран.', duration: 2200, color: 'success' });
      await loadProductsEditor();
    } catch (e) {
      present({ message: e instanceof Error ? e.message : 'Ошибка', duration: 2000, color: 'danger' });
    }
  };

  const sync = async () => {
    setStatus('Syncing...');
    const result = await syncService.syncPending();
    setStatus(result.online ? `Online: pushed ${result.pushed}, pulled ${result.pulled}` : 'Offline: pending data kept locally');
  };

  const logout = async () => {
    await authService.logout();
    present({ message: 'Вы вышли из системы', duration: 1200, color: 'medium' });
    history.replace('/login');
  };

  const isAdmin = user?.role === 'admin';

  return (
    <IonPage>
      <IonContent className="ion-padding">
        {isAdmin && (
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Мороженое и товары на кассе</IonCardTitle>
              <p className="ice-card-subtitle">Цены и названия для кнопок POS</p>
            </IonCardHeader>
            <IonCardContent>
              <IonItem>
                <IonLabel position="stacked">Товар</IonLabel>
                <IonSelect value={selectedProdId} onIonChange={(e) => setSelectedProdId(e.detail.value)}>
                  {products.map((p) => (
                    <IonSelectOption key={p.id} value={p.id}>
                      {p.name} — {p.price} смн{p.is_active ? '' : ' (выкл.)'}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Название</IonLabel>
                <IonInput value={editName} onIonInput={(e) => setEditName(String(e.detail.value ?? ''))} />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Цена продажи (смн)</IonLabel>
                <IonInput
                  type="number"
                  step="any"
                  value={editPrice}
                  onIonInput={(e) => setEditPrice(Number(e.detail.value ?? 0))}
                />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Себестоимость для отчётов (смн)</IonLabel>
                <IonInput
                  type="number"
                  step="any"
                  value={editCost}
                  onIonInput={(e) => setEditCost(Number(e.detail.value ?? 0))}
                />
              </IonItem>
              <IonItem>
                <IonLabel>Категория в меню</IonLabel>
                <IonSelect value={editCatId} onIonChange={(e) => setEditCatId(e.detail.value)}>
                  {categories.map((c) => (
                    <IonSelectOption key={c.id} value={c.id}>
                      {c.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonLabel>Продаётся на кассе</IonLabel>
                <IonToggle checked={editActive} onIonChange={(e) => setEditActive(e.detail.checked)} />
              </IonItem>
              <IonButton expand="block" onClick={saveProductEdit}>
                Сохранить товар
              </IonButton>
            </IonCardContent>
          </IonCard>
        )}

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Синхронизация и выход</IonCardTitle>
            <p className="ice-card-subtitle">Облако и сессия</p>
          </IonCardHeader>
          <IonCardContent>
            <IonItem lines="none">
              <IonLabel>Статус синхронизации: {status}</IonLabel>
            </IonItem>
            <IonButton expand="block" onClick={sync}>
              Синхронизировать
            </IonButton>
            <IonButton expand="block" color="medium" fill="outline" onClick={logout}>
              Выйти
            </IonButton>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default SettingsPage;
