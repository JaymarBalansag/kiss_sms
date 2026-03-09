import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Storage } from '@capacitor/storage';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenKey = 'token';
  private expiresAtKey = 'token_expires_at';
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  isLoggedIn$ = this.isLoggedInSubject.asObservable();

  constructor(private router: Router, private http: HttpClient) {
    this.loadLoginStatus(); // Initialize login status on service load
  }

  private defaultApiUrl = environment.apiUrl;

  get apiUrl(): string {
    const storedUrl = localStorage.getItem('customApiUrl');
    return storedUrl && storedUrl.trim() !== '' ? storedUrl : this.defaultApiUrl;
  }

  // Load login status at service startup
  private async loadLoginStatus() {
    const isLoggedIn = await this.isLoggedIn();
    this.isLoggedInSubject.next(isLoggedIn);
  }

  // Set token and expiration timestamp
  async setToken(token: string, expiresAt: string): Promise<void> {
    try {
      // Validate expiresAt format
      const expirationDate = new Date(expiresAt);
      if (isNaN(expirationDate.getTime())) {
        throw new Error('Invalid expires_at format');
      }
      await Storage.set({ key: this.tokenKey, value: token });
      await Storage.set({ key: this.expiresAtKey, value: expiresAt });
      this.isLoggedInSubject.next(true);
    } catch (error) {
      console.error('Failed to set token:', error);
      throw error;
    }
  }

  // Get token
  async getToken(): Promise<string | null> {
    const { value } = await Storage.get({ key: this.tokenKey });
    return value;
  }

  // Get expiration timestamp
  async getExpiresAt(): Promise<string | null> {
    const { value } = await Storage.get({ key: this.expiresAtKey });
    return value;
  }

  // Check if token is expired
  async isTokenExpired(): Promise<boolean> {
    const expiresAt = await this.getExpiresAt();
    if (!expiresAt) {
      return true; // No expiration data means token is considered expired
    }
    try {
      const expirationDate = new Date(expiresAt);
      if (isNaN(expirationDate.getTime())) {
        console.error('Invalid expires_at format:', expiresAt);
        return true;
      }
      const now = new Date();
      return now >= expirationDate;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true;
    }
  }

  // Check if user is logged in (token exists and is not expired)
  async isLoggedIn(): Promise<boolean> {
    const token = await this.getToken();
    if (!token) {
      return false;
    }
    const isExpired = await this.isTokenExpired();
    if (isExpired) {
      await this.logout(); // Automatically logout if token is expired
      return false;
    }
    return true;
  }

  // Logout from API (best-effort), then clear storage
  async logout(): Promise<void> {
    const token = await this.getToken();

    if (token) {
      const headers = new HttpHeaders({
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      });

      try {
        await firstValueFrom(this.http.post(`${this.apiUrl}/sms/logout`, {}, { headers }));
      } catch (error) {
        console.warn('SMS logout API failed (continuing local logout):', error);
      }
    }

    await Storage.remove({ key: this.tokenKey });
    await Storage.remove({ key: this.expiresAtKey });
    this.isLoggedInSubject.next(false);
    await this.router.navigate(['/login']);
  }
}
