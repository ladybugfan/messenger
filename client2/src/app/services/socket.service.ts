import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket | undefined;
  private socketSubject = new BehaviorSubject<Socket | undefined>(undefined);
  private socketSubscriptions: any[] = [];

  constructor() {
    this.connectSocket().then(() => {
      console.log('Socket connected or restored');
    }).catch((error) => {
      console.error('Socket connection error:', error);
    });
  }


  public async connectSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const userId = sessionStorage.getItem('currentUserId');

      if (userId) {
        console.log('Connecting to server with userId:', userId);
        this.socket = io('http://localhost:5000', { query: { userId } });

        this.socket.on('connected', () => {
          console.log('Successfully connected to the server');
          if (this.socket && this.socket.id) {
            this.socketSubject.next(this.socket);
            resolve();
          }
        });

        this.socket.on('connect_error', (err) => {
          console.error('Socket connection error:', err);
          reject(err);
        });
      } else {
        console.error('No userId found in sessionStorage');
        reject('User ID not found');
      }
    });
  }



  public disconnectSocket() {
    if (this.socket) {


      this.socket.disconnect()
      console.log('Socket disconnected');
    }
  }

  public getSocketObservable() {
    return this.socketSubject.asObservable();
  }


  getSocket(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.connected) {
        resolve(this.socket);
      } else {
        this.connectSocket()
          .then(() => {
            if (this.socket) {
              resolve(this.socket);
            } else {
              reject('Socket not connected');
            }
          })
          .catch((error) => {
            console.error('Failed to reconnect socket in getSocket:', error);
            reject(error);
          });
      }
    });
  }
}