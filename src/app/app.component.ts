import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './services/auth.service';
import { ConnectivityService } from './services/connectivity.service';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Subscription } from 'rxjs';
import { StatusBar } from '@capacitor/status-bar';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  networkStatus = true;
  currentRoute = '';
  private loginSub?: Subscription;
  private networkSub?: PluginListenerHandle;
  private routerSub?: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    private connectivityService: ConnectivityService
  ) {
    if (Capacitor.isNativePlatform()) {
      this.initializeApp();
    }
  }

  async initializeApp() {
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setBackgroundColor({ color: '#660000' });
    } catch (error) {
      console.error('StatusBar initialization failed:', error);
      // Fallback to default color
      await StatusBar.setBackgroundColor({ color: '#000000' }).catch(() => {});
    }
  }

  ngOnInit() {
    this.monitorLoginStatus();
    this.listenToNetworkChanges();
    this.monitorRouteChanges();
    this.updateFooterPresenceClass();
  }

  monitorLoginStatus() {
    this.loginSub = this.authService.isLoggedIn$.subscribe((status) => {
      this.isLoggedIn = status;
      this.updateFooterPresenceClass();
    });
  }

  async listenToNetworkChanges() {
    this.networkSub = await this.connectivityService.startNetworkListener((isConnected: boolean) => {
      this.networkStatus = isConnected;
      this.updateFooterPresenceClass();
      if (isConnected) {
        this.monitorLoginStatus();
      }
    });
  }

  monitorRouteChanges() {
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentRoute = event.urlAfterRedirects;
        this.updateFooterPresenceClass();
        if (Capacitor.isNativePlatform()) {
          this.setStatusBarColor();
        }
      });
  }

  async setStatusBarColor() {
    try {
      const color = this.currentRoute === '/home' ? '#660000' : '#800000';
      await StatusBar.setBackgroundColor({ color });
    } catch (error) {
      console.error('StatusBar color error:', error);
    }
  }

  shouldShowFooter(): boolean {
    return (
      this.isLoggedIn &&
      this.networkStatus &&
      !['/login', '/loading'].includes(this.currentRoute)
    );
  }

  private updateFooterPresenceClass() {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.classList.toggle('with-app-footer', this.shouldShowFooter());
  }

  isActiveTab(route: string): boolean {
    return this.currentRoute === route;
  }

  ngOnDestroy() {
    this.networkSub?.remove();
    if (this.loginSub) {
      this.loginSub.unsubscribe();
    }
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }

    if (typeof document !== 'undefined') {
      document.body.classList.remove('with-app-footer');
    }
  }

  navigateToInbox() {
    this.router.navigate(['/home']);
  }

  navigateToOutbox() {
    this.router.navigate(['/sent-messages']);
  }
}
