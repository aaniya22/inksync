import { io } from "socket.io-client"; 
const socket = io("http://localhost:5000", { auth: { token: process.argv[2] } }); 
socket.on("connect", () => console.log("Connected:", socket.id)); 
socket.on("connect_error", (err) => console.log("Error:", err.message)); 
socket.on("connect", () => socket.emit("join-document", process.argv[3], (res) => console.log("join:", res))); 
socket.on("connect", () => setTimeout(() => socket.emit("doc-change", { docId: process.argv[3], content: "hello from socket" }, (res) => console.log("change:", res)), 1000)); 
