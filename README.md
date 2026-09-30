# InkSync

Real-time collaborative text editor. Users sign up, create documents, share them by email, and edit together live with presence showing who is online.

## Stack

- Client: React (Vite), socket.io-client
- Server: Node.js, Express, Socket.IO, MongoDB (Mongoose), JWT auth

## Setup

Requires Node.js and a running MongoDB instance.

1. Install dependencies: `cd server && npm install`, then `cd ../client && npm install`
2. Copy `server/.env.example` to `server/.env`, then set `MONGO_URI` and a long random `JWT_SECRET`
3. Start the server (port 5000): `cd server && npm run dev`
4. Start the client (port 5173): `cd client && npm run dev`
5. Open http://localhost:5173, sign up, and create a document

To test collaboration, sign up a second user in an incognito window, share the document from the first account by email, and open it in both.

## Features

- Email/password auth with JWT
- Document list, create, and share by email (owner only)
- Live sync over WebSockets with debounced saves to MongoDB
- Conflict-free concurrent editing with Yjs (CRDT)
- Presence: see who is currently in a document

## Known limitations

- Plain-text only, no rich formatting yet

## Environment variables

See `server/.env.example`.
