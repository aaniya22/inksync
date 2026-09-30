import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function App() {
  const [token, setToken] = useState("");
  const [docId, setDocId] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("disconnected");
  const socketRef = useRef(null);

  const connect = () => {
    socketRef.current?.disconnect();
    const socket = io("http://localhost:5000", { auth: { token } });
    socketRef.current = socket;
    socket.on("connect_error", (e) => setStatus(`error: ${e.message}`));
    socket.on("connect", () => {
      socket.emit("join-document", docId, (res) => {
        setStatus(res.ok ? "joined" : `error: ${res.error}`);
        if (res.ok) setContent(res.content);
      });
    });
    socket.on("doc-update", (d) => setContent(d.content));
  };

  useEffect(() => () => socketRef.current?.disconnect(), []);

  const onChange = (e) => {
    setContent(e.target.value);
    socketRef.current?.emit("doc-change", { docId, content: e.target.value });
  };

  return (
    <div style={{ maxWidth: 700, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h2>InkSync</h2>
      <input placeholder="token" value={token} onChange={(e) => setToken(e.target.value)} style={{ width: "100%" }} />
      <input placeholder="document id" value={docId} onChange={(e) => setDocId(e.target.value)} style={{ width: "100%", marginTop: 8 }} />
      <button onClick={connect} style={{ marginTop: 8 }}>Connect and join</button>
      <p>Status: {status}</p>
      <textarea value={content} onChange={onChange} rows={15} style={{ width: "100%" }} />
    </div>
  );
}