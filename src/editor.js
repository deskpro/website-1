import {exampleSetup} from "prosemirror-example-setup"
import {Step} from "prosemirror-transform"
import {EditorState} from "prosemirror-state"
import {EditorView} from "prosemirror-view"
import {history} from "prosemirror-history"
import {collab, receiveTransaction, sendableSteps} from "prosemirror-collab"
import crel from "crel"

import {getCursorPlugin}  from './cursor';

const {schema} = require("./schema")

export class CollabEditor {
  constructor(websocket, documentUrn, divPrefix, jwt, identity, displayName, schema) {
    this.view = null
    this.editorState = null;
    this.schema = schema;
    this.jwt = jwt;
    this.divPrefix = divPrefix;
    this.socket = websocket;
    this.documentUrn = documentUrn;
    this.users = [];
    this.identity = identity;
    this.displayName = displayName;
    this.cursorPosition = 1;
    this.cursorPlugin = getCursorPlugin();
    this.start()
  }

  start() {

    let self = this;

    this.users = [];
    this.cursorPosition = 1;

    document.getElementById('yourname_'+this.divPrefix).innerHTML = this.displayName;

    setTimeout(()=>{
      console.log("join websocket", this.documentUrn);

      this.socket.send(JSON.stringify({
        action: "joinCollab",
        documentUrn: this.documentUrn,
        cursorPosition: this.cursorPosition,
        authToken: self.jwt
      }));
    }, 2000);

    this.socket.addEventListener('message', function (event) {
      const data = JSON.parse(event.data);
      console.log('Got websocket message', data);

      switch (data.action) {
        case "edit":

          // We use one connection for multiple documents
          if (data.documentUrn !== self.documentUrn) {
            return;
          }

          console.log("Processing edit event");
          const steps = data.event.steps.map(j => Step.fromJSON(schema, j));
          const clientIds = new Array(steps.length).fill(data.event.clientID);
          self.view.dispatch(
            receiveTransaction(self.view.state, steps, clientIds)
          );
          break;
        case "connectedUsers":

          // We use one connection for multiple documents
          if (data.documentUrn !== self.documentUrn) {
            return;
          }

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

    // INIT EDITOR
    this.editorState = EditorState.create({
      doc: this.schema,
      plugins: exampleSetup({schema, history: false}).concat([
        history({preserveItems: true}),
        collab({version: 1}),
        this.cursorPlugin
      ]),
    });
    this.setView(new EditorView(document.querySelector("#editor_"+this.divPrefix), {
      state: this.editorState,
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
            documentUrn: this.documentUrn,
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
            documentUrn: this.documentUrn,
            cursorPosition: this.cursorPosition
          });

          this.socket.send(json);
        }
      }
    }))
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
    this.socket.close();
    this.setView(null)
  }

  setView(view) {
    if (this.view) this.view.destroy()
    this.view = window.view = view
  }
}