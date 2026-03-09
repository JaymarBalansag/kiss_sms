import { Component, OnInit, OnDestroy } from '@angular/core';
import { SmsService } from '../services/sms.service';
import { AlertController, ModalController, ToastController, Platform } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { SettingsModalComponent } from '../settings-modal/settings-modal.component';
import { environment } from '../../environments/environment';
import { ConnectivityService } from '../services/connectivity.service';
import { ApiUrlModalComponent } from '../api-url-modal/api-url-modal.component';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { PluginListenerHandle } from '@capacitor/core';

@Component({
  selector: 'app-sent-messages',
  templateUrl: './sent-messages.page.html',
  styleUrls: ['./sent-messages.page.scss'],
  standalone: false,
})
export class SentMessagesPage implements OnInit, OnDestroy {
  groupedMessages: { [phoneNumber: string]: any[] } = {};
  selectedPhoneNumber: string | null = null;
  objectKeys = Object.keys;
  defaultApiUrl = environment.apiUrl;
  loading = true;
  networkStatus: boolean = true;
  private backButtonSub?: PluginListenerHandle;

  constructor(
    private smsService: SmsService,
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private connectivityService: ConnectivityService,
    private router: Router,
    private platform: Platform
  ) {}

  get totalMessages(): number {
    return Object.values(this.groupedMessages).reduce(
      (count: number, messages: any[]) => count + messages.length,
      0
    );
  }

  async ngOnInit() {
    this.networkStatus = await this.connectivityService.checkNetworkStatus();

    this.connectivityService.startNetworkListener((isConnected) => {
      this.networkStatus = isConnected;
      if (isConnected) {
        this.fetchSentMessages();
      }
    });

    if (this.networkStatus) {
      this.fetchSentMessages();
    }

    await this.registerBackButton();
  }

  async registerBackButton() {
    if (this.platform.is('capacitor')) {
      this.backButtonSub = await App.addListener('backButton', () => {
        this.handleBackButton();
      });
    }
  }

  handleBackButton() {
    if (this.selectedPhoneNumber) {
      this.selectedPhoneNumber = null;
    } else {
      this.router.navigate(['/home']);
    }
  }

  goBack() {
    if (this.selectedPhoneNumber) {
      this.selectedPhoneNumber = null;
    } else {
      this.router.navigate(['/home']);
    }
  }

  async checkConnection() {
    this.networkStatus = await this.connectivityService.checkNetworkStatus();
    if (this.networkStatus) {
      this.fetchSentMessages();
    } else {
      this.showToast('No internet connection. Please try again.', 'danger');
    }
  }

  async fetchSentMessages() {
    try {
      const messages = await this.smsService.getSentMessages();
      this.groupedMessages = this.smsService.groupMessagesByPhoneNumber(messages);
    } catch (err) {
      console.error('Failed to load messages:', err);
      this.showToast('Failed to load messages.', 'danger');
    } finally {
      this.loading = false;
    }
  }

  async refreshMessages(event: any) {
    try {
      const messages = await this.smsService.getSentMessages();
      this.groupedMessages = this.smsService.groupMessagesByPhoneNumber(messages);
    } catch (err) {
      this.showToast('Failed to refresh messages.', 'danger');
    } finally {
      event.target.complete();
    }
  }

  selectPhoneNumber(phoneNumber: string) {
    this.selectedPhoneNumber = phoneNumber;
  }

  async confirmDeleteMessage(messageId: number) {
    const alert = await this.alertController.create({
      header: 'Delete Message',
      message: 'Are you sure you want to delete this message?',
      buttons: [
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.deleteMessage(messageId),
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });

    await alert.present();
  }

  async deleteMessage(messageId: number) {
    try {
      if (!this.selectedPhoneNumber) throw new Error('No phone number selected');
      await this.smsService.deleteSentMessage(messageId);
      this.groupedMessages[this.selectedPhoneNumber] = this.groupedMessages[
        this.selectedPhoneNumber
      ].filter((msg) => msg.id !== messageId);
      if (this.groupedMessages[this.selectedPhoneNumber].length === 0) {
        delete this.groupedMessages[this.selectedPhoneNumber];
        this.selectedPhoneNumber = null;
      }
      this.showToast('Message deleted successfully.', 'success');
    } catch (err) {
      console.error('Failed to delete message:', err);
      this.showToast('Failed to delete message.', 'danger');
    }
  }

  async confirmDeleteGroup(phoneNumber: string) {
    const alert = await this.alertController.create({
      header: 'Delete Conversation',
      message: `Are you sure you want to delete all messages for ${phoneNumber}?`,
      buttons: [
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.deleteGroup(phoneNumber),
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });

    await alert.present();
  }

  async deleteGroup(phoneNumber: string) {
    try {
      await this.smsService.deleteSentMessagesByPhoneNumber(phoneNumber);
      delete this.groupedMessages[phoneNumber];
      this.showToast('Conversation deleted successfully.', 'success');
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      this.showToast('Failed to delete conversation.', 'danger');
    }
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

  ngOnDestroy() {
    this.backButtonSub?.remove();
  }
}




