// Quoted from course wiki: https://classes.engineering.wustl.edu/cse330/index.php?title=Socket.IO
// Section: chat server
// Learn socket.io from https://socket.io/docs/rooms-and-namespaces/
// Learn how to emit to the right client from: https://stackoverflow.com/questions/32674391/io-emit-vs-socket-emit

// Require the packages we will use:
let http = require("http"),
    socketio = require("socket.io"),
    fs = require("fs");

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
let app = http.createServer(function (req, resp) {
    // This callback runs when a new connection is made to our HTTP server.

    fs.readFile("chatClient.html", function (err, data) {
        // This callback runs when the client.html file has been read from the filesystem.

        if (err) return resp.writeHead(500);
        resp.writeHead(200);
        resp.end(data);
    });
});
app.listen(3456);

// Change to user-centric
// Inspired by TA Jeong Min Lim on Monday, April 6, on how to store user's info.
// helped by TA Anda, users just store all the logged in users, and we keep track of who's in the room in the rooms array
let users = []; //store as {user: username, id: socket.id, blocklist:[]}
// The outside username can let us quickly find out if a username exist or not
let rooms = [{ roomName: 'Lobby', admin: 'ADMIN', users: [], type: 'Public', banList: [] }];
//let counter = 0; // count how many people in the room
//let peopleInRoom = ""; // to print out the users in a room

let io = socketio.listen(app);
io.sockets.on("connection", function (socket) {
    //when new user is created
    socket.on('createUser_to_server', function (data) {
        if (data === "" || data === null) {
            socket.emit('userExist_to_client', 'You must enter a username to start chatting.');
            return;
        }

        if (data === 'ADMIN') {
            socket.emit('userExist_to_client', 'INVALID USERNAME');
            return;
        }
        for (let i = 0; i < users.length; i++) {
            if (users[i] === data) {
                socket.emit('userExist_to_client', data + ' username already taken, please try a different username.');
                return;
            }
        }
        socket.user = data;
        socket.room = 'Lobby';
        users.push({ user: data, id: socket.id, blocklist: [] });
        rooms[0].users.push(data);
        socket.join('Lobby');
        console.log("New User: " + data + " (id: " + socket.id + ")");
        //broadcast people that a newbie has entered chat server
        socket.broadcast.emit('newUser_to_client', data, rooms[0]);
        //init page for newbie
        socket.emit('userSet_to_client', data, rooms);
    });

    //send message to client
    socket.on('message_to_server', function (user, message) {
        socket.to(socket.room).emit('message_to_client', user, message);
        socket.emit('message_to_client', user, message);
    });

    //create public room
    socket.on('createPublicRoom_to_server', function (data) {
        for (let i = 0; i < rooms.length; i++) {
            if (rooms[i].roomName === data) {
                let fail_message = 'Room name already exists! Please try again.';
                socket.emit('fail_to_client', fail_message);
                return;
            }
        }

        let owner = socket.user;

        rooms.push({ roomName: data, admin: owner, type: 'Public', banList: [], users: [] });
        console.log("New room created: " + data);
        socket.broadcast.emit('newPublicRoomCreated_to_client', data, owner);
        socket.emit('newPublicRoomCreated_to_client', data, owner);
    });

    //create private room
    socket.on('createPrivateRoom_to_server', function (data, pw) {
        for (let i = 0; i < rooms.length; i++) {
            if (rooms[i].roomName === data) {
                let fail_message = 'Room name already exists! Please try again.';
                socket.emit('fail_to_client', fail_message);
                return;
            }
        }

        let owner = socket.user;

        rooms.push({ roomName: data, admin: owner, type: 'Private', banList: [], users: [], pw: pw });
        console.log("New room created: " + data);
        socket.broadcast.emit('newPrivateRoomCreated_to_client', data, owner);
        socket.emit('newPrivateRoomCreated_to_client', data, owner);
    });

    //join a public room
    socket.on('joinPublicRoom_to_server', function (curRoom, newRoom) {
        socket.leave(curRoom);
        socket.join(newRoom);
        socket.room = newRoom;

        for (let i = 0; i < rooms.length; i++) {
            if (rooms[i].roomName === newRoom) {
                for (let j = 0; j < rooms[i].banList.length; j++) {
                    if (rooms[i].banList[j] === socket.user) {
                        socket.emit('joinfail_to_client', rooms[i].admin, newRoom);
                        return;
                    }
                }

                for (let j = 0; j < rooms.length; j++) {
                    if (rooms[j].roomName === curRoom) {
                        for (let k = 0; k < rooms[j].users.length; k++) {
                            if (rooms[j].users[k] === socket.user) {
                                rooms[j].users.splice(k, 1);
                                console.log(socket.user + " left " + curRoom);
                                //update pages for other users in the previous room
                                socket.to(curRoom).broadcast.emit('leftRoom_to_client', socket.user, rooms[j].users);
                                break;
                            }
                        }
                        break;
                    }
                }

                rooms[i].users.push(socket.user);
                console.log(socket.user + " joined " + newRoom);
                //update page for user in new room
                socket.emit('joinRoom_to_client', socket.user, newRoom, rooms[i].users);
                //update page for other users in new room
                socket.to(newRoom).broadcast.emit('joinRoom_to_client', socket.user, newRoom, rooms[i].users);
                break;
            }
        }
    });

    //join a private room
    socket.on('joinPrivateRoom_to_server', function (curRoom, newRoom, pw) {
        socket.leave(curRoom);
        socket.join(newRoom);
        socket.room = newRoom;

        for (let i = 0; i < rooms.length; i++) {
            if (rooms[i].roomName === newRoom) {
                for (let j = 0; j < rooms[i].banList.length; j++) {
                    if (rooms[i].banList[j] === socket.user) {
                        socket.emit('joinfail_to_client', rooms[i].admin, newRoom);
                        return;
                    }
                }

                if (rooms[i].pw !== pw) {
                    socket.emit('fail_to_client', 'Password is wrong! Please try again.');
                    return;
                }

                for (let j = 0; j < rooms.length; j++) {
                    if (rooms[j].roomName === curRoom) {
                        for (let k = 0; k < rooms[j].users.length; k++) {
                            if (rooms[j].users[k] === socket.user) {
                                rooms[j].users.splice(k, 1);
                                console.log(socket.user + " left " + curRoom);
                                //update pages for other users in the previous room
                                socket.to(curRoom).broadcast.emit('leftRoom_to_client', socket.user, rooms[j].users);
                                break;
                            }
                        }
                        break;
                    }
                }

                rooms[i].users.push(socket.user);
                console.log(socket.user + " joined " + newRoom);
                //update page for user in new room
                socket.emit('joinRoom_to_client', socket.user, newRoom, rooms[i].users);
                //update page for other users in new room
                socket.to(newRoom).broadcast.emit('joinRoom_to_client', socket.user, newRoom, rooms[i].users);
                break;
            }
        }
    });

    socket.on('sendDM_to_server', function (sender, target, msg) {
        for (let i = 0; i < users.length; i++) {
            if (users[i].user === target) {
                for (let j = 0; j < users[i].blocklist.length; j++) {
                    if (users[i].blocklist[j] === sender) {
                        socket.emit('fail_to_client', target + " has blocked you from private messages!");
                        return;
                    }
                }
                socket.to(users[i].id).emit('sendDM_to_client', sender, target, msg);
                socket.emit('sendDM_to_client', sender, target, msg);
                break;
            }
        }
    });

    socket.on('blocklist_to_server', function (username, blockUser) {
        for (let i = 0; i < users.length; i++) {
            if (users[i].user === username) {
                for (let j = 0; j < users[i].blocklist.length; j++) {
                    if (users[i].blocklist[j] === blockUser) {
                        socket.emit('fail_to_client', blockUser + " is already blocked!");
                        return;
                    }
                }

                for (let j = 0; j < users.length; j++) {
                    if (users[j].user === blockUser) {
                        users[i].blocklist.push(blockUser);
                        socket.emit('blocklist_to_client', blockUser);
                        return;
                    }
                }

                socket.emit('fail_to_client', blockUser + " does not exist! Please try again.");

                break;
            }
        }
    });

    socket.on('unblock_to_server', function (username, unblockUser) {
        //console.log('enterd');
        for (let i = 0; i < users.length; i++) {
            if (users[i].user === username) {
                for (let j = 0; j < users[i].blocklist.length; j++) {
                    if (users[i].blocklist[j] === unblockUser) {
                        //console.log('before' + users[i].blocklist);
                        users[i].blocklist.splice(j, 1);
                        //console.log('after' + users[i].blocklist);
                        socket.emit('unblock_to_client', users[i].blocklist);
                        return;
                    }
                }
            }
        }
    });

    socket.on('kick_to_server', function (kickUser, user, curRoom) {
        if (kickUser === "") {
            socket.emit('fail_to_client', 'You must enter a username to kick!');
            return;
        }

        if (kickUser === user) {
            socket.emit('fail_to_client', 'You cannot kick yourself from the room!');
            return;
        }

        let kickID = "";

        for (let i = 0; i < users.length; i++) {
            if (users[i].user === kickUser) {
                kickID = users[i].id;
                break;
            }
        }

        if (kickID === "") {
            socket.emit('fail_to_client', kickUser + " does not exist!");
            return;
        }

        for (let i = 0; i < rooms.length; i++) {
            if (rooms[i].roomName === curRoom) {
                if (rooms[i].admin !== user) {
                    socket.emit('fail_to_client', 'You do not have permission to kick a user from this room!');
                    return;
                }

                for (let j = 0; j < rooms[i].users.length; j++) {
                    if (rooms[i].users[j] === kickUser) {
                        console.log(kickUser + " was kicked from " + curRoom);
                        socket.to(curRoom).broadcast.emit('message_to_client', 'ADMIN', user + ' has kicked ' + kickUser + ' from ' + curRoom + '!');
                        socket.emit('message_to_client', 'ADMIN', user + ' has kicked ' + kickUser + ' from ' + curRoom + '!');
                        socket.to(kickID).emit('kicked_to_client');
                        return;
                    }
                }
                socket.emit('fail_to_client', kickUser + " is not in this room!");
                return;
            }
        }
    });

    socket.on('ban_to_server', function (banUser, user, curRoom) {
        if (banUser === "") {
            socket.emit('fail_to_client', 'You must enter a username to ban!');
            return;
        }

        if (banUser === user) {
            socket.emit('fail_to_client', 'You cannot ban yourself from the room!');
            return;
        }

        let banID = "";

        for (let i = 0; i < users.length; i++) {
            if (users[i].user === banUser) {
                banID = users[i].id;
                break;
            }
        }

        if (banID === "") {
            socket.emit('fail_to_client', banUser + " does not exist!");
            return;
        }

        for (let i = 0; i < rooms.length; i++) {
            if (rooms[i].roomName === curRoom) {
                if (rooms[i].admin !== user) {
                    socket.emit('fail_to_client', 'You do not have permission to ban a user from this room!');
                    return;
                }

                for (let j = 0; j < rooms[i].users.length; j++) {
                    if (rooms[i].users[j] === banUser) {
                        console.log(banUser + " was banned from " + curRoom);
                        socket.to(curRoom).broadcast.emit('message_to_client', 'ADMIN', user + ' has banned ' + banUser + ' from ' + curRoom + '!');
                        socket.emit('message_to_client', 'ADMIN', user + ' has banned ' + banUser + ' from ' + curRoom + '!');

                        socket.to(banID).emit('banned_to_client');
                        return;
                    }
                }
                socket.emit('fail_to_client', banUser + " is not in this room!");
                return;
            }
        }
    });

    socket.on('banned_to_server', function (curRoom) {
        socket.leave(curRoom);
        socket.join('Lobby');
        socket.room = 'Lobby';

        let adminID;

        for (let i = 0; i < rooms.length; i++) {
            if (rooms[i].roomName === curRoom) {
                rooms[i].banList.push(socket.user);
                for (let j = 0; j < users.length; j++) {
                    if (users[j].user === rooms[i].admin) {
                        adminID = users[j].id;
                        break;
                    }
                }

                for (let j = 0; j < rooms[i].users.length; j++) {
                    if (rooms[i].users[j] === socket.user) {
                        rooms[i].users.splice(j, 1);
                        socket.to(curRoom).broadcast.emit('leftRoom_to_client', socket.user, rooms[i].users);
                        break;
                    }
                }

                socket.to(adminID).emit('banListUpdate_to_client', socket.user, curRoom);
                break;
            }
        }

        rooms[0].users.push(socket.user);
        console.log(socket.user + " joined Lobby");
        //update page for user in new room
        socket.emit('joinRoom_to_client', socket.user, 'Lobby', rooms[0].users);
        //update page for other users in new room
        socket.to('Lobby').broadcast.emit('joinRoom_to_client', socket.user, 'Lobby', rooms[0].users);

    });

    socket.on('unban_to_server', function(bannedUser, roomName) {
        let banID;
        for (let i = 0 ; i < users.length ; i++) {
            if (users[i].user === bannedUser) {
                banID = users[i].id;
            }
            break;
        }

        for (let i = 0 ; i < rooms.length ; i++) {
            if (rooms[i].roomName === roomName) {
                for (let j = 0 ; j < rooms[i].banList.length ; j++) {
                    if (rooms[i].banList[j] === bannedUser) {
                        rooms[i].banList.splice(j, 1);
                        socket.emit('unbanUpdate_to_client', bannedUser, roomName);
                        break;
                    }
                }
                break;
            }
        }
        socket.to(banID).emit('unbanned_to_client', roomName);
        io.sockets.emit('message_to_client', 'ADMIN', bannedUser + " is unbanned from " + roomName + "!");
    });

    socket.on('invite_to_server', function(inviteUser, curRoom) {
        let inviteID = "";

        for (let i = 0 ; i < users.length ; i++) {
            if (users[i].user === inviteUser) {
                inviteID = users[i].id;
                break;
            }
        }

        if (inviteID === "") {
            socket.emit('fail_to_client', inviteUser + ' does not exist!');
            return;
        }

        let roomType = "";
        let pw = "";
        for (let i = 0 ; i < rooms.length ; i++) {
            if (rooms[i].roomName === curRoom) {
                for (let j = 0 ; j < rooms[i].users.length ; j++) {
                    if (rooms[i].users[j] === inviteUser) {
                        socket.emit('fail_to_client', inviteUser + ' is already in ' + curRoom + "!");
                        return;
                    }
                }
                for (let j = 0 ; j < rooms[i].banList.length ; j++) {
                    if (rooms[i].banList[j] === inviteUser) {
                        socket.emit('fail_to_client', inviteUser + ' is banned from ' + curRoom + "!");
                        return;
                    }
                }
                roomType = rooms[i].type;
                
                if (roomType === 'Private') {
                    pw = rooms[i].pw;
                }
            }
        }

        socket.to(curRoom).broadcast.emit('message_to_client', 'ADMIN', socket.user + ' has invited ' + inviteUser + "!");
        socket.emit('message_to_client', 'ADMIN', socket.user + ' has invited ' + inviteUser + "!");
        console.log(inviteID + " : " + socket.user + " : " + curRoom + " : " + roomType);
        socket.to(inviteID).emit('invite_to_client', socket.user, curRoom, roomType, pw);
    });
})