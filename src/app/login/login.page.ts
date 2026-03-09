import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AlertController, ModalController, NavController, ToastController } from '@ionic/angular';
import { ConnectivityService } from '../services/connectivity.service';
import { AuthService } from '../services/auth.service';
import { ForgotPasswordModalComponent } from '../forgot-password-modal/forgot-password-modal.component';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  email = '';
  password = '';
  loading = false;
  networkStatus: boolean = false;

  private defaultApiUrl = environment.apiUrl;

  get apiUrl(): string {
    const storedUrl = localStorage.getItem('customApiUrl');
    return storedUrl && storedUrl.trim() !== '' ? storedUrl : this.defaultApiUrl;
  }

  constructor(
    private http: HttpClient,
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private connectivityService: ConnectivityService,
    private authService: AuthService,
    private alertController: AlertController,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.checkConnection();

    this.connectivityService.startNetworkListener((isConnected) => {
      this.networkStatus = isConnected;
    });

    this.authService.isLoggedIn().then((isLoggedIn) => {
      if (isLoggedIn) {
        this.navCtrl.navigateRoot('/home');
      }
    });
  }

  async checkConnection() {
    this.networkStatus = await this.connectivityService.checkNetworkStatus();
  }

  async login() {
    if (!this.networkStatus) {
      this.showToast('No internet connection.', 'warning');
      return;
    }

    if (!this.email || !this.password) {
      this.showToast('Please enter email and password.', 'warning');
      return;
    }

    this.loading = true;

    const headers = new HttpHeaders({
      Accept: 'application/json',
    });

    this.http
      .post<any>(
        `${this.apiUrl}/sms/login`,
        {
          email: this.email,
          password: this.password,
        },
        { headers }
      )
      .subscribe({
        next: async (res) => {
          this.loading = false;
          if (res?.status === 'success' && res?.token && res?.expires_at) {
            if (res.user.role === 'staff' || res.user.role === 'admin') {
              try {
                await this.authService.setToken(res.token, res.expires_at);
                this.navCtrl.navigateRoot('/home');
                this.showToast('Login successful.', 'success');
              } catch (error) {
                console.error('Failed to set token:', error);
                this.showToast('Invalid token expiration data.', 'danger');
              }
            } else {
              this.showToast('Not authorized.', 'danger');
            }
          } else {
            this.showToast('Invalid response from server.', 'danger');
          }
        },
        error: async (err) => {
          this.loading = false;
          console.error('Login Error:', err);
          this.showToast('Login failed. Please check your credentials.', 'danger');
        },
      });
  }

  async forgotPassword() {
    const modal = await this.modalCtrl.create({
      component: ForgotPasswordModalComponent,
      cssClass: 'forgot-password-modal',
      componentProps: {
        networkStatus: this.networkStatus
      }
    });
    await modal.present();
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
