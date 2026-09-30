import express from "express";
import Document from "../models/Document.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = express.Router();
router.use(auth); // every route below requires a valid JWT

const canAccess = (doc, uid) =>
  doc.owner.equals(uid) || doc.collaborators.some((c) => c.equals(uid));

// List my docs (owned or shared), without the heavy content field
router.get("/", async (req, res) => {
  const docs = await Document.find({
    $or: [{ owner: req.userId }, { collaborators: req.userId }],
  })
    .select("-content")
    .sort({ lastEditedAt: -1 });
  res.json(docs);
});

// Create
router.post("/", async (req, res) => {
  const doc = await Document.create({
    title: req.body.title,
    owner: req.userId,
    lastEditedBy: req.userId,
  });
  res.status(201).json(doc);
});

// Read one
router.get("/:id", async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Not found" });
  if (!canAccess(doc, req.userId))
    return res.status(403).json({ message: "Forbidden" });
  res.json(doc);
});

// Rename
router.patch("/:id", async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Not found" });
  if (!canAccess(doc, req.userId))
    return res.status(403).json({ message: "Forbidden" });
  doc.title = req.body.title;
  doc.lastEditedBy = req.userId;
  doc.lastEditedAt = new Date();
  await doc.save();
  res.json(doc);
});

// Delete (owner only)
router.delete("/:id", async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Not found" });
  if (!doc.owner.equals(req.userId)) {
    return res.status(403).json({ message: "Only the owner can delete" });
  }
  await doc.deleteOne();
  res.status(204).end();
});

// Add collaborator by email (owner only)
router.post("/:id/collaborators", async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Not found" });
  if (!doc.owner.equals(req.userId)) {
    return res.status(403).json({ message: "Only the owner can share" });
  }
  const user = await User.findOne({ email: req.body.email });
  if (!user)
    return res.status(404).json({ message: "No user with that email" });
  if (
    !doc.owner.equals(user._id) &&
    !doc.collaborators.some((c) => c.equals(user._id))
  ) {
    doc.collaborators.push(user._id);
    await doc.save();
  }
  res.json(doc);
});

export default router;
