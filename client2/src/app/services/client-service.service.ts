import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ClientServiceService {

  private accessToken = sessionStorage.getItem('accessToken');



  constructor(private http: HttpClient) { }


  getClient(): Observable<any> {
    const apiUrl = '/api/clients';
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.accessToken}`,
    });

    if (!this.accessToken) {
      console.error('Токен не найден в localStorage');
      return throwError('Токен не найден');
    }

    return this.http.get<any>(apiUrl, { headers }).pipe(
      tap((response) => {
        console.log('Ответ от сервера:', response);
      }),
      catchError((error) => {
        console.error('Ошибка при получении данных клиента:', error);
        return throwError(error);
      })
    );
  }


  updateClient(clientData: any) {
    const apiUrl = '/api/clients';
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.accessToken}`,
    });
    if (!this.accessToken) {
      console.error('Токен не найден в localStorage');
      return throwError('Токен не найден');
    }

    return this.http.patch<any>(apiUrl, clientData, { headers }).pipe(
      tap((response) => {
        console.log('Ответ от сервера:', response);
      }),
      catchError((error) => {
        console.error('Ошибка при обновлении данных клиента:', error);
        return throwError(error);
      })
    );
  }
}
