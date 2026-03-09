import { Component, OnInit, OnDestroy } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { ConnectivityService } from '../services/connectivity.service';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import type { PluginListenerHandle } from '@capacitor/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-loading',
  templateUrl: './loading.page.html',
  styleUrls: ['./loading.page.scss'],
  standalone: false,
})
export class LoadingPage implements OnInit, OnDestroy {
  networkStatus: boolean = false;
  loadingMessage: string = 'Checking network connectivity...';
  private networkSubscription?: PluginListenerHandle;
  public hasProceeded: boolean = false;

  constructor(
    private connectivityService: ConnectivityService,
    private toastCtrl: ToastController,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.checkConnection();

    this.connectivityService.startNetworkListener((status) => {
      this.networkStatus = status;
      if (status && !this.hasProceeded) {
        this.checkConnection();
      }
    }).then(listener => {
      this.networkSubscription = listener;
    });
  }

  ngOnDestroy() {
    this.networkSubscription?.remove();
  }

  async checkConnection() {
    this.networkStatus = await this.connectivityService.checkNetworkStatus();

    if (this.networkStatus) {
      this.loadingMessage = 'Connected. Checking server...';
      const isServerUp = await this.connectivityService.pingServer(environment.apiUrl + '/ping');
      // const isServerUp = true;

      if (isServerUp) {
        const isLoggedIn = await this.authService.isLoggedIn();
        this.hasProceeded = true;
        this.router.navigate([isLoggedIn ? '/home' : '/login']);
      } else {
        this.showToast('Cannot reach the server.', 'danger');
      }
    } else {
      this.loadingMessage = 'No internet connection.';
      this.showToast('You are offline.', 'danger');
    }
  }

  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
    });
    await toast.present();
  }
}
