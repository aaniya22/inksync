import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, default: "Untitled", trim: true, maxlength: 120 },
    content: { type: String, default: "" },
    ydoc: { type: Buffer },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lastEditedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

documentSchema.index({ collaborators: 1 });

export default mongoose.model("Document", documentSchema);
