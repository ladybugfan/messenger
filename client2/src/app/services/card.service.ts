import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CardService {


  private accessToken = localStorage.getItem('accessToken');
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.accessToken}`,
    });
  }

  private baseUrl = '/api/cards';

  constructor(private http: HttpClient) { }

  getClientCards(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl, { headers: this.getHeaders() });
  }

  getCVC(cardId: number) {
    return this.http.get<number>(`${this.baseUrl}/${cardId}/cvc`, {
      headers: this.getHeaders(),
    });
  }

  activateCard(cardId: number, pin: number) {
    const url = `${this.baseUrl}/activate/${cardId}`;

    const body = {
      "pinCode": `${pin}`
    }

    return this.http.patch(url, body, {
      headers: this.getHeaders()
    });
  }
}
