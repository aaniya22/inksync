import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as Y from "yjs";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [docs, setDocs] = useState([]);
  const [docId, setDocId] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [mode, setMode] = useState("login");
  const [newTitle, setNewTitle] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [people, setPeople] = useState([]);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("disconnected");
  const socketRef = useRef(null);
  const ydocRef = useRef(null);

  const connect = (id) => {
    setDocId(id);
    socketRef.current?.disconnect();
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("content");
    ydocRef.current = ydoc;
    ytext.observe(() => setContent(ytext.toString()));
    ydoc.on("update", (update, origin) => {
      if (origin !== "remote") {
        socketRef.current?.emit("doc-change", { docId: id, update });
      }
    });
    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;
    socket.on("connect_error", (e) => setStatus(`error: ${e.message}`));
    socket.on("connect", () => {
      socket.emit("join-document", id, (res) => {
        setStatus(res.ok ? "joined" : `error: ${res.error}`);
        if (res.ok) Y.applyUpdate(ydoc, new Uint8Array(res.state), "remote");
      });
    });
    socket.on("doc-update", (d) =>
      Y.applyUpdate(ydoc, new Uint8Array(d.update), "remote"),
    );
    socket.on("presence", setPeople);
  };

  useEffect(() => () => socketRef.current?.disconnect(), []);

  const api = async (path, options = {}) => {
    const res = await fetch(`${API_URL}/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  };

  const logout = () => {
    socketRef.current?.disconnect();
    localStorage.removeItem("token");
    setToken("");
    setDocs([]);
    setDocId("");
    setContent("");
    setPeople([]);
    setStatus("disconnected");
  };

  const loadDocs = async () => {
    try {
      setDocs(await api("/documents"));
    } catch {
      logout();
    }
  };

  useEffect(() => {
    if (token) loadDocs();
  }, [token]);

  const submitAuth = async () => {
    try {
      const body =
        mode === "signup"
          ? form
          : { email: form.email, password: form.password };
      const data = await api(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      localStorage.setItem("token", data.token);
      setToken(data.token);
      setStatus("logged in");
    } catch (e) {
      setStatus(`error: ${e.message}`);
    }
  };

  const createDoc = async () => {
    const doc = await api("/documents", {
      method: "POST",
      body: JSON.stringify({ title: newTitle || "Untitled" }),
    });
    setNewTitle("");
    await loadDocs();
    connect(doc._id);
  };

  const shareDoc = async () => {
    try {
      await api(`/documents/${docId}/collaborators`, {
        method: "POST",
        body: JSON.stringify({ email: shareEmail }),
      });
      setShareEmail("");
      setStatus(`shared with ${shareEmail}`);
    } catch (e) {
      setStatus(`error: ${e.message}`);
    }
  };

  const renameDoc = async (d) => {
    const title = window.prompt("New title", d.title);
    if (!title || title === d.title) return;
    try {
      await api(`/documents/${d._id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      await loadDocs();
    } catch (e) {
      setStatus(`error: ${e.message}`);
    }
  };

  const deleteDoc = async (d) => {
    if (!window.confirm(`Delete "${d.title}"?`)) return;
    try {
      await api(`/documents/${d._id}`, { method: "DELETE" });
      if (d._id === docId) {
        socketRef.current?.disconnect();
        ydocRef.current = null;
        setDocId("");
        setContent("");
        setPeople([]);
        setStatus("deleted");
      }
      await loadDocs();
    } catch (e) {
      setStatus(`error: ${e.message}`);
    }
  };

  const onChange = (e) => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;
    const ytext = ydoc.getText("content");
    const oldText = ytext.toString();
    const newText = e.target.value;
    let start = 0;
    while (
      start < oldText.length &&
      start < newText.length &&
      oldText[start] === newText[start]
    )
      start++;
    let oldEnd = oldText.length;
    let newEnd = newText.length;
    while (
      oldEnd > start &&
      newEnd > start &&
      oldText[oldEnd - 1] === newText[newEnd - 1]
    ) {
      oldEnd--;
      newEnd--;
    }
    ydoc.transact(() => {
      if (oldEnd > start) ytext.delete(start, oldEnd - start);
      if (newEnd > start) ytext.insert(start, newText.slice(start, newEnd));
    });
  };

  return (
    <div
      style={{ maxWidth: 700, margin: "2rem auto", fontFamily: "sans-serif" }}
    >
      <h2>InkSync</h2>
      {!token ? (
        <div>
          {mode === "signup" && (
            <input
              placeholder="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ width: "100%", marginBottom: 8 }}
            />
          )}
          <input
            placeholder="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <input
            type="password"
            placeholder="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <button onClick={submitAuth}>
            {mode === "login" ? "Log in" : "Sign up"}
          </button>
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            style={{ marginLeft: 8 }}
          >
            {mode === "login" ? "Need an account?" : "Have an account?"}
          </button>
        </div>
      ) : (
        <div>
          <button onClick={logout}>Log out</button>
          <div style={{ marginTop: 8 }}>
            <input
              placeholder="new document title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <button onClick={createDoc} style={{ marginLeft: 8 }}>
              Create
            </button>
          </div>
          <ul>
            {docs.map((d) => (
              <li key={d._id}>
                <button
                  onClick={() => connect(d._id)}
                  style={{ fontWeight: d._id === docId ? "bold" : "normal" }}
                >
                  {d.title}
                </button>
                <button onClick={() => renameDoc(d)} style={{ marginLeft: 8 }}>
                  Rename
                </button>
                <button onClick={() => deleteDoc(d)} style={{ marginLeft: 8 }}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {token && docId && (
        <div style={{ marginTop: 8 }}>
          <input placeholder="share with email" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
          <button onClick={shareDoc} style={{ marginLeft: 8 }}>Share</button>
        </div>
      )}
      <p>Status: {status}</p>
      {people.length > 0 && (
        <p>Online: {people.map((p) => p.name).join(", ")}</p>
      )}
      <textarea
        value={content}
        onChange={onChange}
        rows={15}
        style={{ width: "100%" }}
      />
    </div>
  );
}
