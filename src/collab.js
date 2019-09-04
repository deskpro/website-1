
import * as jwt  from "jsonwebtoken";
import {CollabEditor}  from "./editor";

const {schema} = require("./schema")
const $node = (type, attrs, content, marks) => schema.node(type, attrs, content, marks)
const $text = (str, marks) => schema.text(str, marks)
const em = schema.marks.em.create();

//const WEBSOCKET_URL = "ws://localhost:3001";
const WEBSOCKET_URL = "wss://7hsxmtd8ac.execute-api.eu-west-1.amazonaws.com/dev";
const DOC_PREFIX = "test_1222";

const JWT_TOKEN_SECRET = "AC1C44C8-3AE9-4181-97AB-1A68D1E6601B";
const DOC_1 = "Example";
const DOC_2 = "Nonsense";
const USER = "User_" + Math.floor(Math.random()*1000);

const PAYLOAD_1 = {
  sub: USER,
  iss: "some-deskpro-client-id",
  name: USER,
  aud: DOC_PREFIX + DOC_1
};
const PAYLOAD_2 = {
  sub: USER,
  iss: "some-deskpro-client-id",
  name: USER,
  aud: DOC_PREFIX + DOC_2
};
const TOKEN_1 = jwt.sign(
  PAYLOAD_1,
  JWT_TOKEN_SECRET,
  { expiresIn: 30000 }
);
const TOKEN_2 = jwt.sign(
  PAYLOAD_2,
  JWT_TOKEN_SECRET,
  { expiresIn: 30000 }
);

const SCHEMA_1 = $node("doc", null, [
  $node("heading", {level: 2}, [$text("Example Document 1")]),
  $node("paragraph", null, [
    $text("There is nothing here yet. "),
    $text("Add something!", [em])
  ])
]);

const SCHEMA_2 = $node("doc", null, [
  $node("heading", {level: 2}, [$text("Example Document 2")]),
  $node("paragraph", null, [
    $text("There is nothing here yet. "),
    $text("Add something!", [em])
  ])
]);

// We can choose TOKEN_1 or TOKEN_2 for connection because `iss` and `sub` are the same
const websocket = new WebSocket(WEBSOCKET_URL + `?authToken=${TOKEN_1}`);

function createFirstEditor() {
  new CollabEditor(
    websocket,
    PAYLOAD_1.aud,
    "1",
    TOKEN_1,
    PAYLOAD_1.sub,
    PAYLOAD_1.name,
    SCHEMA_1)
}


function createSecondEditor() {
  new CollabEditor(
    websocket,
    PAYLOAD_2.aud,
    "2",
    TOKEN_2,
    PAYLOAD_2.sub,
    PAYLOAD_2.name,
    SCHEMA_2)
}

createFirstEditor();
createSecondEditor();