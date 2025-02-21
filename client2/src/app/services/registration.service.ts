import { Injectable } from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../userInterface';

@Injectable({
  providedIn: 'root',
})
export class RegistrationService {
  private apiUrl = '/api/register';

  constructor(private http: HttpClient) { }

  registerUser(user: User1): Observable<any> {
    
    let d = this.http.post<User1>(this.apiUrl, user);
    console.log(d);
    return d;
  }
}

export interface User1 {
  username: string;
  password: string
}
