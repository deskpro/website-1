import {exampleSetup} from "prosemirror-example-setup"
import {Step} from "prosemirror-transform"
import {EditorState} from "prosemirror-state"
import {EditorView} from "prosemirror-view"
import {history} from "prosemirror-history"
import {collab, receiveTransaction, sendableSteps} from "prosemirror-collab"
import crel from "crel"

const {schema} = require("./schema")



const $node = (type, attrs, content, marks) => schema.node(type, attrs, content, marks)
const $text = (str, marks) => schema.text(str, marks)

const em = schema.marks.em.create();

import {getCursorPlugin}  from './cursor';

import * as jwt  from "jsonwebtoken";

//const WEBSOCKET_URL = "ws://localhost:3001";
const WEBSOCKET_URL = "wss://7hsxmtd8ac.execute-api.eu-west-1.amazonaws.com/dev";
const DOC_PREFIX = "test_1";

const JWT_TOKEN_SECRET = "AC1C44C8-3AE9-4181-97AB-1A68D1E6601B";
const DOC_1 = "Example";
const DOC_2 = "Nonsense";

const PAYLOAD_1 = {
  sub: "Identity_" + Math.floor(Math.random()*1000),
  iss: "some-deskpro-client-id",
  name: "User_" + Math.floor(Math.random()*1000),
  aud: DOC_PREFIX + DOC_1
};
const PAYLOAD_2 = {
  sub: "Identity_" + Math.floor(Math.random()*1000),
  iss: "some-deskpro-client-id",
  name: "User_" + Math.floor(Math.random()*1000),
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



class State {
  constructor(edit, comm) {
    this.edit = edit
    this.comm = comm
  }
}

class EditorConnection {
  constructor(docName, divPrefix, jwt, identity, displayName, schema) {
    this.state = new State(null, "start")
    this.view = null
    this.dispatch = this.dispatch.bind(this)

    // DESKPRO EDIT
    this.schema = schema;
    this.jwt = jwt;
    this.divPrefix = divPrefix;
    this.socket = new WebSocket(WEBSOCKET_URL + `?authToken=${jwt}`);
    this.docName = docName;
    this.users = [];
    this.identity = identity;
    this.displayName = displayName;
    this.cursorPosition = 1;
    this.cursorPlugin = getCursorPlugin();
    this.start()
  }

  // All state changes go through this
  dispatch(action) {
    if (action.type == "loaded") {
      let editState = EditorState.create({
        doc: action.doc,
        plugins: exampleSetup({schema, history: false}).concat([
          history({preserveItems: true}),
          collab({version: action.version}),
          this.cursorPlugin
        ]),
      })
      this.state = new State(editState, "poll")
    }

    // Sync the editor with this.state.edit
    if (this.state.edit) {
      if (this.view)
        this.view.updateState(this.state.edit)
      else
        this.setView(new EditorView(document.querySelector("#editor_"+this.divPrefix), {
          state: this.state.edit,
          // DESKPRO EDIT
          dispatchTransaction: transaction => {
            console.log("dispatchTransaction", transaction);
            let newState = this.view.state.apply(transaction)
            this.view.updateState(newState)
            let sendable = sendableSteps(newState)
            if (sendable) {
              console.log("There is some sendable", sendable);
              let json = JSON.stringify({
                action: "setEditorState",
                eventType: "edit",
                version: sendable.version + 1,
                steps: sendable.steps ? sendable.steps.map(s => s.toJSON()) : [],
                clientID: sendable.clientID,
                documentUrn: this.docName,
                // for now send cursor position as standalone call
                // cursorPosition: newState.selection.$head.pos
              });

              this.socket.send(json);
            }

            if (this.cursorPosition !== newState.selection.$head.pos) {
              this.cursorPosition = newState.selection.$head.pos;
              console.log("Broadcast cursor position", this.cursorPosition);
              let json = JSON.stringify({
                action: "setEditorState",
                eventType: "cursor",
                documentUrn: this.docName,
                cursorPosition: this.cursorPosition
              });

              this.socket.send(json);
            }
          }
        }))
    } else this.setView(null)
  }

  // Load the document from the server and start up
  start() {

    let self = this;

    this.users = [];
    this.cursorPosition = 1;

    document.getElementById('yourname_'+this.divPrefix).innerHTML = this.displayName;

    // DESKPRO EDIT
    setTimeout(()=>{
      console.log("join websocket", this.docName);

      this.socket.send(JSON.stringify({
        action: "joinCollab",
        documentUrn: this.docName,
        cursorPosition: this.cursorPosition,
        authToken: self.jwt
      }));
    }, 2000);

    this.socket.addEventListener('message', function (event) {
      const data = JSON.parse(event.data);
      console.log('Got websocket message', data);

      switch (data.action) {
        case "edit":
          console.log("Processing edit event");
          const steps = data.event.steps.map(j => Step.fromJSON(schema, j));
          const clientIds = new Array(steps.length).fill(data.event.clientID);
          self.view.dispatch(
            receiveTransaction(self.view.state, steps, clientIds)
          );
          break;
        case "connectedUsers":
          self.users = data.users
            .filter(u => u.identity !== self.identity)
            .map((u, index) => {
              u.cursorColor = self.selectColor(index+1)
              return u;
            });
          const cuTr = self.view.state.tr;
          cuTr.setMeta(self.cursorPlugin, {
            type: 'receive',
            userCursors: self.users
          });
          self.view.dispatch(cuTr);
          self.showUsers();
          break;
        default:
          console.log("Unknown action");
      }
    });
    this.socket.addEventListener('error', function (event) {
      console.log('Webscoket Error', event);
    });

    this.dispatch({
      type: "loaded",
      doc: this.schema,
      version: 1,
      users: [],
    });
  }

  selectColor(colorNum, colors = 20) {
    if (colors < 1) colors = 1; // defaults to one color - avoid divide by zero
    if (colorNum % 2 == 0) {
      colorNum = colors - colorNum;
    }
    return 'hsl(' + ((colorNum * (360 / colors)) % 360) + ',100%,50%)';
  }

  showUsers() {
    let ul = crel("ul");
    this.users.forEach(user => {
      ul.appendChild(crel("li", {style: `color: ${user.cursorColor}`}, user.displayName));
    })

    document.getElementById('users_list_'+this.divPrefix).innerHTML = "";
    crel( document.getElementById('users_list_'+this.divPrefix), ul);
  }

  close() {
    // DESKPRO EDIT
    this.socket.close();
    this.setView(null)
  }

  setView(view) {
    if (this.view) this.view.destroy()
    this.view = window.view = view
  }
}

function createFirstEditor() {
  new EditorConnection(
    DOC_PREFIX + DOC_1,
    "1",
    TOKEN_1,
    PAYLOAD_1.sub,
    PAYLOAD_1.name,
    SCHEMA_1)
}


function createSecondEditor() {
  new EditorConnection(
    DOC_PREFIX + DOC_2,
    "2",
    TOKEN_2,
    PAYLOAD_2.sub,
    PAYLOAD_2.name,
    SCHEMA_2)
}

createFirstEditor();
createSecondEditor();

