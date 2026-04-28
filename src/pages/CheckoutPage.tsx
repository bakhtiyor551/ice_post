import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonPage } from '@ionic/react';

const CheckoutPage: React.FC = () => {
  return (
    <IonPage>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Checkout</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>Экран подготовлен под расширенную смешанную оплату и печать чека.</IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default CheckoutPage;
