import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import jwt from "jsonwebtoken";
import Document from "./models/Document.js";
import User from "./models/User.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.js";
import documentRoutes from "./routes/documents.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL },
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Not authenticated"));
  try {
    socket.userId = jwt.verify(token, process.env.JWT_SECRET).id;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
});

const pendingSaves = new Map();
const SAVE_DELAY_MS = 500;

const flushSave = async (docId) => {
  const pending = pendingSaves.get(docId);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingSaves.delete(docId);
  try {
    await Document.findByIdAndUpdate(docId, {
      content: pending.content,
      lastEditedBy: pending.userId,
      lastEditedAt: new Date(),
    });
  } catch (err) {
    console.error("Save failed for", docId, err.message);
  }
};

const scheduleSave = (docId, content, userId) => {
  const existing = pendingSaves.get(docId);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => flushSave(docId), SAVE_DELAY_MS);
  pendingSaves.set(docId, { timer, content, userId });
};

const broadcastPresence = async (docId) => {
  const sockets = await io.in(`doc:${docId}`).fetchSockets();
  const ids = [...new Set(sockets.map((s) => s.userId))];
  const users = await User.find({ _id: { $in: ids } }).select("name");
  io.to(`doc:${docId}`).emit(
    "presence",
    users.map((u) => ({ id: u._id, name: u.name })),
  );
};

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id, "user:", socket.userId);

  socket.on("join-document", async (docId, cb) => {
    await flushSave(docId);
    let doc;
    try {
      doc = await Document.findOne({
        _id: docId,
        $or: [{ owner: socket.userId }, { collaborators: socket.userId }],
      }).select("content");
      if (!doc) return cb?.({ ok: false, error: "No access" });
    } catch {
      return cb?.({ ok: false, error: "Invalid document id" });
    }
    socket.join(`doc:${docId}`);
    cb?.({ ok: true, content: doc.content ?? "" });
    socket.to(`doc:${docId}`).emit("user-joined", { userId: socket.userId });
    broadcastPresence(docId);
    console.log(`${socket.userId} joined doc:${docId}`);
  });

  socket.on("doc-change", async ({ docId, content }, cb) => {
    if (!socket.rooms.has(`doc:${docId}`)) {
      return cb?.({ ok: false, error: "Join the document first" });
    }
    socket
      .to(`doc:${docId}`)
      .emit("doc-update", { content, userId: socket.userId });
    scheduleSave(docId, content, socket.userId);
    cb?.({ ok: true });
  });

  socket.on("disconnecting", () => {
    const docIds = [...socket.rooms]
      .filter((r) => r.startsWith("doc:"))
      .map((r) => r.slice(4));
    docIds.forEach(flushSave);
    socket.once("disconnect", () => docIds.forEach(broadcastPresence));
  });

  socket.on("leave-document", (docId) => {
    flushSave(docId);
    socket.leave(`doc:${docId}`);
    socket.to(`doc:${docId}`).emit("user-left", { userId: socket.userId });
    broadcastPresence(docId);
    console.log(`${socket.userId} left doc:${docId}`);
  });
});

const start = async () => {
  await connectDB();
  server.listen(process.env.PORT, () =>
    console.log(`Server running on port ${process.env.PORT}`),
  );
};

start();
