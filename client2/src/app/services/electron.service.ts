// src/app/services/electron.service.ts
import { Injectable } from '@angular/core';


@Injectable({
  providedIn: 'root',
})
export class ElectronService {

  async encryptMessage(newMessage: string, existingKey: any, encryption_algorithm: string, encryption_mode: string, padding_mode: string, iv: any) {
    return await this.electronAPI?.encryptMessage(newMessage, existingKey, encryption_algorithm, encryption_mode, padding_mode, iv);
  }

  async decryptMessage(message: string, existingKey: any, encryption_algorithm: string, encryption_mode: string, padding_mode: string, iv: any) {
    return await this.electronAPI?.decryptMessage(message, existingKey, encryption_algorithm, encryption_mode, padding_mode, iv);
  }

  async encryptFile(newMessage: any, existingKey: any, userId: string, fileName: string, encryption_algorithm: string, encryption_mode: string, padding_mode: string, iv: any) {
    return await this.electronAPI?.encryptFile(newMessage, existingKey, userId, fileName, encryption_algorithm, encryption_mode, padding_mode, iv);
  }

  async decryptFile(newMessage: any, existingKey: any, userId: string, fileName: string, encryption_algorithm: string, encryption_mode: string, padding_mode: string, iv: any) {
    return await this.electronAPI?.decryptFile(newMessage, existingKey, userId, fileName, encryption_algorithm, encryption_mode, padding_mode, iv);
  }

  async getMessagesFromDb(roomId: string): Promise<any> {
    const currentUser = sessionStorage.getItem('currentUserId');
    if (!currentUser) {
      console.error('Текущий пользователь не найден в сессии.');
      return [];
    }

    try {
      // Используем electronAPI для получения сообщений
      const messages = await this.electronAPI?.getMessagesFromDb(roomId, currentUser);
      console.log('Сообщения успешно загружены:', messages);
      return messages;
    } catch (error) {
      console.error('Ошибка при загрузке сообщений:', error);
      throw error; // Пробрасываем ошибку для обработки в компоненте
    }
  }

  async saveFile(userId: string, fileName: string, fileBuffer: ArrayBuffer): Promise<any> {
    if (!userId) {
      console.error('Ошибка: ID пользователя не указан.');
      return null;
    }

    try {
      const response = await this.electronAPI?.saveFile(userId, fileName, fileBuffer);

      if (response?.success) {
        console.log('Файл успешно сохранён:', response.filePath);
        return response.filePath;
      } else {
        console.error('Ошибка сохранения файла:', response?.error);
        return null;
      }
    } catch (error) {
      console.error('Ошибка при сохранении файла:', error);
      throw error;
    }
  }

  async eencryptMessage(
    messageText: string,
    key: string,
    encryption_algorithm: string,
    encryption_mode: string,
    padding_mode: string
  ) {
    // Кодирование строки в байты
    /* const messageBytes = new TextEncoder().encode(messageText);

    // Создаём экземпляр RC6 с нужными параметрами
    let rc6 = new RC6(key, encryption_mode, padding_mode);

    // Выполняем асинхронное шифрование
    return await rc6.encrypt(messageBytes); */
  }

  async saveMessageToDb(
    roomId: string,
    senderId: string,
    receiverId: string,
    messageText: string | null,
    filePath: string | null,
    fileType: string | null,
    timestamp: number
  ) {
    const currentUser = sessionStorage.getItem('currentUserId');
    console.log('saveMessageToDb', { roomId, senderId, receiverId, messageText, filePath, fileType, timestamp });

    if (!currentUser) {
      console.error('No current user found in session.');
      return;
    }

    // Проверяем, кто сохраняет сообщение
    if (currentUser === senderId) {
      console.log('saveMessageToDb: Sender saving message', roomId);
      return await this.electronAPI?.saveMessage(roomId, senderId, receiverId, messageText, filePath, fileType, timestamp);
    } else {
      console.log('saveMessageToDb: Receiver saving message', roomId);
      return await this.electronAPI?.saveMessageSecondUser(roomId, senderId, receiverId, messageText, filePath, fileType, timestamp);
    }
  }


  get electronAPI() {
    return window.electronAPI;
  }

  getAppPath(): Promise<string> {
    return this.electronAPI?.getAppPath();
  }

  async saveRoomSecretKey(roomId: any, secretKey: any) {
    const currentUser = sessionStorage.getItem('currentUserId')
    return await this.electronAPI?.saveRoomSecretKey(currentUser, roomId, secretKey);
  }

  async getEncryptionSecretKey(roomId: string) {
    console.log('async getEncryptionSecretKey(roomId: string) {', roomId)

    const secretKey = await this.electronAPI?.getEncryptionSecretKey(sessionStorage.getItem('currentUserId'), roomId);
    console.log('service getEncryptionSecretKey', secretKey)
    return secretKey;
  }

  async checkUserDatabase(userId: any) {
    console.log('this.electronAPI tttt', this.electronAPI)
    return await this.electronAPI?.checkUserDatabase(userId);
  }
}



export interface ChatMessage {
  id: number;
  room_id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  timestamp: number;
}