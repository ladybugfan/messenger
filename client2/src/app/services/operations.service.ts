import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class OperationsService {
  private baseUrl = '/api/operations';
  private accessToken = localStorage.getItem('accessToken');

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.accessToken}`,
    });
  }

  startOperation(operationCode: string): Observable<any> {
    const body = { operationCode };
    return this.http.put(this.baseUrl, body, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  proceedOperation(requestId: number, stepParams: any[]): Observable<any> {
    console.log(this.getHeaders());
    const url = `${this.baseUrl}?requestId=${requestId}`;
    return this.http.patch(url, stepParams, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  confirmOperation(requestId: number): Observable<any> {
    const url = `${this.baseUrl}?requestId=${requestId}`;
    return this.http.post(url, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  cancelOperation(requestId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${requestId}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any): Observable<never> {
    console.error('Ошибка при выполнении запроса:', error);
    return throwError(error);
  }
}
