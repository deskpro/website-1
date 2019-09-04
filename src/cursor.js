import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import crel from 'crel';

export const getCursorPlugin = () => {
  return new Plugin({
    state: {
      init() {
        return [];
      },
      apply(tr, state) {
        const meta = tr.getMeta(this);
        if (meta && meta.userCursors) {
          return meta.userCursors;
        }
        return state;
      }
    },
    props: {
      decorations(state) {
        const s = this.getState(state);
        return DecorationSet.create(
          state.doc,
          s.map(user =>
            Decoration.widget(
              user.cursorPosition,
              crel(
                'span',
                {
                  class: 'users-cursor',
                  style: `border-left-color: ${user.cursorColor}`,
                  title: user.displayName
                }
              ),
              {
                key: `${user.identity}_${user.cursorPosition}`
              }
            )
          )
        );
      }
    }
  });
}
