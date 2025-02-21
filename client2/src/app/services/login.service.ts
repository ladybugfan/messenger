import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import { SocketService } from './socket.service';
import { ElectronService } from './electron.service';

@Injectable({
  providedIn: 'root'
})
export class LoginService {
  private apiUrl = '/api/login';
  electronAPI: any;



  constructor(private http: HttpClient, private socketService: SocketService, private electronService: ElectronService) {
    this.electronAPI = (window as any).electronAPI;
    console.log(this.electronAPI)
  }

  loginUser(loginData: LoginUser): Observable<any> {
    return this.http.post<any>(this.apiUrl, loginData).pipe(
      tap(async response => {
        const token = 'token-' + Math.random().toString(36);
        sessionStorage.setItem('accessToken', token);
        sessionStorage.setItem('currentUser', loginData.username);
        sessionStorage.setItem('currentUserId', response.user_id);
        console.log('sessionStorage currentUserId',sessionStorage.getItem('currentUserId'))

        this.electronService.checkUserDatabase(response.user_id).then((response: any) => {
            console.log(`loginUser checkUserDatabase кккк ${response}`);
          })
          .catch((err: any) => {
            console.error(`loginUser checkUserDatabase ${err}`);
          });


        await this.socketService.connectSocket()
        const socket = await this.socketService.getSocket();
        if (socket) {
          socket.emit('user_connected', { user_id: response.user_id });
        }
        return response;
      })
    );
  }
}

interface LoginUser {
  username: string,
  password: string
}
