const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const net = require('net');
const { exec } = require('child_process');
const express = require('express');
const { execFile } = require('child_process');
const { spawn } = require("child_process");


let mainWindow;
let angularProcess;

const expressApp = express();
const PORT = 3001;

// Директория с файлами (пусть это будет `db`)
const fileDirectory = path.join(app.getAppPath(), 'db');

// Раздача статических файлов
expressApp.use('/files', express.static(fileDirectory));

// Запуск сервера
expressApp.listen(PORT, () => {
    console.log(`Файловый сервер запущен на http://localhost:${PORT}/files`);
});



// Инициализация таблиц в базе данных
async function initializeDatabase(database) {
    try {
        await new Promise((resolve, reject) => {
            database.run(`
                CREATE TABLE IF NOT EXISTS rooms (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL
                )
            `, (err) => err ? reject(err) : resolve());
        });



        await new Promise((resolve, reject) => {
            database.run(`
                CREATE TABLE IF NOT EXISTS encryption_keys (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    room_id INTEGER UNIQUE,
                    secret_key TEXT
                )
            `, (err) => err ? reject(err) : resolve());
        });

        await new Promise((resolve, reject) => {
            database.run(`
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    room_id INTEGER,
                    sender_id TEXT,
                    receiver_id TEXT,
                    message_text TEXT,
                    file_path TEXT,
                    file_type TEXT, 
                    timestamp INTEGER,
                    FOREIGN KEY (room_id) REFERENCES rooms(id)
                    )
            `, (err) => err ? reject(err) : resolve());
        });



        console.log("Database initialized successfully");
    } catch (err) {
        console.error("Error initializing database:", err);
    }
}


ipcMain.handle('checkUserDatabase', async (event, userId) => {
    const dbPath = path.join(__dirname, 'db', `db_${userId}.sqlite`);
    console.log(`Проверка базы данных для пользователя: ${userId}`);

    if (!fs.existsSync(dbPath)) {
        console.log(`База данных для пользователя ${userId} не найдена. Создание новой базы.`);

        // Создаем новую базу данных и инициализируем её
        return new Promise((resolve, reject) => {
            const userDb = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error(`Ошибка при создании базы данных для пользователя ${userId}:`, err.message);
                    reject(err);
                } else {
                    console.log(`База данных для пользователя ${userId} успешно создана.`);

                    // Инициализируем таблицы
                    (async () => {
                        try {
                            await initializeDatabase(userDb);
                            console.log(`Таблицы для пользователя ${userId} успешно инициализированы.`);
                            resolve(userDb);
                        } catch (initErr) {
                            console.error(`Ошибка при инициализации таблиц для пользователя ${userId}:`, initErr.message);
                            reject(initErr);
                        }
                    })();
                }
            });
        });
    } else {
        console.log(`База данных для пользователя ${userId} уже существует.`);

        // Открываем существующую базу данных и возвращаем её
        return new Promise((resolve, reject) => {
            const userDb = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error(`Ошибка при открытии базы данных для пользователя ${userId}:`, err.message);
                    reject(err);
                } else {
                    console.log(`База данных для пользователя ${userId} успешно открыта.`);
                    resolve(userDb);
                }
            });
        });
    }
});

ipcMain.handle('getAppPath', () => {
    return app.getAppPath();
});



function checkUserDatabase(userId) {
    const dbPath = path.join(__dirname, 'db', `db_${userId}.sqlite`);
    console.log(`Проверка базы данных для пользователя: ${userId}`);

    // Проверяем наличие базы данных
    if (!fs.existsSync(dbPath)) {
        console.log(`База данных для пользователя ${userId} не найдена. Создание новой базы.`);
        return new Promise((resolve, reject) => {
            const userDb = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error(`Ошибка при создании базы данных для пользователя ${userId}:`, err.message);
                    reject(err);
                } else {
                    console.log(`База данных для пользователя ${userId} успешно создана.`);

                    // Вызываем initializeDatabase в асинхронной функции
                    (async () => {
                        try {
                            await initializeDatabase(userDb);
                            console.log(`Таблицы для пользователя ${userId} успешно инициализированы.`);
                            resolve(userDb);
                        } catch (initErr) {
                            console.error(`Ошибка при инициализации таблиц для пользователя ${userId}:`, initErr.message);
                            reject(initErr);
                        }
                    })();
                }
            });
        });
    } else {
        console.log(`База данных для пользователя ${userId} уже существует.`);
        return new sqlite3.Database(dbPath); // Открываем существующую базу
    }

}


ipcMain.handle('saveRoomSecretKey', async (event, userId, roomId, secretKey) => {
    console.log('saveRoomSecretKey');
    console.log('saveRoomSecretKey ', userId, roomId, secretKey);

    const userDb = await checkUserDatabase(userId); // Получаем базу данных пользователя

    // Используем новую структуру с async/await
    await new Promise((resolve, reject) => {
        userDb.serialize(() => {
            userDb.run("BEGIN TRANSACTION");  // Начало транзакции

            // Вставка ключа в базу
            userDb.run(
                `INSERT INTO encryption_keys (room_id, secret_key) VALUES (?, ?)`,
                [roomId, secretKey],
                async (err) => {
                    if (err) {
                        console.error('Ошибка сохранения ключа:', err.message);
                        userDb.run("ROLLBACK");  // Откат изменений при ошибке
                        reject(err.message);  // Завершаем Promise с ошибкой
                    } else {
                        console.log(`Ключ для комнаты ${roomId} пользователя ${userId} сохранён: ${secretKey}`);

                        // Применение изменений
                        userDb.run("COMMIT", async (commitErr) => {
                            if (commitErr) {
                                console.error('Ошибка при коммите:', commitErr.message);
                                reject(commitErr.message); // Завершаем Promise с ошибкой
                            }

                            // Чтение сохранённого ключа из базы
                            try {
                                const row = await new Promise((resolve, reject) => {
                                    userDb.get(`SELECT secret_key FROM encryption_keys WHERE room_id = ?`, [roomId], (err, row) => {
                                        if (err) {
                                            console.log('err eee', err);
                                            console.error('Ошибка получения ключа rrrr:', err.message);
                                            resolve(null);
                                        } else {
                                            console.log('rrrrrrr', row);
                                            resolve(row ? row.secret_key : null);
                                        }
                                    });
                                });
                                console.log('Retrieved secret key:', row);
                                resolve(row); // Завершаем Promise с успешным результатом
                            } catch (error) {
                                console.error('Ошибка при получении секретного ключа:', error);
                                reject(error);
                            }
                        });
                    }
                }
            );
        });
    });
});



ipcMain.handle('getEncryptionSecretKey', async (event, userId, roomId) => {
    try {
        console.log('ipcMain.handle(getEncryptionSecretKey', userId, roomId);

        const userDb = checkUserDatabase(userId);  // Получаем базу данных пользователя

        // Используем Promise и await для получения значения
        const row = await new Promise((resolve, reject) => {
            userDb.get(`SELECT secret_key FROM encryption_keys WHERE room_id = ?`, [roomId], (err, row) => {
                if (err) {
                    console.log('err', err)

                    console.error('Ошибка получения ключа:', err.message);
                    resolve(null);
                } else {
                    console.log('eeeee', row)

                    resolve(row ? row.secret_key : null);
                }
            });
        });
        console.log(row)

        return row;  // Возвращаем ключ сразу
    } catch (error) {
        console.error('Ошибка при получении секретного ключа:', error);
        return null;
    }
});


ipcMain.handle('saveMessage', async (event, roomId, senderId, receiverId, messageText, filePath, fileType, timestamp) => {
    console.log('saveMessage');
    console.log('Saving message for roomId:', roomId, 'senderId:', senderId, 'timestamp:', timestamp);

    const userDb = checkUserDatabase(senderId);
    console.log(userDb)

    userDb.all("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'", (err, rows) => {
        if (err) {
            console.error("Ошибка при проверке таблицы:", err.message);
        } else if (rows.length === 0) {
            console.error("Таблица 'messages' не существует.");
        } else {
            console.log("Таблица 'messages' успешно найдена.");
        }
    });

    await new Promise((resolve, reject) => {
        userDb.serialize(() => {
            userDb.run("BEGIN TRANSACTION");

            userDb.run(
                `INSERT INTO messages (room_id, sender_id, receiver_id, message_text, file_path, file_type, timestamp) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [roomId, senderId, receiverId, messageText || null, filePath || null, fileType || null, timestamp],
                async (err) => {
                    if (err) {
                        console.error('Ошибка сохранения сообщения:', err.message);
                        userDb.run("ROLLBACK");
                        reject(err.message);
                    } else {
                        console.log(`Сообщение для комнаты ${roomId} от пользователя ${senderId} сохранено`);

                        userDb.run("COMMIT", async (commitErr) => {
                            if (commitErr) {
                                console.error('Ошибка при коммите:', commitErr.message);
                                reject(commitErr.message); // Завершаем Promise с ошибкой
                            } else {
                                console.log('Сообщение успешно сохранено в базе данных');
                                resolve('Message saved successfully');
                            }
                        });
                    }
                }
            );
        });
    });
});

ipcMain.handle('getMessagesFromDb', async (event, roomId, userId) => {
    console.log('getMessagesFromDb');
    console.log('Получение сообщений для roomId:', roomId, 'userId:', userId);

    const userDb = checkUserDatabase(userId); // Получаем базу данных для пользователя
    console.log(userDb);

    // Проверяем, существует ли таблица 'messages'
    const tableExists = await new Promise((resolve, reject) => {
        userDb.all("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'", (err, rows) => {
            if (err) {
                console.error("Ошибка при проверке таблицы:", err.message);
                reject(err);
            } else {
                resolve(rows.length > 0); // Возвращаем true, если таблица существует
            }
        });
    });

    if (!tableExists) {
        console.error("Таблица 'messages' не существует.");
        return []; // Возвращаем пустой массив, если таблицы нет
    }

    // Получаем сообщения для указанной комнаты
    const messages = await new Promise((resolve, reject) => {
        userDb.all(
            `SELECT * FROM messages WHERE room_id = ? ORDER BY timestamp ASC`,
            [roomId],
            (err, rows) => {
                if (err) {
                    console.error('Ошибка при получении сообщений:', err.message);
                    reject(err);
                } else {
                    console.log(`Сообщения для комнаты ${roomId} успешно получены`);
                    resolve(rows); // Возвращаем строки с сообщениями
                }
            }
        );
    });

    return messages; // Возвращаем сообщения
});

ipcMain.handle('saveMessageSecondUser', async (event, roomId, senderId, receiverId, messageText, filePath, fileType, timestamp) => {
    console.log('saveMessage');
    console.log('Saving message for roomId:', roomId, 'receiverId:', receiverId, 'timestamp:', timestamp);

    const userDb = checkUserDatabase(receiverId);

    await new Promise((resolve, reject) => {
        userDb.serialize(() => {
            userDb.run("BEGIN TRANSACTION");

            userDb.run(
                `INSERT INTO messages (room_id, sender_id, receiver_id, message_text,file_path, file_type, timestamp) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [roomId, senderId, receiverId, messageText || null, filePath || null, fileType || null, timestamp],
                async (err) => {
                    if (err) {
                        console.error('Ошибка сохранения сообщения:', err.message);
                        userDb.run("ROLLBACK");
                        reject(err.message);
                    } else {
                        console.log(`Сообщение для комнаты ${roomId} от пользователя ${senderId} сохранено`);

                        userDb.run("COMMIT", async (commitErr) => {
                            if (commitErr) {
                                console.error('Ошибка при коммите:', commitErr.message);
                                reject(commitErr.message);
                            } else {
                                console.log('Сообщение успешно сохранено в базе данных');
                                resolve('Message saved successfully');
                            }
                        });
                    }
                }
            );
        });
    });
});

ipcMain.handle('saveFile', async (event, userId, fileName, fileBuffer) => {
    try {
        const dbPath = path.join(__dirname, 'db');
        const userFolderPath = path.join(dbPath, userId);
        const filePath = path.join(userFolderPath, fileName);

        if (!fs.existsSync(dbPath)) {
            fs.mkdirSync(dbPath, { recursive: true });
        }

        if (!fs.existsSync(userFolderPath)) {
            fs.mkdirSync(userFolderPath, { recursive: true });
        }

        fs.writeFileSync(filePath, Buffer.from(fileBuffer));
        console.log(`Файл сохранён: ${filePath}`);

        return { success: true, filePath };
    } catch (error) {
        console.error('Ошибка при сохранении файла:', error);
        return { success: false, error: error.message };
    }
});


const { mkdir, writeFile, unlink, readFile } = require("fs/promises");

ipcMain.handle("decryptFile", async (event, fileBuffer, key, userId, fileName, algorithm, mode, padding, iv) => {
    try {
        const userFolderPath = path.join(__dirname, "db", userId);
        const inputFilePath = path.join(userFolderPath, `encrypted_${Date.now()}_${fileName}`);
        const decryptedFilePath = path.join(userFolderPath, fileName);

        if (!fs.existsSync(userFolderPath)) {
            await mkdir(userFolderPath, { recursive: true });
        }

        if (fs.existsSync(inputFilePath)) {
            await unlink(inputFilePath);
        }

        await fs.promises.writeFile(inputFilePath, fileBuffer);
        console.log(`📂 Зашифрованный файл сохранён: ${inputFilePath}`);

        return new Promise((resolve, reject) => {
            const pythonProcess = spawn("python", [
                path.join(__dirname, "rc6.py"),
                "decrypt",
                inputFilePath,
                decryptedFilePath,
                userId,
                key,
                mode,
                padding,
                iv
            ]);

            let errorData = "";
            pythonProcess.stderr.on("data", (data) => {
                errorData += data.toString();
            });

            pythonProcess.on("close", async (code) => {
                if (code !== 0) {
                    console.error("❌ Ошибка при дешифровании:", errorData);
                    return reject({ success: false, error: errorData });
                }

                console.log(`✅ Файл расшифрован и сохранён: ${decryptedFilePath}`);

                try {
                    const decryptedData = await readFile(decryptedFilePath);
                    await unlink(inputFilePath).catch(() => { });
                    resolve({ success: true, decryptedData });
                } catch (fileError) {
                    reject({ success: false, error: fileError.message });
                }
            });
        });

    } catch (error) {
        console.error("❌ Ошибка при дешифровании файла:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("encryptFile", async (event, fileBuffer, key, userId, fileName, algorithm, mode, padding, iv) => {
    try {
        const tempPath = path.join(__dirname, "db", "temporaryFiles");
        const encryptedFileName = fileName;
        const encryptedFilePath = path.join(tempPath, encryptedFileName);
        const userFolderPath = path.join(__dirname, "db", userId);
        const inputFilePath = path.join(userFolderPath, fileName);

        if (!fs.existsSync(userFolderPath)) {
            await mkdir(userFolderPath, { recursive: true });
        }

        if (fs.existsSync(inputFilePath)) {
            await unlink(inputFilePath);
        }

        await fs.promises.writeFile(inputFilePath, Buffer.from(fileBuffer));
        console.log(`📂 Файл сохранён в папку пользователя: ${inputFilePath}`);


        return new Promise((resolve, reject) => {
            const pythonProcess = spawn("python", [
                path.join(__dirname, "rc6.py"),
                "encrypt",
                inputFilePath,
                encryptedFilePath,
                userId,
                key,
                mode,
                padding,
                iv
            ]);

            let errorData = "";
            pythonProcess.stderr.on("data", (data) => {
                errorData += data.toString();
            });

            pythonProcess.on("close", async (code) => {
                if (code !== 0) {
                    console.error("❌ Ошибка при шифровании:", errorData);
                    return reject({ success: false, error: errorData });
                }

                console.log(`✅ Файл зашифрован: ${encryptedFilePath}`);

                try {
                    const encryptedData = await fs.promises.readFile(encryptedFilePath);
                    await unlink(encryptedFilePath).catch(() => { });
                    resolve({ success: true, encryptedData });
                } catch (fileError) {
                    reject({ success: false, error: fileError.message });
                }
            });
        });

    } catch (error) {
        console.error("❌ Ошибка при шифровании файла:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("encryptMessage", async (event, messageText, existingKey, encryptionAlgorithm, encryptionMode, paddingMode, iv) => {
    try {
        console.log(messageText, existingKey, encryptionAlgorithm, encryptionMode, paddingMode)
        const tempPath = path.join(__dirname, "db", "temporaryFiles");
        const inputFileName = `message_${Date.now()}.txt`;
        const inputFilePath = path.join(tempPath, inputFileName);
        const encryptedFileName = inputFileName;
        const encryptedFilePath = path.join(tempPath, encryptedFileName);

        console.log(tempPath, inputFileName, inputFilePath)

        await fs.promises.mkdir(tempPath, { recursive: true });

        await fs.promises.writeFile(inputFilePath, messageText, "utf-8");
        console.log(`📂 Файл с сообщением сохранён: ${inputFilePath}`);
        console.log(inputFilePath)
        console.log(encryptedFilePath)

        return new Promise((resolve, reject) => {
            const pythonProcess = spawn("python", [
                path.join(__dirname, "rc6.py"),
                "encrypt",
                inputFilePath,   // 📂 Входной (исходный) файл
                encryptedFilePath, // 📂 Выходной (зашифрованный) файл
                null,
                existingKey,
                encryptionMode,
                paddingMode,
                iv
            ]);

            // 🔹 Реальное отображение print() из Python
            pythonProcess.stdout.on("data", (data) => {
                console.log(`🐍 [Python]: ${data.toString().trim()}`);
            });

            pythonProcess.stderr.on("data", (data) => {
                console.error(`❌ [Python Error]: ${data.toString().trim()}`);
            });

            pythonProcess.on("close", async (code) => {
                if (code !== 0) {
                    reject({ success: false, error: `Python process exited with code ${code}` });
                    return;
                }

                try {
                    const encryptedData = await fs.promises.readFile(encryptedFilePath);
                    console.log("🔒 Зашифрованные данные:", encryptedData.toString("hex"));

                    await fs.promises.unlink(inputFilePath).catch(() => { });
                    // await fs.promises.unlink(encryptedFilePath).catch(() => {});

                    resolve({ success: true, encryptedMessage: encryptedData });
                } catch (readError) {
                    console.error("❌ Ошибка чтения зашифрованного файла:", readError);
                    reject({ success: false, error: readError.message });
                }
            });
        });

    } catch (error) {
        console.error("❌ Ошибка при шифровании сообщения:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("decryptMessage", async (event, messageText, existingKey, encryptionAlgorithm, encryptionMode, paddingMode, iv) => {
    try {
        console.log(messageText, existingKey, encryptionAlgorithm, encryptionMode, paddingMode)
        const tempPath = path.join(__dirname, "db", "temporaryFiles");
        const inputFileName = `message_${Date.now()}.txt`;
        const inputFilePath = path.join(tempPath, inputFileName);
        const decryptedFileName = inputFileName;
        const decryptedFilePath = path.join(tempPath, decryptedFileName);

        console.log(tempPath, inputFileName, inputFilePath)

        await fs.promises.mkdir(tempPath, { recursive: true });

        /* const decoder = new TextDecoder("utf-8");
        const decodedText = decoder.decode(messageText); */

        const decodedBytes = Uint8Array.from(atob(messageText), c => c.charCodeAt(0));

        // Записываем строку в файл
        await fs.promises.writeFile(inputFilePath, decodedBytes, "utf-8");
        console.log(`📂 Файл с сообщением сохранён: ${inputFilePath}`);

        return new Promise((resolve, reject) => {
            const pythonProcess = spawn("python", [
                path.join(__dirname, "rc6.py"),
                "decrypt",
                inputFilePath,   // 📂 Входной (исходный) файл
                decryptedFilePath, // 📂 Выходной (зашифрованный) файл
                null,
                existingKey,
                encryptionMode,
                paddingMode,
                iv
            ]);

            // 🔹 Реальное отображение print() из Python
            pythonProcess.stdout.on("data", (data) => {
                console.log(`🐍 [Python]: ${data.toString().trim()}`);
            });

            pythonProcess.stderr.on("data", (data) => {
                console.error(`❌ [Python Error]: ${data.toString().trim()}`);
            });

            pythonProcess.on("close", async (code) => {
                if (code !== 0) {
                    reject({ success: false, error: `Python process exited with code ${code}` });
                    return;
                }

                try {
                    const decryptedData = await fs.promises.readFile(decryptedFilePath);

                    // Преобразуем буфер в строку (например, используя UTF-8)
                    const decryptedString = decryptedData.toString('utf-8');

                    console.log("🔒 Расшифрованные данные:", decryptedString);

                    await fs.promises.unlink(decryptedFilePath).catch(() => { });
                    // await fs.promises.unlink(encryptedFilePath).catch(() => {});

                    resolve({ success: true, decryptedMessage: decryptedData });
                } catch (readError) {
                    console.error("❌ Ошибка чтения расшифрованного файла:", readError);
                    reject({ success: false, error: readError.message });
                }
            });
        });

    } catch (error) {
        console.error("❌ Ошибка при расшифровке сообщения:", error);
        return { success: false, error: error.message };
    }
});


function isPortFree(port) {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.once('error', () => {
            resolve(false);
        });

        server.once('listening', () => {
            server.close();
            resolve(true);
        });

        server.listen(port, '127.0.0.1');
    });
}

async function findFreePort(startPort = 4200) {
    let port = startPort;

    while (!(await isPortFree(port))) {
        console.log(`Port ${port} is already in use. Trying next port...`);
        port++;
    }

    console.log(`Found free port: ${port}`);
    return port;
}

function createWindow(port) {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    console.log(`Loading Electron window with Angular on port: ${port}`);
    mainWindow.loadURL(`http://localhost:${port}/`);
}

async function runAngularApp() {
    const freePort = await findFreePort();

    console.log(`Starting Angular application on port ${freePort}...`);

    const angularProcess = exec(`ng serve --port ${freePort}`);

    angularProcess.stdout.on('data', (data) => {
        console.log(`Angular Output: ${data}`);
    });

    angularProcess.stderr.on('data', (error) => {
        console.error(`Angular Error: ${error}`);
    });

    createWindow(freePort);
}

app.whenReady().then(runAngularApp);

app.on('window-all-closed', () => app.quit());

function stopAngularApp() {
    if (angularProcess) {
        console.log('Stopping Angular application...');
        angularProcess.kill();
        console.log('Angular application stopped.');
    }
}

app.on('quit', stopAngularApp);