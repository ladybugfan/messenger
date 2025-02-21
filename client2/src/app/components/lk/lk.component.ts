import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';  
import { MatDialogRef } from '@angular/material/dialog';  
import { MAT_DIALOG_DATA } from '@angular/material/dialog';  

import { Router } from '@angular/router';
import { ChatDialogComponent } from '../chat-dialog/chat-dialog.component';
import { SocketService } from 'src/app/services/socket.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './lk.component.html',
  styleUrls: ['./lk.component.scss']
})
export class LkComponent {

  constructor(private router: Router, private dialog: MatDialog, private socketService: SocketService) { }

  openChatDialog() {
    this.dialog.open(ChatDialogComponent, {
      width: '600px',
      data: {}
    });
  }

  onTabChange(event: any) {
    switch (event.index) {
      case 0:
        this.router.navigate(['/lk/main']);
        break;
      case 1:
        this.router.navigate(['/lk/profile']);
        break;
      case 2:
        this.router.navigate(['/lk/showcase/cards']);
        break;
    }
  }

  logout() {
    this.socketService.disconnectSocket();
    

    sessionStorage.removeItem('currentUserId');
    sessionStorage.removeItem('currentUser');
    
    this.router.navigate(['/login']);

  }
}
