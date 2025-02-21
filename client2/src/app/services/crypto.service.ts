import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  
  async encryptMessage(
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




  constructor() { }
}
