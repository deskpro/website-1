# Prosemirror.net

This is a document collab client test

## Installation

Install [Node.js](http://nodejs.org).

Install the module's dependencies:

```bash
npm install
```

Adjust these constants `src/collab.js`:
```
const WEBSOCKET_URL = "ws://localhost:3001";
const DOC_PREFIX = "pref_1_";
```

Good to change DOC_PREFIX every time when starting a new testing, so events are not intercepted (old events stay in document_events table until ttl expres). This table has key (documentUrn, version)

Run:

```
npm run start
```

## Manual test

1) In two browsers enable debug console

2) Open collaborative editing example page
http://0.0.0.0:7000/

3) In console `join websocket`  should appear

Note, that for now all browsers should first connect to websocket (start from the same document point) and only then you should start editing.

4) Try to edit document - in another browser we should see reflected changes
