import { useEffect, useState } from 'react';
import { Redirect, Route, useLocation } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { cardOutline, cashOutline, homeOutline, pieChartOutline, settingsOutline, statsChartOutline, storefrontOutline, walletOutline } from 'ionicons/icons';
import LoginPage from './pages/LoginPage';
import PosPage from './pages/PosPage';
import ReceiptPage from './pages/ReceiptPage';
import ShiftPage from './pages/ShiftPage';
import ExpensesPage from './pages/ExpensesPage';
import StockPage from './pages/StockPage';
import SalaryPage from './pages/SalaryPage';
import ReportsPage from './pages/ReportsPage';
import AccountsPage from './pages/AccountsPage';
import SettingsPage from './pages/SettingsPage';
import { authService } from './services/auth.service';
import { Role } from './types/models';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';
import './theme/global.css';

setupIonicReact();

const AppTabs: React.FC = () => {
  const location = useLocation();
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    authService.getActiveUser().then((user) => {
      setRole(user?.role ?? null);
    });
  }, [location.pathname]);

  const isCashier = role === 'cashier';

  return (
    <IonRouterOutlet>
      <Route exact path="/login" component={LoginPage} />
      <Route exact path="/receipt/:id" component={ReceiptPage} />
      <Route exact path="/" render={() => <Redirect to="/login" />} />

      <Route
        path={['/pos', '/shift', '/expenses', '/stock', '/salary', '/reports', '/accounts', '/settings']}
      >
        <IonTabs>
          <IonRouterOutlet>
            <Route exact path="/pos" component={PosPage} />
            <Route exact path="/shift" component={ShiftPage} />
            <Route exact path="/expenses" component={ExpensesPage} />
            <Route exact path="/stock" render={() => (isCashier ? <Redirect to="/pos" /> : <StockPage />)} />
            <Route exact path="/salary" render={() => (isCashier ? <Redirect to="/pos" /> : <SalaryPage />)} />
            <Route exact path="/reports" render={() => (isCashier ? <Redirect to="/pos" /> : <ReportsPage />)} />
            <Route exact path="/accounts" render={() => (isCashier ? <Redirect to="/pos" /> : <AccountsPage />)} />
            <Route exact path="/settings" component={SettingsPage} />
          </IonRouterOutlet>

          <IonTabBar slot="bottom" className="ice-tab-bar">
            <IonTabButton tab="pos" href="/pos" aria-label="Касса">
              <IonIcon aria-hidden="true" icon={homeOutline} />
              <IonLabel>Касса</IonLabel>
            </IonTabButton>
            <IonTabButton tab="shift" href="/shift" aria-label="Смена">
              <IonIcon aria-hidden="true" icon={storefrontOutline} />
              <IonLabel>Смена</IonLabel>
            </IonTabButton>
            <IonTabButton tab="expenses" href="/expenses" aria-label="Расходы">
              <IonIcon aria-hidden="true" icon={cardOutline} />
              <IonLabel>Расходы</IonLabel>
            </IonTabButton>
            {!isCashier && (
              <IonTabButton tab="stock" href="/stock" aria-label="Склад">
                <IonIcon aria-hidden="true" icon={cashOutline} />
                <IonLabel>Склад</IonLabel>
              </IonTabButton>
            )}
            {!isCashier && (
              <IonTabButton tab="salary" href="/salary" aria-label="Зарплата">
                <IonIcon aria-hidden="true" icon={statsChartOutline} />
                <IonLabel>Зарплата</IonLabel>
              </IonTabButton>
            )}
            {!isCashier && (
              <IonTabButton tab="reports" href="/reports" aria-label="Отчёты">
                <IonIcon aria-hidden="true" icon={pieChartOutline} />
                <IonLabel>Отчёты</IonLabel>
              </IonTabButton>
            )}
            {!isCashier && (
              <IonTabButton tab="accounts" href="/accounts" aria-label="Счета">
                <IonIcon aria-hidden="true" icon={walletOutline} />
                <IonLabel>Счета</IonLabel>
              </IonTabButton>
            )}
            <IonTabButton tab="settings" href="/settings" aria-label="Настройки">
              <IonIcon aria-hidden="true" icon={settingsOutline} />
              <IonLabel>Настройки</IonLabel>
            </IonTabButton>
          </IonTabBar>
        </IonTabs>
      </Route>
    </IonRouterOutlet>
  );
};

const App: React.FC = () => (
  <IonApp className="ice-app">
    <IonReactRouter>
      <AppTabs />
    </IonReactRouter>
  </IonApp>
);

export default App;
