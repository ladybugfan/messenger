import json
import random
from flask import Flask, request, jsonify
import sqlite3
import os
import uuid
import hashlib
from flask_cors import CORS

from flask_socketio import SocketIO




app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins="*")


from flask import Flask, request, jsonify
from flask_socketio import SocketIO
import sqlite3

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")


DB_PATH = '/app/chat_app.db'

socket_connected_users = {}

@socketio.on('connect')
def handle_connect():
    user_id = request.args.get('userId')

    if user_id:
        try:
            socket_connected_users[user_id] = request.sid
            print(f'User {user_id} connected with session id {request.sid}')

            try:
                conn = sqlite3.connect(DB_PATH)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                cursor.execute('''
                    SELECT room_id FROM room_clients WHERE client_id = ?
                ''', (user_id,))
                rows = cursor.fetchall()

                connected_rooms = [row['room_id'] for row in rows]

                for room_id in connected_rooms:
                    cursor.execute('''
                        SELECT client_id FROM room_clients WHERE room_id = ?
                    ''', (room_id,))
                    users_in_room = cursor.fetchall()

                    for user in users_in_room:
                        other_user_id = user['client_id']
                        if other_user_id != user_id and other_user_id in socket_connected_users:
                            sid = socket_connected_users[other_user_id]

                            try:
                                socketio.emit('second_user_status_update', {'room_id': room_id}, room=sid)
                            except Exception as e:
                                print(f"Failed to notify user {other_user_id} in room {room_id}: {e}")

                conn.close()

            except sqlite3.Error as e:
                print(f"Database error: {str(e)}")
                
            socketio.emit('connected', {'message': 'Successfully connected to the server'}, to=request.sid)
            
        except Exception as e:
            print(f"Failed to store user {user_id} in socket_connected_users: {e}")
            socketio.emit('connect_error', {'error': 'Unable to store user in server'}, to=request.sid)

        
@socketio.on('disconnect')
def handle_disconnect():
    user_id = None
    for uid, sid in socket_connected_users.items():
        if sid == request.sid:
            user_id = uid
            break
        
    if user_id and user_id in socket_connected_users and socket_connected_users[user_id] == request.sid:
        del socket_connected_users[user_id]
        print(f'User {user_id} disconnected')
        
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute('''
                SELECT room_id FROM room_clients WHERE client_id = ?
            ''', (user_id,))
            rows = cursor.fetchall()

            connected_rooms = [row['room_id'] for row in rows]

            for room_id in connected_rooms:
                cursor.execute('''
                    SELECT client_id FROM room_clients WHERE room_id = ?
                ''', (room_id,))
                users_in_room = cursor.fetchall()

                for user in users_in_room:
                    other_user_id = user['client_id']
                    if other_user_id != user_id and other_user_id in socket_connected_users:
                        sid = socket_connected_users[other_user_id]

                        try:
                            socketio.emit('second_user_status_update', {'room_id': room_id}, room=sid)
                        except Exception as e:
                            print(f"Failed to notify user {other_user_id} in room {room_id}: {e}")

            conn.close()

        except sqlite3.Error as e:
            print(f"Database error: {str(e)}")
            
            
@socketio.on('sendMessage')
def handle_send_message(data):
    room_id = data.get('roomId')
    sender_id = data.get('senderId')
    receiver_id = data.get('receiverId')
    message_text = data.get('messageText')
    timestamp = data.get('timestamp')
    iv = data.get('iv')
    
    print('room_id', room_id)
    print('sender_id', sender_id)
    print('receiver_id', receiver_id)
    print('message_text', message_text)
    print('timestamp', timestamp)

    if not all([room_id, sender_id, timestamp]):
        print("Ошибка: недостающие данные.")
        return

    message = {
        'roomId': room_id,
        'senderId': sender_id,
        'receiverId': receiver_id,
        'messageText': message_text,
        'timestamp': timestamp,
        'iv': iv
    }

    sid = socket_connected_users[receiver_id]
    
    socketio.emit('receiveMessage', message, room=sid)
        
@socketio.on('sendFileChunk')
def handle_send_file_chunk(data):
    
    import time
    start_time = time.time()
    
    room_id = data.get('roomId')
    sender_id = data.get('senderId')
    receiver_id = data.get('receiverId')
    file_name = data.get('fileName')
    file_type = data.get('fileType')
    chunk_data = data.get('chunkData')
    timestamp = data.get('timestamp')
    chunk_id = data.get('chunkId')
    chunk_index = data.get('chunkIndex')
    total_chunks = data.get('totalChunks')
    iv = data.get('iv')
    
    print(room_id, sender_id, receiver_id, file_name, file_type, timestamp, chunk_id, chunk_index, total_chunks)

    if not all([room_id, sender_id, receiver_id, file_name, file_type, chunk_data, timestamp, chunk_id, chunk_index + 1, total_chunks]):
        print("Ошибка: недостающие данные при передаче файла.")
        return

    print(f"Передача чанка {chunk_index + 1}/{total_chunks} файла {file_name} от {sender_id} для {receiver_id}")

    receiver_sid = socket_connected_users.get(receiver_id)
    if receiver_sid:
        socketio.emit('receiveFileChunk', {
            'roomId': room_id,
            'senderId': sender_id,
            'receiverId': receiver_id,
            'fileName': file_name,
            'fileType': file_type,
            'chunkData': chunk_data,  
            'timestamp': timestamp,
            'chunkId': chunk_id,
            'chunkIndex': chunk_index,
            'totalChunks': total_chunks,
            'iv': iv,
        }, room=receiver_sid)
    else:
        print(f"Ошибка: получатель {receiver_id} не в сети.")
            
@socketio.on('send_public_key')
def handle_public_key(data):
    user_id = data.get('user_id')
    public_key = data.get('public_key')
    room_id = data.get('room_id')

    print(f"Received public key from {user_id}: {public_key}")

    if user_id in socket_connected_users:
        sid = socket_connected_users[user_id]
        print(f'Sending public key back to {user_id}')
        socketio.emit('receive_public_key', {
            'room_id': room_id,
            'public_key': public_key
        }, room=sid)


@socketio.on('start_protocol')
def handle_connect(data):
    room_id = data.get('room_id')
    print('start_protocol')
    print(room_id)

    if room_id:
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            cursor.execute('SELECT connected_users FROM rooms WHERE id = ?', (room_id,))
            room_data = cursor.fetchone()
            room_data = room_data[0]
            
            connected_users = deserialize_users(room_data)
            user_ids = list(connected_users)
            print('user_ids', user_ids)
            
            if len(user_ids) >= 2:
                user1, user2 = user_ids[0], user_ids[1]
                
                print('user1, user2', user1, user2)

                if user1 in socket_connected_users and user2 in socket_connected_users:
                    p = generate_random_prime()
                    print(p)
                    g = random.randint(2, 20)
                    print (g)
                
                    socket_id1 = socket_connected_users[user1]
                    socket_id2 = socket_connected_users[user2]

                    socketio.emit('protocol_init', {'p': p, 'g': g, 'user_id': user2, 'room_id':room_id}, room=socket_id1)
                    
                    socketio.emit('protocol_init', {'p': p, 'g': g, 'user_id': user1, 'room_id':room_id}, room=socket_id2)

                    print(f'Sent notification with p: {p}, g: {g} to users {user1} and {user2}')

                
        except sqlite3.Error as e:
            print(f"Database error: {str(e)}")

            return jsonify({'error': f'Database error: {str(e)}'}), 500

        except Exception as general_error:
            print('general_error')

            return jsonify({'error': f'Unexpected error:{str(general_error)}'}), 500

        finally:
            conn.close()
            
SUPPORTED_ALGORITHMS = ["RC5", "RC6"]
SUPPORTED_MODES = ["ECB", "CBC", "PCBC", "CFB", "OFB", "CTR", "Random Delta"]
SUPPORTED_PADDING = ["Zeros", "ANSI X.923", "PKCS7", "ISO 10126"]


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def init_db():
    db_file = '/app/chat_app.db'
    db_exists = os.path.exists(db_file)

    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            encryption_algorithm TEXT,
            encryption_mode TEXT,
            padding_mode TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            connected_users TEXT, 
            available_users TEXT  
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS room_clients (
            room_id TEXT,
            client_id TEXT,
            PRIMARY KEY (room_id, client_id),
            FOREIGN KEY (room_id) REFERENCES rooms(id)
        )
    ''')

    if not db_exists:
        print("Database created. Adding initial data...")
        cursor.execute('INSERT INTO users (id, username, password) VALUES (?, ?, ?)', 
                       (str(uuid.uuid4()), 'admin', hash_password('admin123')))

    conn.commit()
    conn.close()


init_db()

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    hashed_password = hash_password(password)
    user_id = str(uuid.uuid4())

    try:
        conn = sqlite3.connect('/app/chat_app.db')
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO users (id, username, password) VALUES (?, ?, ?)',
            (user_id, username, hashed_password)
        )
        conn.commit()
        conn.close()
        return jsonify({"message": "User registered successfully", "user_id": user_id}), 201
    except sqlite3.IntegrityError:
            return jsonify({"error": "User already exists"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    hashed_password = hash_password(password)

    conn = sqlite3.connect('/app/chat_app.db')
    cursor = conn.cursor()
    cursor.execute(
        'SELECT id FROM users WHERE username = ? AND password = ?',
        (username, hashed_password)
    )
    user = cursor.fetchone()
    conn.close()

    if user:
        return jsonify({"message": "Login successful", "user_id": user[0]}), 200
    return jsonify({"error": "Invalid credentials"}), 401


@app.route('/api/create_room', methods=['POST'])
def create_room():
    data = request.json
    currentUserId = data.get('currentUserId')
    selectedUserId = data.get('selectedUserId')  
    encryption_algorithm = data.get('encryption_algorithm')
    encryption_mode = data.get('encryption_mode')
    padding_mode = data.get('padding_mode')

    if encryption_algorithm not in SUPPORTED_ALGORITHMS:
        return jsonify({"error": f"Invalid encryption_algorithm. Supported: {', '.join(SUPPORTED_ALGORITHMS)}"}), 400
    if encryption_mode not in SUPPORTED_MODES:
        return jsonify({"error": f"Invalid encryption_mode. Supported: {', '.join(SUPPORTED_MODES)}"}), 400
    if padding_mode not in SUPPORTED_PADDING:
        return jsonify({"error": f"Invalid padding_mode. Supported: {', '.join(SUPPORTED_PADDING)}"}), 400

    room_id = str(uuid.uuid4())

    connected_users = json.dumps([currentUserId])  

    available_users = json.dumps([currentUserId, selectedUserId])

    try:
        conn = sqlite3.connect('/app/chat_app.db')
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO rooms (id, encryption_algorithm, encryption_mode, padding_mode, connected_users, available_users)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (room_id, encryption_algorithm, encryption_mode, padding_mode, connected_users, available_users))

        cursor.execute('INSERT INTO room_clients (room_id, client_id) VALUES (?, ?)', (room_id, currentUserId))
        cursor.execute('INSERT INTO room_clients (room_id, client_id) VALUES (?, ?)', (room_id, selectedUserId))


        conn.commit()
        conn.close()
        
        available_users_list = json.loads(available_users)
        
        for user_id in available_users_list:
            if user_id in socket_connected_users:
                sid = socket_connected_users[user_id]
                print(f"User {user_id} connected with session id: {sid}")

                try:
                    socketio.emit('update_user_rooms', {}, room=sid)
                except Exception as e:
                    print(f"Failed to emit message to user {user_id}: {e}")
            else:
                print(f"User {user_id} not found in socket_connected_users")
            
        return jsonify({"message": f"Room {room_id} created", "room_id": room_id}), 201

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/delete_room/<room_id>', methods=['DELETE'])
def delete_room(room_id):
    conn = sqlite3.connect('/app/chat_app.db')
    cursor = conn.cursor()

    try:
        cursor.execute('SELECT available_users FROM rooms WHERE id = ?', (room_id,))
        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "Room not found"}), 404

        available_users_list = json.loads(row[0])
        
        for user_id in available_users_list:
            if user_id in socket_connected_users:
                sid = socket_connected_users[user_id]
                print(f"User {user_id} connected with session id: {sid}")

                try:
                    socketio.emit('update_user_rooms', {}, room=sid)
                except Exception as e:
                    print(f"Failed to emit message to user {user_id}: {e}")
            else:
                print(f"User {user_id} not found in socket_connected_users")
        
        cursor.execute('DELETE FROM room_clients WHERE room_id = ?', (room_id,))

        cursor.execute('DELETE FROM rooms WHERE id = ?', (room_id,))
        
        conn.commit()
        
        return jsonify({"message": f"Room {room_id} deleted successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/leave_room/<room_id>', methods=['POST'])
def leave_room(room_id):
    client_id = request.json.get('client_id')

    if not client_id:
        return jsonify({"error": "client_id is required"}), 400

    try:
        conn = sqlite3.connect('/app/chat_app.db')
        cursor = conn.cursor()

        cursor.execute('SELECT connected_users, available_users FROM rooms WHERE id = ?', (room_id,))
        row = cursor.fetchone()

        if row:
            connected_users, available_users = row

            connected_users_list = deserialize_users(connected_users)

            if client_id in connected_users_list:
                connected_users_list.remove(client_id)  

                updated_connected_users = ','.join(connected_users_list)

                cursor.execute('''
                    UPDATE rooms SET connected_users = ? WHERE id = ?
                ''', (updated_connected_users, room_id))

                
                conn.commit()
                
                second_user_id = None
                for user_id in connected_users_list:
                    if user_id != client_id:
                        second_user_id = user_id
                        break

                if second_user_id and second_user_id in socket_connected_users:
                    sid = socket_connected_users[second_user_id]
                    print(f"User {user_id} connected with session id: {sid}")

                    try:
                        socketio.emit('second_user_status_update', {'roomId': room_id, 'user_id': user_id}, room=sid)
                    except Exception as e:
                        print(f"Failed to emit message to user {user_id}: {e}")
                        

                return jsonify({"message": f"{client_id} вышел из комнаты {room_id}"}), 200
            else:
                return jsonify({"message": f"{client_id} уже не находится в комнате {room_id}"}), 404
        else:
            return jsonify({"error": "Комната не найдена"}), 404

    except sqlite3.Error as e:
        return jsonify({"error": f"Ошибка выхода из чата: {str(e)}"}), 500
    finally:
        conn.close()


def deserialize_users(users_field):
    try:
        return json.loads(users_field) if users_field else []
    except json.JSONDecodeError:
        return users_field.split(",") if users_field else []


@app.route('/api/connect_client/<room_id>', methods=['POST'])
def connect_client(room_id):
    client_id = request.json.get('client_id')

    if not client_id:
        return jsonify({"error": "client_id is required"}), 400

    try:
        conn = sqlite3.connect('/app/chat_app.db')
        cursor = conn.cursor()

        cursor.execute('SELECT connected_users, available_users FROM rooms WHERE id = ?', (room_id,))
        row = cursor.fetchone()

        if row:
            connected_users, available_users = row

            connected_users_list = deserialize_users(connected_users)
            available_users_list = deserialize_users(available_users)

            if client_id not in connected_users_list:
                connected_users_list.append(client_id) 

                updated_connected_users = ','.join(connected_users_list)

                cursor.execute('''
                    UPDATE rooms SET connected_users = ? WHERE id = ?
                ''', (updated_connected_users, room_id))

                conn.commit()
                second_user_id = None
                for user_id in connected_users_list:
                    if user_id != client_id:
                        second_user_id = user_id
                        break

                if second_user_id and second_user_id in socket_connected_users:
                    sid = socket_connected_users[second_user_id]
                    print(f"User {user_id} connected with session id: {sid}")

                    try:
                        socketio.emit('second_user_status_update', {'roomId': room_id}, room=sid)
                    except Exception as e:
                        print(f"Failed to emit message to user {user_id}: {e}")
                        
                
                sid = socket_connected_users[client_id]

                try:
                    socketio.emit('update_user_rooms', {}, room=sid)
                except Exception as e:
                    print(f"Failed to emit message to user {client_id}: {e}")
                    

                return jsonify({"message": f"{client_id} присоединился к комнате {room_id}"}), 200
            else:
                return jsonify({"message": f"{client_id} уже находится в комнате {room_id}"}), 404
        else:
            return jsonify({"error": "Комната не найдена"}), 404

    except sqlite3.Error as e:
        return jsonify({"error": f"Ошибка подключения к комнате: {str(e)}"}), 500
    finally:
        conn.close()



@app.route('/api/user_rooms/<client_id>', methods=['GET'])
def get_user_rooms(client_id):
    
    conn = sqlite3.connect('/app/chat_app.db')
    cursor = conn.cursor()

    def extract_other_user(user_list, current_user_id):
       
        return next((user_id for user_id in user_list if user_id != current_user_id), None)

    def deserialize_users(users_field):
        
        try:
            return json.loads(users_field) if users_field else []
        except json.JSONDecodeError:
            return users_field.split(",") if users_field else []

    cursor.execute('''
        SELECT r.id, r.encryption_algorithm, r.encryption_mode, r.padding_mode, r.available_users, r.connected_users
        FROM rooms r
        WHERE r.connected_users LIKE ?
    ''', (f'%{client_id}%',))

    connected_rooms = []
    for row in cursor.fetchall():
        room_id, encryption_algorithm, encryption_mode, padding_mode, available_users, connected_users = row

        available_user_ids = deserialize_users(available_users)

        other_user_id = extract_other_user(available_user_ids, client_id)

        other_username = None
        if other_user_id:
            cursor.execute('SELECT username FROM users WHERE id = ?', (other_user_id,))
            result = cursor.fetchone()
            other_username = result[0] if result else None

        connected_user_ids = deserialize_users(connected_users)
        connected = other_user_id in connected_user_ids if other_user_id else False

        connected_rooms.append({
            "id": room_id,
            "encryption_algorithm": encryption_algorithm,
            "encryption_mode": encryption_mode,
            "padding_mode": padding_mode,
            "username": other_username,
            "other_user_id": other_user_id,
            "connected": connected
        })

    cursor.execute('''
        SELECT r.id, r.encryption_algorithm, r.encryption_mode, r.padding_mode, r.available_users, r.connected_users
        FROM rooms r
        WHERE r.available_users LIKE ?
        AND r.connected_users NOT LIKE ?
    ''', (f'%{client_id}%', f'%{client_id}%',))

    available_rooms = []
    for row in cursor.fetchall():
        room_id, encryption_algorithm, encryption_mode, padding_mode, available_users, connected_users = row

        available_user_ids = deserialize_users(available_users)

        other_user_id = extract_other_user(available_user_ids, client_id)

        other_username = None
        if other_user_id:
            cursor.execute('SELECT username FROM users WHERE id = ?', (other_user_id,))
            result = cursor.fetchone()
            other_username = result[0] if result else None

        connected_user_ids = deserialize_users(connected_users)
        connected = other_user_id in connected_user_ids if other_user_id else False

        available_rooms.append({
            "id": room_id,
            "encryption_algorithm": encryption_algorithm,
            "encryption_mode": encryption_mode,
            "padding_mode": padding_mode,
            "username": other_username,
            "other_user_id": other_user_id,
            "connected": connected
        })

    conn.close()

    return jsonify({
        "connected_rooms": connected_rooms,
        "available_rooms": available_rooms
    }), 200



@app.route('/api/users', methods=['GET'])
def get_users():
    conn = sqlite3.connect('/app/chat_app.db')
    cursor = conn.cursor()

    cursor.execute('SELECT id, username FROM users')
    users = [{"id": row[0], "username": row[1]} for row in cursor.fetchall()]

    conn.close()

    return jsonify(users), 200



@app.route('/api/rooms', methods=['GET'])
def list_rooms():
    conn = sqlite3.connect('/app/chat_app.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM rooms')
    rooms = [
        {
            "id": row[0],
            "encryption_algorithm": row[1],
            "encryption_mode": row[2],
            "padding_mode": row[3],
            "created_at": row[4],
            "connected_users": row[5],
            "available_users": row[6],
        }
        for row in cursor.fetchall()
    ]
    conn.close()

    return jsonify(rooms), 200



@app.route('/api/check_user_connection', methods=['POST'])
def check_user_connection():

    user_id = request.json.get('user_id')
    room_id = request.json.get('room_id')
    
    if not user_id or not room_id:
        return jsonify({'error': 'Both user_id and room_id are required'}), 400
    
    try:
        conn = sqlite3.connect('/app/chat_app.db')
        cursor = conn.cursor()

        cursor.execute('SELECT connected_users FROM rooms WHERE id = ?', (room_id,))
        room_data = cursor.fetchone()
        room_data = room_data[0]
        if not room_data:
            return jsonify({'status': 'Disconnected', 'message': 'Room not found'}), 404

        connected_users = deserialize_users(room_data)
        cursor.execute('SELECT * FROM room_clients WHERE room_id = ? AND client_id = ?', (room_id, user_id))
        client_in_room = cursor.fetchone()

        if client_in_room and user_id in connected_users and user_id in socket_connected_users:
            
            return jsonify({
                'status': 'Connected',
                'message': f'User {user_id} is in room {room_id} and connected to server'
            }), 200

        else:
            return jsonify({'status': 'Disconnected', 'message': f'User not fully connected {socket_connected_users}, {connected_users}, {client_in_room}'}), 200

    except sqlite3.Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500

    except Exception as general_error:
        return jsonify({'error': f'Unexpected error:{str(general_error)}'}), 500

    finally:
        conn.close()

def generate_random_prime(bit_length=52):
    while True:
        num = random.getrandbits(bit_length)
        num |= (1 << (bit_length - 1)) | 1
        if is_prime(num): 
            
            return num


def is_prime(n):
    if n <= 1:
        return False
    if n <= 3:
        return True
    if n % 2 == 0 or n % 3 == 0:
        return False
    i = 5
    while i * i <= n:
        if n % i == 0 or n % (i + 2) == 0:
            return False
        i += 6
    return True




@socketio.on('send_message')
def handle_send_message(data):
    room_id = data.get('room_id')
    sender_id = data.get('sender_id')
    message = data.get('message')

    if room_id and sender_id and message:
        message_data = {
            "sender_id": sender_id,
            "room_id": room_id,
            "message": message
        }
        print(f"Message from {sender_id} in room {room_id}: {message}")
        socketio.emit('receive_message', message_data, room=room_id)

@app.route('/api/send_message', methods=['POST'])
def send_message():
    data = request.json
    room_id = data.get('room_id')
    sender_id = data.get('sender_id')
    message = data.get('message')

    if room_id and sender_id and message:
        message_data = {
            "sender_id": sender_id,
            "room_id": room_id,
            "message": message
        }
        socketio.emit('receive_message', message_data, room=room_id)
        return jsonify({"message": "Message sent"}), 200

if __name__ == '__main__':
    print('гол')
    socketio.run(app, host='0.0.0.0', port=5000)