import { Component, Inject, OnInit } from '@angular/core';
import { UsersService } from 'src/app/services/users.service';
import { UntypedFormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { ChatService } from 'src/app/services/chat.service';
import { SocketService } from 'src/app/services/socket.service';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog'; // Импорт новых классов


@Component({
  selector: 'app-chat-dialog',
  templateUrl: './chat-dialog.component.html',
  styleUrls: ['./chat-dialog.component.scss'],
})
export class ChatDialogComponent implements OnInit {
  algorithms: string[] = ['RC5', 'RC6'];
  modes: string[] = ['ECB', 'CBC', 'PCBC', 'CFB', 'OFB', 'CTR'];
  paddings: string[] = ['Zeros', 'ANSI X.923', 'PKCS7', 'ISO 10126'];

  users: User[] = [];
  filteredUsers: Observable<User[]> | undefined;

  encryptionAlgorithm: string = this.algorithms[0];
  encryptionMode: string = this.modes[0];
  paddingMode: string = this.paddings[0];
  selectedUser: User | null = null;

  userControl = new UntypedFormControl('');



  constructor(
    public dialogRef: MatDialogRef<ChatDialogComponent>,   
    @Inject(MAT_DIALOG_DATA) public data: any,           
    private userService: UsersService,
    private chatService: ChatService,
    private socketService: SocketService
  ) { }

  ngOnInit(): void {
    this.loadUsers();
  }

  displayUser(user: User | null): string {
    return user ? user.username : '';
  }

  loadUsers(): void {
    const currentUser = sessionStorage.getItem('currentUserId');
    console.log('currentUser', currentUser)

    this.userService.getUsers().subscribe({
      next: (response) => {
        console.log('response', response)
        console.log('this.users', this.users)
        this.users = response
          .filter((user) => user.id !== currentUser)
          .map((user) => ({ id: user.id, username: user.username }));

        console.log('this.users', this.users)
        this.filteredUsers = this.userControl.valueChanges.pipe(
          startWith(''),
          map((value) => this._filter(value || ''))
        );
        console.log('filteredUsers', this.filteredUsers)
      },
      error: (err) => {
        console.error('Ошибка при загрузке пользователей', err);
      },
    });
  }

  private _filter(value: string | User): User[] {
    const filterValue = (typeof value === 'string' ? value : value?.username || '').toLowerCase();
    return this.users.filter(user =>
      user.username.toLowerCase().includes(filterValue)
    );
  }

  createChat() {
    const chatData = {
      encryption_algorithm: this.encryptionAlgorithm,
      encryption_mode: this.encryptionMode,
      padding_mode: this.paddingMode,
      currentUserId: sessionStorage.getItem('currentUserId'),
      selectedUserId: this.userControl.value?.id
    };

    this.chatService.createRoom(chatData).subscribe({
      next: async (response) => {
        console.log('Комната успешно создана:', response);
        this.dialogRef.close(response); 

         await this.socketService.connectSocket()
      },
      error: (err) => {
        console.error('Ошибка при создании комнаты:', err);
      }
    });

    console.log('Создан новый чат с настройками:', chatData);
    this.dialogRef.close(chatData);
  }
}

interface User {
  id: string;
  username: string;
}