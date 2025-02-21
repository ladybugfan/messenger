// user-rooms.component.ts
import { ChangeDetectorRef, Component, ElementRef, OnInit, Renderer2, ViewChild } from '@angular/core';
import { ChatService } from 'src/app/services/chat.service';
import { MatTableDataSource } from '@angular/material/table';
import { BehaviorSubject, Subscription } from 'rxjs';
import { SocketService } from 'src/app/services/socket.service';
import { ElectronService } from 'src/app/services/electron.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CryptoService } from 'src/app/services/crypto.service';



@Component({
  selector: 'app-user-chats',
  templateUrl: './user-chats.component.html',
  styleUrls: ['./user-chats.component.scss']
})
export class UserChatsComponent implements OnInit {

  privateKey: number | undefined;
  publicKey: bigint | undefined;
  protocolstarted = false;
  currentChatMessages: ChatMessage[] = [];
  receivedChunks = new Map();


  p: any;
  g: any;
  socket: any;

  dataSource: MatTableDataSource<any> = new MatTableDataSource();
  selectedRoom: Room | null = null;

  newMessage = '';
  currentUserId = sessionStorage.getItem('currentUserId') || '';
  private subscription!: Subscription;
  isSecondUserConnected = false;

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  selectedFile: File | null = null;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0]; 
      this.newMessage = ''; 
    }
  }

  removeFile(): void {
    this.selectedFile = null;
  }

  loadMessagesForRoom(roomId: string): void {
    if (this.selectedRoom) {
      this.electronService.getMessagesFromDb(roomId)
        .then(async (messages: any) => {
          this.currentChatMessages = messages; 
          await this.processMessages(); 
          setTimeout(() => this.scrollToBottom(), 300);
        })
        .catch((error) => {
          console.error('Ошибка при загрузке сообщений из базы данных:', error);
        });
    }
  }

  async processMessages(): Promise<void> {
    for (const message of this.currentChatMessages) {
      if (message.file_path) {
        message.file_path = this.sanitizeFileUrl(message.file_path);
        console.log(String(message.file_path))
      }
    }
  }

  ngAfterViewInit() {
    setTimeout(() => this.scrollToBottom(), 100);
  }

  scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        const container = this.messagesContainer.nativeElement;
        container.scrollTop = container.scrollHeight;
      }
    } catch (err) {
      console.error('Ошибка при прокрутке:', err);
    }
  }

  constructor(private chatService: ChatService, private cryptoService: CryptoService, private socketService: SocketService, private cdr: ChangeDetectorRef, private electronService: ElectronService, private sanitizer: DomSanitizer) {

    this.socketService.getSocketObservable().subscribe((socket) => {
      if (socket) {
        this.socket = socket;
        console.log('Socket updated, refreshing subscriptions');
        this.subscribeToSocketEvents();
      }
    });

  }

  ngOnInit(): void {
    const clientId = sessionStorage.getItem('currentUserId') || ''; 
    if (clientId) {
      this.loadUserRooms(clientId);
    }

  }

  async sendMessage(room_id: string, receiver_id: string, encryption_algorithm: string, encryption_mode: string, padding_mode: string) {
    console.log('sendMessage func');
    console.log(this.newMessage, this.selectedFile)

    const timestamp = Date.now();

    const currentUserId = sessionStorage.getItem('currentUserId');
    if (!currentUserId) {
      console.error('Ошибка: Не удалось получить ID пользователя');
      return;
    }

    let filePath: string | null = null;
    let fileType: string | null = null;

    if (this.selectedFile) {

      filePath = this.selectedFile.name; 

      fileType = this.selectedFile.type || 'unknown';
    }

    await this.electronService.saveMessageToDb(room_id, currentUserId,
      receiver_id, this.newMessage || null, filePath || null, fileType || null, timestamp,);

    const existingKey = await this.electronService.getEncryptionSecretKey(room_id);

    console.log('existingKey', existingKey)
    if (!existingKey) {
      console.log(`No keys found. Star protocol...`);

      this.startProtocol(room_id);
      return

    } else {
      console.log(`Keys already exist for user ${this.currentUserId}`);
    }

    const iv = crypto.getRandomValues(new Uint8Array(16));
    console.log('🔹 Сгенерирован IV:', Buffer.from(iv).toString('hex'));

    const ivBase64 = Buffer.from(iv).toString('base64');


    if (this.newMessage) {
      this.electronService.saveMessageToDb(
        room_id,
        currentUserId,
        receiver_id,
        this.newMessage,
        filePath,
        fileType,
        timestamp
      );



      let encryptedMessage = await this.electronService.encryptMessage(this.newMessage, existingKey, encryption_algorithm, encryption_mode, padding_mode, ivBase64);
      console.log(encryptedMessage)
      const messageText = Buffer.from(encryptedMessage.encryptedMessage).toString('base64');
      this.saveAndSendMessage(room_id, currentUserId, receiver_id, messageText, null, null, timestamp, ivBase64);  // название поменять 
    }

    if (this.selectedFile) { ////////////////

      const reader = new FileReader();

      reader.onload = async () => {
        const fileData = new Uint8Array(reader.result as ArrayBuffer);

        console.log('reader.onload', fileData)

        let encryptedMessage = await this.electronService.encryptFile(
          fileData,
          existingKey,
          currentUserId,
          this.selectedFile!.name,
          encryption_algorithm,
          encryption_mode,
          padding_mode,
          ivBase64
        );

        console.log('Зашифрованные данные:', encryptedMessage.encryptedData);

        const uint8ArrayMessage = new Uint8Array(encryptedMessage.encryptedData);
        console.log('uint8ArrayMessage', uint8ArrayMessage)
        const messageText = Buffer.from(uint8ArrayMessage).toString('base64');

        console.log('messageText', messageText)

        this.sendFileInChunks(room_id, currentUserId, receiver_id, messageText, this.selectedFile!.name, this.selectedFile!.type, timestamp, ivBase64);
        this.selectedFile = null;
      };

      reader.readAsArrayBuffer(this.selectedFile);
    }
    let filePath1 = this.sanitizeFileUrl(filePath!);

    const newMessage: ChatMessage = {
      room_id,
      sender_id: currentUserId,
      receiver_id,
      message_text: this.newMessage || null,
      file_path: filePath1 || null,
      file_type: fileType || null,
      timestamp,
    };

    console.log('newMessage333', newMessage)

    if (this.selectedRoom && this.selectedRoom.id == room_id) {
      this.currentChatMessages.push(newMessage)
      this.scrollToBottom()
    }

    this.newMessage = '';

  }

  sendFileInChunks(roomId: string, senderId: string, receiverId: string, messageText: string, fileName: string, fileType: string, timestamp: number, iv: any) {
    const CHUNK_SIZE = 512 * 1024; 
    const totalChunks = Math.ceil(messageText.length / CHUNK_SIZE);
    const chunkId = `msg-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    let currentChunk = 0;
    console.log('sendFileInChunks')
    console.log('messageText.length', messageText.length)

    const sendNextChunk = () => {
      if (currentChunk >= totalChunks) {
        console.log("✅ Отправка завершена!");
        setTimeout(() => this.scrollToBottom(), 100);
        return;
      }

      const start = currentChunk * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, messageText.length);
      const chunkData = messageText.substring(start, end); 

      console.log(`📤 Отправка чанка ${currentChunk + 1}/${totalChunks}`);

      this.socket.emit('sendFileChunk', {
        roomId,
        senderId,
        receiverId,
        fileName,
        fileType,
        chunkData, 
        timestamp,
        chunkId,
        chunkIndex: currentChunk,
        totalChunks,
        iv
      });

      currentChunk++;
      sendNextChunk()
    };

    sendNextChunk();
  }

  async saveFileLocally(file: File): Promise<void> {
    const userId = sessionStorage.getItem('currentUserId');

    if (!userId) {
      console.error('Ошибка: ID пользователя не найден в сессии.');
      return;
    }

    const reader = new FileReader();

    reader.onload = async (event) => {
      if (!event.target?.result) return;

      const fileBuffer = event.target.result as ArrayBuffer;

      try {
        const filePath = await this.electronService.saveFile(userId, file.name, fileBuffer);

        if (filePath) {
          console.log(`Файл "${file.name}" сохранён локально в: ${filePath}`);
        } else {
          console.error('Ошибка при сохранении файла.');
        }
      } catch (error) {
        console.error('Ошибка при вызове saveFile в ElectronService:', error);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  private saveAndSendMessage(
    roomId: string,
    senderId: string,
    receiverId: string,
    messageText: string | null,
    filePath: string | null,
    fileType: string | null,
    timestamp: number,
    iv: string
  ) {
    console.log('saveAndSendMessage func');

    setTimeout(() => this.scrollToBottom(), 100);

    console.log({
      roomId,
      senderId,
      receiverId,
      messageText,
      filePath,
      fileType,
      timestamp,
    });

    this.socket.emit('sendMessage', {
      roomId,
      senderId,
      receiverId,
      messageText,
      filePath,
      fileType,
      timestamp,
      iv
    });
  }


  sanitizeFileUrl(filePath: string): string {
    return `http://localhost:3001/files/${this.currentUserId}/${filePath}`;
  }



  private async subscribeToSocketEvents(): Promise<void> {
    const socket = this.socket;

    if (!socket) {
      console.error('Socket not available');
      return;
    }

    socket.on('update_user_rooms', () => {
      console.log('Received update_user_rooms notification');
      this.loadUserRooms(this.currentUserId);
    });

    socket.on('receiveMessage', async (data: any) => {
      let { roomId, senderId, receiverId, messageText, filePath, fileType, timestamp, iv } = data;

      console.log('Received new message:', messageText || '[Файл]', 'at', timestamp);

      if (!messageText && !filePath) {
        console.error('Ошибка: получены некорректные данные сообщения');
        return;
      }

      const existingKey = await this.electronService.getEncryptionSecretKey(roomId);

      console.log('existingKey', existingKey)
      if (!existingKey) {
        console.log(`No keys found. Star protocol...`);

        this.startProtocol(roomId);
        return

      } else {
        console.log(`Keys already exist for user ${this.currentUserId}`);
      }

      const room = this.dataSource.data.find(room => room.id === roomId);
      let decryptedMessage

      if (messageText) {
        decryptedMessage = await this.electronService.decryptMessage(messageText, existingKey, room.encryption_algorithm, room.encryption_mode, room.padding_mode, iv);
        console.log('decryptedMessage', decryptedMessage.decryptedMessage)

        const decoder = new TextDecoder("utf-8");

        decryptedMessage = decoder.decode(decryptedMessage.decryptedMessage);

        await this.electronService.saveMessageToDb(roomId, senderId, receiverId, decryptedMessage, filePath, fileType, timestamp)
          .catch(err => console.error('Ошибка при сохранении сообщения в БД:', err));
      } else {

        let t = Buffer.from(messageText, "base64");

        await this.electronService.decryptFile(t,
          existingKey, this.currentUserId, filePath, room.encryption_algorithm, room.encryption_mode, room.padding_mode, iv);
      }

      if (this.selectedRoom && this.selectedRoom.id === roomId) {
        let filePath1 = this.sanitizeFileUrl(filePath)
        this.currentChatMessages.push({
          room_id: roomId,
          sender_id: senderId,
          receiver_id: receiverId,
          message_text: decryptedMessage || null, 
          file_path: filePath1 || null,
          file_type: fileType || null,
          timestamp
        });

        this.scrollToBottom();
      }
    });

    socket.on('second_user_status_update', (data: any) => {
      const roomId = data.roomId;
      const user = data.user_id;

      if (this.selectedRoom && this.selectedRoom.id == roomId) {
        this.checkSecondUserConnection(roomId, user);
      }
    });

    socket.on('protocol_init', async (data: any) => {
      console.log('protocolstarted', this.protocolstarted)
      if (this.protocolstarted == false) {
        this.protocolstarted = true;

        console.log('data.p', data.p)
        console.log('data.g', data.g)


        this.p = Number(data.p);
        this.g = Number(data.g);
        const user_id = data.user_id
        const room_id = data.room_id

        console.log(`Received protocol_init notification: p=${this.p}, g=${this.g}, user_id=${user_id}, room_id=${room_id}`);

        try {
          console.log('try')
          const existingKey = await this.electronService.getEncryptionSecretKey(room_id);

          console.log('existingKey', existingKey)
          if (!existingKey) {
            console.log(`No keys found. Generating new keys...`);

            this.handleProtocolInit(this.p, this.g, user_id, room_id);

          } else {
            console.log(`Keys already exist for user ${user_id}`);
            this.protocolstarted = false;
          }
        } catch (error) {
          console.error('Database error rrrrr:', error);
          this.protocolstarted = false;
        }
      }

    });

    socket.on('receive_public_key', async (data: any) => {
      const secondUserPublicKey = BigInt(data.public_key);

      console.log(`Received second user's public key: ${secondUserPublicKey}`);
      let sharedSecretKey;
      if (this.privateKey) {
        sharedSecretKey = this.modularExponentiation(secondUserPublicKey, BigInt(this.privateKey), this.p);
      }

      console.log(`Generated secret key: ${sharedSecretKey}`);

      if (sharedSecretKey) {
        const roomId = data.room_id;

        try {
          const response = await this.electronService.saveRoomSecretKey(roomId, Number(sharedSecretKey));
          console.log(`Secret key for room ${roomId} successfully stored: ${response}`);
          this.protocolstarted = false;
        } catch (err) {
          this.protocolstarted = false;
          console.error(`Failed to store secret key: ${err}`);
        }
      }
    });

    socket.on('receiveFileChunk', async (data: any) => {
      let { fileName, fileType, chunkData, chunkIndex, totalChunks, chunkId, roomId, senderId, timestamp, iv } = data;

      if (!this.receivedChunks.has(chunkId)) {
        this.receivedChunks.set(chunkId, { chunks: new Array(totalChunks), receivedCount: 0, totalChunks });
      }

      const fileData = this.receivedChunks.get(chunkId);

      if (fileData.chunks[chunkIndex]) {
        return;
      }

      fileData.chunks[chunkIndex] = Buffer.from(chunkData, "base64");
      fileData.receivedCount++;

      console.log(`✅ Получен чанк ${chunkIndex + 1}/${totalChunks} для ${fileName}`);

      if (fileData.receivedCount === totalChunks) {
        const fullFileBuffer = Buffer.concat(fileData.chunks);

        if (this.currentUserId) {
          try {
            const existingKey = await this.electronService.getEncryptionSecretKey(roomId);

            console.log('existingKey', existingKey)
            if (!existingKey) {
              console.log(`No keys found. Star protocol...`);

              this.startProtocol(roomId);
              return

            } else {
              console.log(`Keys already exist for user ${this.currentUserId}`);
            }

            const room = this.dataSource.data.find(room => room.id === roomId);

            const decryptedMessage = await this.electronService.decryptFile(fullFileBuffer,
              existingKey, this.currentUserId, fileName, room.encryption_algorithm, room.encryption_mode, room.padding_mode, iv);

            if (fileType === "text") {
              console.log(`💬 Получено расшифрованное сообщение:`, decryptedMessage.toString());

              this.currentChatMessages.push({
                room_id: roomId,
                sender_id: senderId,
                receiver_id: this.currentUserId,
                message_text: decryptedMessage.toString(),
                file_path: null,
                file_type: "text",
                timestamp,
              });
            } else {
              //await this.electronService.saveFile(this.currentUserId, fileName, decryptedMessage);
              console.log(`🎉 Файл ${fileName} успешно восстановлен!`);
              let fileName1 = this.sanitizeFileUrl(fileName)

              this.currentChatMessages.push({
                room_id: roomId,
                sender_id: senderId,
                receiver_id: this.currentUserId,
                message_text: null,
                file_path: fileName1,
                file_type: fileType,
                timestamp,
              });
            }

            await this.electronService.saveMessageToDb(roomId, senderId, this.currentUserId, null, fileName, fileType, timestamp);
            console.log(`💾 Сообщение сохранено в БД`);

            setTimeout(() => this.scrollToBottom(), 100);
          } catch (err) {
            console.error(`❌ Ошибка при расшифровке:`, err);
          }
        } else {
          console.error("❌ Ошибка: currentUserId не установлен.");
        }

        this.receivedChunks.delete(chunkId);
      }
    });
  }

  modularExponentiation(base: bigint, exponent: bigint, modulus: bigint) {
    let result = BigInt(1);
    base = BigInt(base) % BigInt(modulus);

    while (exponent > 0) {
      if (exponent % BigInt(2) === BigInt(1)) {
        result = (result * base) % BigInt(modulus);
      }
      exponent = exponent / BigInt(2);
      base = (base * base) % BigInt(modulus);
    }

    return result;
  }

  async handleProtocolInit(p: number, g: number, user_id: string, room_id: string): Promise<void> {
    console.log(`Handling protocol initialization with p: ${p}, g: ${g}, user_id: ${user_id}`);

    this.privateKey = this.generateRandomNumber(2, p - 2);
    const pk = BigInt(this.privateKey)
    const p_ = BigInt(p)
    const g_ = BigInt(g)

    this.publicKey = this.modularExponentiation(g_, pk, p_);

    console.log(`Generated private key: ${this.privateKey}`);
    console.log(`Generated public key: ${this.publicKey}`);

    const socket = this.socket;

    if (socket) {
      socket.emit('send_public_key', {
        user_id: user_id,
        room_id: room_id,
        current_user: sessionStorage.getItem('currentUserId'),
        public_key: Number(this.publicKey),
      });
    } else {
      console.log('нет сокета в handle protocol')
    }

  }

  generateRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  checkSecondUserConnection(roomId: string, user: string): void {
    console.log('checkSecondUserConnection')
    this.chatService.checkUserConnection(user, roomId).subscribe({
      next: async (response) => {
        if (response.status === 'Connected') {
          console.log('Both users connected');
          this.isSecondUserConnected = true;
          this.cdr.detectChanges();
          console.log('checkSecondUserConnection(roomId:', roomId)

          try {
            const existingKey = await this.electronService.getEncryptionSecretKey(roomId);

            console.log('existingKey', existingKey)
            if (!existingKey) {
              console.log(`No keys found. Star protocol...`);

              this.startProtocol(roomId);

            } else {
              console.log(`Keys already exist for user ${this.currentUserId}`);
            }
          } catch (error) {
            console.error('Database error:', error);
          }


        } else {
          console.error(response.message);
          this.isSecondUserConnected = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error checking second user connection', err);
        this.isSecondUserConnected = false;
        this.cdr.detectChanges();
      }
    });
  }

  trackByMessageId(index: number, message: any) {
    return message.timestamp;
  }

  async startProtocol(room_id: any) {
    console.log('startProtocol function')
    const socket = this.socket;
    console.log('socket', socket)

    if (socket) {
      console.log('socket.emit(start_protocol function')
      socket.emit('start_protocol', {
        room_id: room_id,
      });
    } else {
      console.log('нет сокета в start protocol')
    }
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe(); 
    }
  }



  selectRoom(room: any): void {
    this.selectedRoom = room;
    this.checkSecondUserConnection(room.id, room.other_user_id);
    console.log(room);
    this.loadMessagesForRoom(room.id);
    setTimeout(() => this.scrollToBottom(), 100);
  }

  loadUserRooms(clientId: string): void {
    this.chatService.getUserRooms(clientId).subscribe({
      next: (response) => {
        console.log(response)
        const connectedRooms: Room[] = response.connected_rooms.map((room: Room) => ({
          ...room,
          isAvailable: false
        }));

        const availableRooms: Room[] = response.available_rooms.map((room: Room) => ({
          ...room,
          isAvailable: true
        }));

        const combinedRooms: Room[] = [...connectedRooms, ...availableRooms];

        this.dataSource.data = combinedRooms;
      },
      error: (err) => {
        console.error('Ошибка при загрузке чатов:', err);
      }
    });
  }

  leaveRoom(roomId: string): void {
    this.chatService.leaveRoom(roomId).subscribe(
      response => {
        console.log(`Вы покинули чат ${roomId}`);
        this.loadUserRooms(this.currentUserId);
      },
      error => {
        console.error(`Ошибка при выходе из чата: ${error.message}`);
      }
    );
  }

  deleteRoom(roomId: string): void {
    this.chatService.deleteRoom(roomId).subscribe(
      response => {
        console.log(`Чат ${roomId} удалён`);
        this.loadUserRooms(this.currentUserId);
      },
      error => {
        console.error(`Ошибка при удалении чата: ${error.message}`);
      }
    );
  }

  joinRoom(roomId: string): void {
    console.log(`Вступаем в чат ${roomId}`);
    this.chatService.joinRoom(roomId).subscribe({
      next: () => {
        console.log('Вы успешно присоединились');
      },
      error: (err) => console.error('Ошибка при присоединении:', err)
    });
  }
}


interface Room {
  id: string;
  connected: boolean;
  encryption_algorithm: string;
  encryption_mode: string;
  other_user_id: string;
  username: string;
  padding_mode: string;
  isAvailable: boolean;
}


interface ChatMessage {
  room_id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string | null;
  file_path: string | null;
  file_type: string | null;
  timestamp: number;
}


