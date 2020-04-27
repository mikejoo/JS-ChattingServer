# JavaScript Chatting Website using Node.js and Socket.io

## How-to Use
1. Download files using git-clone
2. (Terminal) $ npm install socket.io 
3. (Terminal) $ node chatServer.js
4. Enter and go to localhost:3456 on favorite browser (prefarably Chrome)
5. Go to town (each browser window is a separate user)

## Functionalities
### Users/Rooms
1. Users must register on connection.
2. Users can create their own public rooms or private rooms that are locked with a password.
3. A chat rom displays all users currently in the room.
### Ban/Unban
1. The creator of a chat room can temporarily kick users out of the room or ban/unban a user from entering the room.
2. When users are banned from a chat room, they can send a private message to the creator of the room. 
### Invite
1. Users can invite another user into their current room. 
2. Users can see their most recent invite received. When invited to a private room, they do not need to know the password to enter.
### Private Messaging
1. Users can send private messages to other users in their current chat room.
2. Users can block/unblock other users from private messaging. 
