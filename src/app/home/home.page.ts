import { Component, OnInit, OnDestroy } from '@angular/core';
import { SmsService } from '../services/sms.service';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';
import { AlertController, ToastController } from '@ionic/angular';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';
import { ModalController } from '@ionic/angular';
import { SettingsModalComponent } from '../settings-modal/settings-modal.component';
import { ConnectivityService } from '../services/connectivity.service';
import { ApiUrlModalComponent } from '../api-url-modal/api-url-modal.component';

@Component({
  selector: 'app-root',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  pendingSmsRequests: any[] = [];
  loading = false;
  networkStatus: boolean = true;
  private intervalSubscription?: Subscription;
  private isProcessing = false;
  defaultApiUrl = environment.apiUrl;

  constructor(
    private smsService: SmsService,
    private androidPermissions: AndroidPermissions,
    private alertController: AlertController,
    private toastCtrl: ToastController,
    private authService: AuthService,
    private modalCtrl: ModalController,
    private connectivityService: ConnectivityService
  ) { }

  async checkConnection() {
    this.networkStatus = await this.connectivityService.checkNetworkStatus();
    if (this.networkStatus) {
      this.startFetchingPendingMessages();
    } else {
      this.showToast('No internet connection. Please try again.', 'danger');
    }
  }

  requestPermissions() {
    const permissions = [
      this.androidPermissions.PERMISSION.SEND_SMS,
      this.androidPermissions.PERMISSION.READ_SMS,
      this.androidPermissions.PERMISSION.RECEIVE_SMS,
    ];

    permissions.forEach((permission) => {
      this.androidPermissions.checkPermission(permission).then((result) => {
        if (!result.hasPermission) {
          this.androidPermissions.requestPermission(permission).then((requestResult) => {
            if (!requestResult.hasPermission) {
              this.showPermissionAlert();
            }
          });
        }
      });
    });
  }

  async ngOnInit() {
    this.requestPermissions();

    if (!localStorage.getItem('customApiUrl')) {
      this.presentApiUrlDialog();
    }

    this.networkStatus = await this.connectivityService.checkNetworkStatus();

    this.connectivityService.startNetworkListener((isConnected) => {
      this.networkStatus = isConnected;
      if (isConnected && !this.intervalSubscription) {
        this.startFetchingPendingMessages();
      } else if (!isConnected && this.intervalSubscription) {
        this.stopFetchingPendingMessages();
      }
    });

    if (this.networkStatus) {
      this.startFetchingPendingMessages();
    }
  }

  startFetchingPendingMessages() {
    if (this.intervalSubscription) return;

    this.loading = true;
    this.intervalSubscription = interval(15000)
      .pipe(switchMap(() => this.smsService.getPendingSmsRequests()))
      .subscribe({
        next: async (data) => {
          this.pendingSmsRequests = data.filter((sms) => sms.status === 'pending');
          this.loading = false;

          if (this.pendingSmsRequests.length > 0 && !this.isProcessing) {
            await this.processPendingSmsQueue();
          }
        },
        error: (err) => {
          this.loading = false;
          this.showToast('Failed to fetch messages.', 'danger');
          console.error('Fetch error:', err);
        },
      });
  }

  stopFetchingPendingMessages() {
    if (this.intervalSubscription) {
      this.intervalSubscription.unsubscribe();
      this.intervalSubscription = undefined;
    }
  }

  async processPendingSmsQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      await this.smsService.processPendingSmsQueue();
    } catch (error) {
      console.error('Error processing SMS queue:', error);
      this.showToast('Error processing messages.', 'danger');
    } finally {
      this.isProcessing = false;
    }
  }

  ngOnDestroy() {
    this.stopFetchingPendingMessages();
  }

  async presentSettingsModal() {
    const modal = await this.modalCtrl.create({
      component: SettingsModalComponent,
      cssClass: 'settings-modal',
    });

    modal.onDidDismiss().then((result) => {
      const action = result.data?.action;
      if (action === 'setApiUrl') {
        this.presentApiUrlDialog();
      } else if (action === 'logout') {
        this.authService.logout();
      }
    });

    await modal.present();
  }

  async presentApiUrlDialog() {
    const storedUrl = localStorage.getItem('customApiUrl') || '';
    const modal = await this.modalCtrl.create({
      component: ApiUrlModalComponent,
      cssClass: 'api-url-modal',
      componentProps: {
        apiUrl: storedUrl || this.defaultApiUrl,
      },
    });

    modal.onDidDismiss().then((result) => {
      const data = result.data;
      if (data?.apiUrl?.trim()) {
        localStorage.setItem('customApiUrl', data.apiUrl.trim());
        this.showToast('API URL updated successfully.', 'success');
      } else {
        localStorage.removeItem('customApiUrl');
        this.showToast('Using default API URL.', 'success');
      }
    });

    await modal.present();
  }

  async showPermissionAlert() {
    const alert = await this.alertController.create({
      header: 'Permission Required',
      message: 'Please enable SMS permissions in your device settings.',
      buttons: ['OK'],
    });

    await alert.present();
  }

  private async showToast(message: string, color: string = 'primary') {
    const footer = document.querySelector('ion-footer.app-footer') as HTMLElement | null;
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
      ...(footer ? { positionAnchor: footer } : {}),
    });
    await toast.present();
  }
}

