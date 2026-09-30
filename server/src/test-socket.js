import { io } from "socket.io-client";

const token = process.argv[2];
const socket = io("http://localhost:5000", { auth: { token } });

socket.on("connect", () => console.log("Connected:", socket.id));
socket.on("connect_error", (err) => console.log("Error:", err.message));

socket.on("connect", () => {
  socket.emit("join-document", process.argv[3], (res) => console.log("join:", res));
});