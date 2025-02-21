import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AccountService {

  private baseUrl = '/api/accounts';
  private accessToken = localStorage.getItem('accessToken');

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.accessToken}`,
    });
  }

  getClientAccount() {
    return this.http.get<any[]>(this.baseUrl, { headers: this.getHeaders() });
  }

  constructor(private http: HttpClient) { }
}
