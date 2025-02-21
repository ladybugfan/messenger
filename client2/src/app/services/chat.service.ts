import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  performDiffieHellmanExchange(roomId: string) {
    throw new Error('Method not implemented.');
  }

  leaveRoom(roomId: string): Observable<any> {
    const clientId = sessionStorage.getItem('currentUserId');
    return this.http.post(`/api/leave_room/${roomId}`, { client_id: clientId });
  }

  deleteRoom(roomId: string): Observable<any> {
    return this.http.delete(`/api/delete_room/${roomId}`);
  }

  createRoom(chatData: any): Observable<any> {
    return this.http.post<any>(`/api/create_room`, chatData)
  }

  joinRoom(roomId: string): Observable<any> {
    const clientId = sessionStorage.getItem('currentUserId');

    if (!clientId) {
      console.error('Client ID not found in localStorage');
      return throwError('currentUserId is not set in localStorage');
    }

    console.log('Attempting to connect clientId:', clientId);

    const url = `api/connect_client/${roomId}`;
    const body = { client_id: clientId };

    return this.http.post<any>(url, body).pipe(
      catchError(error => {
        console.error('Error connecting to room:', error);
        return throwError(error);
      })
    );
  }

  private apiUrl = '/api/user_rooms';

  getUserRooms(clientId: string): Observable<any> {

    return this.http.get<any>(`${this.apiUrl}/${clientId}`);
  }

  private userRoomsSubject = new BehaviorSubject<any[]>([]);
  userRooms$ = this.userRoomsSubject.asObservable();

  constructor(private http: HttpClient) {

  }
  
  checkUserConnection(userId: string, roomId: string): Observable<any> {
    return this.http.post<any>(`api/check_user_connection`, { user_id: userId, room_id: roomId });
  }

  loadUserRooms(clientId: string) {
    this.getUserRooms(clientId).subscribe({
      next: (response) => {
        const connectedRooms = response.connected_rooms.map((room: any) => ({
          ...room,
          isAvailable: false
        }));

        const availableRooms = response.available_rooms.map((room: any) => ({
          ...room,
          isAvailable: true
        }));

        const combinedRooms = [...connectedRooms, ...availableRooms];

        this.userRoomsSubject.next(combinedRooms);
      },
      error: err => console.error('Ошибка при загрузке чатов:', err)
    });
  }
}
