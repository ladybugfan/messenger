// preload.js
const { contextBridge, ipcRenderer } = require('electron');


console.log('goal')
contextBridge.exposeInMainWorld('electronAPI', {

    saveRoomSecretKey: async (userId, roomId, secretKey) => {
        console.log('contextBridge: saveRoomSecretKey');
        return await ipcRenderer.invoke('saveRoomSecretKey', userId, roomId, secretKey);
    },
    getEncryptionSecretKey: async (userId, roomId) => {
        console.log('contextBridge: getEncryptionSecretKey');
        return ipcRenderer.invoke('getEncryptionSecretKey', userId, roomId);
    },
    checkUserDatabase: async (userId) => {
        console.log('contextBridge: checkUserDatabase');
        return await ipcRenderer.invoke('checkUserDatabase', userId);
    },

    saveMessage: async (roomId, senderId, receiverId, messageText, filePath, fileType, timestamp) => {
        console.log('contextBridge: saveMessage');
        return await ipcRenderer.invoke('saveMessage', roomId, senderId, receiverId, messageText, filePath, fileType, timestamp);
    },

    saveMessageSecondUser: async (roomId, senderId, receiverId, messageText, filePath, fileType, timestamp) => {
        console.log('contextBridge: saveMessageSecondUser');
        return await ipcRenderer.invoke('saveMessageSecondUser', roomId, senderId, receiverId, messageText, filePath, fileType, timestamp);
    },

    getMessagesFromDb: async (roomId, userId) => {
        console.log('contextBridge: getMessagesFromDb');
        return await ipcRenderer.invoke('getMessagesFromDb', roomId, userId);
    },

    saveFile: async (userId, fileName, fileBuffer) => {
        console.log('contextBridge: saveFile');
        return await ipcRenderer.invoke('saveFile', userId, fileName, fileBuffer);
    },

    getAppPath: async () => {
        console.log('contextBridge: getAppPath');
        return await ipcRenderer.invoke('getAppPath');
    },

    encryptMessage: async (newMessage, existingKey, encryption_algorithm, encryption_mode, padding_mode, iv) => {
        console.log('contextBridge: encryptMessage');
        return await ipcRenderer.invoke('encryptMessage', newMessage, existingKey, encryption_algorithm, encryption_mode, padding_mode, iv);
    },

    decryptMessage: async (message, existingKey, encryption_algorithm, encryption_mode, padding_mode, iv) => {
        console.log('contextBridge: encryptMessage');
        return await ipcRenderer.invoke('decryptMessage', message, existingKey, encryption_algorithm, encryption_mode, padding_mode, iv);
    },

    encryptFile: async (message, existingKey, userId, fileName, encryption_algorithm, encryption_mode, padding_mode, iv) => {
        console.log('contextBridge: encryptFile');
        return await ipcRenderer.invoke('encryptFile', message, existingKey, userId, fileName, encryption_algorithm, encryption_mode, padding_mode, iv);
    },

    decryptFile: async (message, existingKey, userId, fileName, encryption_algorithm, encryption_mode, padding_mode, iv) => {
        console.log('contextBridge: decryptFile');
        return await ipcRenderer.invoke('decryptFile', message, existingKey, userId, fileName, encryption_algorithm, encryption_mode, padding_mode, iv);
    },

});
