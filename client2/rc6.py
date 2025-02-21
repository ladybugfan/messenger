import asyncio
import base64
from enum import Enum
import os
import random
import multiprocessing
import concurrent
import sys


class EncryptionMode(Enum):
    ECB = "ECB"
    CBC = "CBC"
    PCBC = "PCBC"
    CFB = "CFB"
    OFB = "OFB"
    CTR = "CTR"
    RANDOM_DELTA = "Random Delta"

class PaddingMode(Enum):
    ZEROS = "Zeros"
    ANSI_X923 = "ANSI X.923"
    PKCS7 = "PKCS7"
    ISO_10126 = "ISO 10126"
    
class RC6:
    def __init__(self, key, padding_mode = PaddingMode.ZEROS, encryption_mode= EncryptionMode.ECB, iv: bytes = None, word_size = 32, rounds = 20,  ):
        self.word_size = word_size
        self.rounds = rounds
        self.key = key
        self.encryption_mode = encryption_mode
        self.padding_mode = padding_mode
        self.iv = iv
        self.delta = None
        self.S = self.key_schedule()

    def _rotl(self, x, y):
        y %= self.word_size
        return ((x << y) & ((1 << self.word_size) - 1)) | (x >> (self.word_size - y))

    def _rotr(self, x, y):
        y %= self.word_size
        return (x >> y) | ((x << (self.word_size - y)) & ((1 << self.word_size) - 1))

    def key_schedule(self):
        P, Q = 0xB7E15163, 0x9E3779B9
        L = [int.from_bytes(self.key[i:i + 4], 'little') for i in range(0, len(self.key), 4)]
        S = [(P + i * Q) % (2 ** self.word_size) for i in range(2 * self.rounds + 4)]
        A = B = i = j = 0
        for _ in range(3 * max(len(L), len(S))):
            A = S[i] = self._rotl((S[i] + A + B) % (2 ** self.word_size), 3)
            B = L[j] = self._rotl((L[j] + A + B) % (2 ** self.word_size), (A + B) % self.word_size)
            i = (i + 1) % len(S)
            j = (j + 1) % len(L)
        return S

    def encrypt_block(self, plaintext):
        A, B, C, D = [int.from_bytes(plaintext[i:i + 4], 'little') for i in range(0, 16, 4)]
        B = (B + self.S[0]) % (2 ** self.word_size)
        D = (D + self.S[1]) % (2 ** self.word_size)
        for i in range(1, self.rounds + 1):
            t = self._rotl(B * (2 * B + 1) % (2 ** self.word_size), 5)
            u = self._rotl(D * (2 * D + 1) % (2 ** self.word_size), 5)
            A = (self._rotl(A ^ t, u) + self.S[2 * i]) % (2 ** self.word_size)
            C = (self._rotl(C ^ u, t) + self.S[2 * i + 1]) % (2 ** self.word_size)
            A, B, C, D = B, C, D, A
        A = (A + self.S[2 * self.rounds + 2]) % (2 ** self.word_size)
        C = (C + self.S[2 * self.rounds + 3]) % (2 ** self.word_size)
        return b''.join(x.to_bytes(4, 'little') for x in [A, B, C, D])

    def decrypt_block(self, ciphertext):
        A, B, C, D = [int.from_bytes(ciphertext[i:i + 4], 'little') for i in range(0, 16, 4)]
        C = (C - self.S[2 * self.rounds + 3]) % (2 ** self.word_size)
        A = (A - self.S[2 * self.rounds + 2]) % (2 ** self.word_size)
        for i in range(self.rounds, 0, -1):
            A, B, C, D = D, A, B, C
            u = self._rotl(D * (2 * D + 1) % (2 ** self.word_size), 5)
            t = self._rotl(B * (2 * B + 1) % (2 ** self.word_size), 5)
            C = self._rotr((C - self.S[2 * i + 1]) % (2 ** self.word_size), t) ^ u
            A = self._rotr((A - self.S[2 * i]) % (2 ** self.word_size), u) ^ t
        D = (D - self.S[1]) % (2 ** self.word_size)
        B = (B - self.S[0]) % (2 ** self.word_size)
        return b''.join(x.to_bytes(4, 'little') for x in [A, B, C, D])

    def pad_data(self, data: bytes, block_size=16) -> bytes:
        if len(data) == 0:
            padding_length = block_size
        else:
            padding_length = block_size - (len(data) % block_size)
            
        print(self.padding_mode == PaddingMode.ZEROS)
        print(PaddingMode.ZEROS)

        if self.padding_mode == "Zeros":
            return data + b'\x00' * padding_length
        elif self.padding_mode == "ANSI X.923":
            return data + b'\x00' * (padding_length - 1) + bytes([padding_length])
        elif self.padding_mode == "PKCS7":
            return data + bytes([padding_length] * padding_length)
        elif self.padding_mode == "ISO 10126":
            return data + bytes([random.randint(0, 255) for _ in range(padding_length - 1)]) + bytes([padding_length])
        else:
            raise ValueError("Unsupported padding mode")
    
    
    def unpad_data(self, data: bytes, block_size=16) -> bytes:
        if self.padding_mode == "PKCS7":
            padding_length = data[-1]
            if padding_length < 1 or padding_length > block_size:
                raise ValueError("Incorrect padding length")
            if data[-padding_length:] != bytes([padding_length] * padding_length):
                raise ValueError("PKCS7 padding is incorrect")
            return data[:-padding_length]
        elif self.padding_mode == "ANSI X.923":
            padding_length = data[-1]
            return data[:-padding_length]
        elif self.padding_mode == "Zeros":
            return data.rstrip(b'\x00')
        elif self.padding_mode == "ISO 10126":
            return data[:-data[-1]]
        else:
            raise ValueError("Unsupported padding mode")

    async def encrypt_block_async(self, block: bytes) -> bytes:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self.encrypt_block, block)
    
    async def decrypt_block_async(self, block: bytes) -> bytes:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self.decrypt_block, block)

    """ async def encrypt_file(self, input_path, output_path):
        with open(input_path, 'rb') as f_in, open(output_path, 'wb') as f_out:
            # Обрабатываем данные блоками по 16 байт
            while True:
                block = f_in.read(1600)
                if not block:
                    break

                # Если блок меньше 16 байт, дополняем до 16 (PKCS#7 padding)
                if len(block) < 16:
                    block = self.pad_data(block)

                encrypted_block = await self.rc6_encrypt(block)
                f_out.write(encrypted_block)

    async def decrypt_file(self, input_path, output_path):
        with open(input_path, 'rb') as f_in, open(output_path, 'wb') as f_out:
            decrypted_data = b''

            # Обрабатываем данные блоками по 16 байт
            while True:
                block = f_in.read(1600)
                if not block:
                    break

                decrypted_block = await self.rc6_decrypt(block)
                f_out.write(decrypted_block)

            # После завершения чтения файла удаляем padding
            f_out.close()

            with open(output_path, 'rb') as f_in:
                data = f_in.read()

            unpadded_data = self.unpad_data(data)

            with open(output_path, 'wb') as f_out:
                f_out.write(unpadded_data) """
                
    async def encrypt_file(self, input_path, output_path):
        
        print("🔹 Начало работы", flush=True)

        print(f"🔄 Шифрование файла: {input_path} -> {output_path}")

        try:
            if not os.path.exists(input_path):
                raise FileNotFoundError(f"❌ Ошибка: Файл {input_path} не найден!")

            with open(input_path, "rb") as f_in:
                data = f_in.read()

            padded_data = self.pad_data(data)

            encrypted_data = await self.rc6_encrypt(padded_data)

            with open(output_path, "wb") as f_out:
                f_out.write(encrypted_data)

            print(f"✅ Файл зашифрован и сохранён: {output_path}")
        
        except FileNotFoundError as e:
            print(str(e))  
        except IOError as e:
            print(f"❌ Ошибка ввода-вывода: {str(e)}")  
        except Exception as e:
            print(f"❌ Общая ошибка: {str(e)}")  
            
    def encrypt_batch(self, batch):
        """Функция для шифрования пачки блоков"""
        return b"".join(self.encrypt_block(block) for block in batch)

    async def decrypt_file(self, input_path, output_path):
        with open(input_path, 'rb') as f_in:
            encrypted_data = f_in.read()

        decrypted_data = await self.rc6_decrypt(encrypted_data)

        unpadded_data = self.unpad_data(decrypted_data)
        print(unpadded_data)

        with open(output_path, 'wb') as f_out:
            f_out.write(unpadded_data)
        
    async def rc6_encrypt(self, data: bytes) -> bytes:
        block_size = 16
        data = self.pad_data(data, block_size)
        
        print('222')

        if self.encryption_mode == 'ECB':
            batch_size = 1000
            num_workers = max(1, os.cpu_count() - 1)  
            print(f"Используем потоки: {num_workers}")

            with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
                loop = asyncio.get_running_loop()
                
                tasks = []
                for i in range(0, len(data), block_size * batch_size):
                    batch = [data[j:j + block_size] for j in range(i, min(i + block_size * batch_size, len(data)), block_size)]
                    
                    tasks.append(loop.run_in_executor(executor, lambda b=batch: self.encrypt_batch(b)))

                encrypted_batches = await asyncio.gather(*tasks)

            return b"".join(encrypted_batches)

            """ tasks = [self.encrypt_block_async(data[i:i + block_size]) for i in range(0, len(data), block_size)]
            encrypted_blocks = await asyncio.gather(*tasks)
            return b"".join(encrypted_blocks) """

        elif self.encryption_mode == 'CBC':
            if not self.iv:
                self.iv = os.urandom(block_size)
            previous_block = self.iv
            encrypted_blocks = []

            for i in range(0, len(data), block_size):
                block = data[i:i + block_size]
                xored_block = bytes(a ^ b for a, b in zip(block, previous_block))
                encrypted_block = await self.encrypt_block_async(xored_block)
                encrypted_blocks.append(encrypted_block)
                previous_block = encrypted_block

            return b"".join(encrypted_blocks)

        elif self.encryption_mode == 'PCBC':
            if not self.iv:
                self.iv = os.urandom(block_size)
            previous_encrypted_block = self.iv
            previous_plain_block = b'\x00' * block_size
            encrypted_blocks = []

            for i in range(0, len(data), block_size):
                block = data[i:i + block_size]
                xored_block = bytes(a ^ b ^ c for a, b, c in zip(block, previous_encrypted_block, previous_plain_block))
                encrypted_block = await self.encrypt_block_async(xored_block)
                encrypted_blocks.append(encrypted_block)
                previous_plain_block = block
                previous_encrypted_block = encrypted_block

            return b"".join(encrypted_blocks)

        elif self.encryption_mode == 'CFB':
            if not self.iv:
                self.iv = os.urandom(block_size)
            previous_block = self.iv
            encrypted_blocks = []

            for i in range(0, len(data), block_size):
                encrypted_iv = await self.encrypt_block_async(previous_block)
                encrypted_block = bytes(a ^ b for a, b in zip(data[i:i + block_size], encrypted_iv))
                encrypted_blocks.append(encrypted_block)
                previous_block = encrypted_block

            return b"".join(encrypted_blocks)

        elif self.encryption_mode == 'OFB':
            if not self.iv:
                self.iv = os.urandom(block_size)
            previous_output = self.iv
            key_stream_blocks = []

            for _ in range(len(data) // block_size + 1):
                encrypted_block = await self.encrypt_block_async(previous_output)
                key_stream_blocks.append(encrypted_block)
                previous_output = encrypted_block

            encrypted_blocks = []
            for i in range(0, len(data), block_size):
                block = data[i:i + block_size]
                key_stream = key_stream_blocks[i // block_size]
                encrypted_block = bytes(a ^ b for a, b in zip(block, key_stream))
                encrypted_blocks.append(encrypted_block)

            return b"".join(encrypted_blocks)

        elif self.encryption_mode == 'CTR':
            
            iv_int = int.from_bytes(self.iv, 'big')
            
            
            
            tasks = [
                self.encrypt_block_async((iv_int + i // block_size).to_bytes(block_size, 'big'))
                for i in range(0, len(data), block_size)
            ]
            encrypted_counters = await asyncio.gather(*tasks)

            encrypted_blocks = [
                bytes(a ^ b for a, b in zip(data[i:i + block_size], encrypted_counters[i // block_size]))
                for i in range(0, len(data), block_size)
            ]
            return b"".join(encrypted_blocks)

        elif self.encryption_mode == 'RANDOM_DELTA':
            if not self.iv:
                self.iv = os.urandom(block_size)  
            
            encrypted_initial = await self.encrypt_block_async(self.iv)
            encrypted_blocks.append(encrypted_initial)
            
            self.delta = int.from_bytes(self.iv[-4:], byteorder="big")  
            
            previous_value = int.from_bytes(self.iv, byteorder="big")  

            encrypted_blocks = []

            
            padded_data = data

            for i in range(0, len(padded_data), block_size):
                block = padded_data[i:i + block_size]

                counter_block = previous_value.to_bytes(block_size, byteorder="big")
                
                xored_block = bytes(a ^ b for a, b in zip(block, counter_block))

                encrypted_block = await self.encrypt_block_async(xored_block)
                encrypted_blocks.append(encrypted_block)

                previous_value = (previous_value + self.delta) % (1 << (block_size * 8))

            return b"".join(encrypted_blocks)

        else:
            raise ValueError(f"Неподдерживаемый режим: {self.encryption_mode}")

    def decrypt_batch(self, batch):
        return b"".join(self.decrypt_block(block) for block in batch)

    async def encrypt_text(self, plaintext: str) -> bytes:
        data = plaintext.encode("utf-8")  
        padded_data = self.pad_data(data)  
        encrypted_data = await self.rc6_encrypt(padded_data)  
        return encrypted_data 


    async def decrypt_text(self, encrypted_data: bytes) -> str:
        decrypted_data = await self.rc6_decrypt(encrypted_data) 
        unpadded_data = self.unpad_data(decrypted_data)  
        return unpadded_data.decode("utf-8")  

    async def rc6_decrypt(self, data: bytes) -> bytes:
        block_size = 16
        batch_size = 1000

        if self.encryption_mode == 'ECB':
            num_workers = max(1, os.cpu_count() - 1)  
            print(f"Используем потоки для расшифровки: {num_workers}")

            with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
                loop = asyncio.get_running_loop()

                tasks = []
                for i in range(0, len(data), block_size * batch_size):
                    batch = [data[j:j + block_size] for j in range(i, min(i + block_size * batch_size, len(data)), block_size)]

                    tasks.append(loop.run_in_executor(executor, lambda b=batch: self.decrypt_batch(b)))

                decrypted_batches = await asyncio.gather(*tasks)

            decrypted_data = b"".join(decrypted_batches)
            return self.unpad_data(decrypted_data)

        elif self.encryption_mode == 'CBC':
            if not self.iv:
                self.iv = os.urandom(block_size)
            previous_block = self.iv
            decrypted_blocks = []

            for i in range(0, len(data), block_size):
                block = data[i:i + block_size]
                decrypted_block = await self.decrypt_block_async(block)
                xored_block = bytes(a ^ b for a, b in zip(decrypted_block, previous_block))
                decrypted_blocks.append(xored_block)
                previous_block = block

            decrypted_data = b"".join(decrypted_blocks)
            return self.unpad_data(decrypted_data)

        elif self.encryption_mode == 'PCBC':
            if not self.iv:
                self.iv = os.urandom(block_size)
            previous_encrypted_block = self.iv
            previous_plain_block = b'\x00' * block_size
            encrypted_blocks = []

            for i in range(0, len(data), block_size):
                block = data[i:i + block_size]
                decrypted_block = await self.decrypt_block_async(block)
                xored_block = bytes(a ^ b ^ c for a, b, c in zip(decrypted_block, previous_encrypted_block, previous_plain_block))
                encrypted_blocks.append(xored_block)
                previous_plain_block = xored_block
                previous_encrypted_block = block

            encrypted_data = b"".join(encrypted_blocks)
            return self.unpad_data(encrypted_data)

        elif self.encryption_mode == 'CFB':  
            if not self.iv:
                raise ValueError("O_o")
            previous_block = self.iv
            encrypted_blocks = []

            for i in range(0, len(data), block_size):
                encrypted_iv = await self.encrypt_block_async(previous_block)
                encrypted_block = bytes(a ^ b for a, b in zip(data[i:i + block_size], encrypted_iv))
                encrypted_blocks.append(encrypted_block)
                previous_block = data[i:i + block_size]

            encrypted_data = b"".join(encrypted_blocks)
            return  self.unpad_data(encrypted_data)
    
        elif self.encryption_mode == 'OFB':
            if not self.iv:
                self.iv = os.urandom(block_size)
            previous_output = self.iv
            key_stream_blocks = []

            for _ in range(len(data) // block_size + 1):
                encrypted_block = await self.encrypt_block_async(previous_output)
                key_stream_blocks.append(encrypted_block)
                previous_output = encrypted_block

            decrypted_blocks = []
            for i in range(0, len(data), block_size):
                block = data[i:i + block_size]
                key_stream = key_stream_blocks[i // block_size]
                decrypted_block = bytes(a ^ b for a, b in zip(block, key_stream))
                decrypted_blocks.append(decrypted_block)

            decrypted_data = b"".join(decrypted_blocks)
            return self.unpad_data(decrypted_data)
    
        elif self.encryption_mode == 'CTR':
            
            if self.iv == None:
                raise ValueError("Данные имеют некорректную длину для удаления набивки")
            
            iv_int = int.from_bytes(self.iv, 'big')
            
            tasks = [
                self.encrypt_block_async((iv_int + i // block_size).to_bytes(block_size, 'big'))
                for i in range(0, len(data), block_size)
            ]
            encrypted_counters = await asyncio.gather(*tasks)

            encrypted_blocks = [
                bytes(a ^ b for a, b in zip(data[i:i + block_size], encrypted_counters[i // block_size]))
                for i in range(0, len(data), block_size)
            ]
            encrypted_data = b"".join(encrypted_blocks)
            return self.unpad_data(encrypted_data)

        elif self.encryption_mode == 'RANDOM_DELTA':
            if len(data) < block_size:
                raise ValueError("Invalid data: too short to contain encrypted IV.")

            encrypted_initial = data[:block_size]
            encrypted_data = data[block_size:]  

            self.iv = await self.decrypt_block_async(encrypted_initial)
            self.delta = int.from_bytes(self.iv[-4:], byteorder="big")

            previous_value = int.from_bytes(self.iv, byteorder="big")

            decrypted_blocks = []

            if len(encrypted_data) % block_size != 0:
                raise ValueError("Encrypted data length must be aligned to block size.")

            for i in range(0, len(encrypted_data), block_size):
                encrypted_block = encrypted_data[i:i + block_size]

                counter_block = previous_value.to_bytes(block_size, byteorder="big")

                decrypted_block = await self.decrypt_block_async(encrypted_block)
                xored_block = bytes(a ^ b for a, b in zip(decrypted_block, counter_block))

                decrypted_blocks.append(xored_block)

                previous_value = (previous_value + self.delta) % (1 << (block_size * 8))

            decrypted_data = b''.join(decrypted_blocks)
            return self.unpad_data(decrypted_data)

            

        else:
            raise ValueError(f"Неподдерживаемый режим: {self.encryption_mode}")
        
key = b'1234567890abcdef'

rc6 = RC6(key, padding_mode=PaddingMode.ZEROS, encryption_mode= EncryptionMode.CTR)

#input_file = 'input.txt'  
#encrypted_file = 'output.txt'  
#decrypted_file = 'decrypted.txt' 

""" input_file = 'input.jpg'
encrypted_file = 'output.txt'
decrypted_file = 'decr.jpg' """

""" input_file = 'rrrr.mp4'
encrypted_file = 'output.txt'
decrypted_file = 'decr.mp4' """

""" async def main():
    await  rc6.encrypt_file(input_file, encrypted_file)
    print(f"Файл {input_file} успешно зашифрован в {encrypted_file}")

    # Расшифровка файла
    await  rc6.decrypt_file(encrypted_file, decrypted_file)
    print(f"Файл {encrypted_file} успешно расшифрован в {decrypted_file}")
    # Шифрование файла """



async def main():
    if len(sys.argv) < 9:
        print("Ошибка: недостаточно аргументов", file=sys.stderr)
        print("Использование: python rc6.py <encrypt|decrypt> <text|file_path> <mode> <padding> <key>", file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]  
    input_file = sys.argv[2]  
    output_file = sys.argv[3]  
    user_id = sys.argv[4]  
    key = sys.argv[5].encode() 
    mode = sys.argv[6]  
    padding = sys.argv[7]  
    iv = sys.argv[8] 
    
    iv_bytes = base64.b64decode(iv)
        

    rc6 = RC6(key=key, encryption_mode=mode, padding_mode=padding, iv = iv_bytes)  

    
    if command == "encrypt":
        await rc6.encrypt_file(input_file, output_file)
        print(f"Файл зашифрован: {output_file}")
    elif command == "decrypt":
        await rc6.decrypt_file(input_file, output_file)
        print(f"Файл расшифрован: {output_file}")
    else:
        print("Ошибка: неизвестная команда", file=sys.stderr)
        sys.exit(1)
    


if __name__ == '__main__':
    
    multiprocessing.freeze_support() 

    asyncio.run(main())
