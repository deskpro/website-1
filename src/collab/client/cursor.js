import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import crel from 'crel';

const cursorsPlugin = new Plugin({
  state: {
    init() {
      return [];
    },
    apply(tr, state) {
      const meta = tr.getMeta(cursorsPlugin);
      if (meta && meta.userCursors) {
        return meta.userCursors;
      }
      return state;
    }
  },
  props: {
    decorations(state) {
      const s = cursorsPlugin.getState(state);
      return DecorationSet.create(
        state.doc,
        s.map(({ cursorPosition, displayName, cursorColor }) =>
          Decoration.widget(
            cursorPosition,
            crel(
              'span',
              {
                class: 'cursor blink_me',
                style: `border-left-color: ${cursorColor}`,
                title: displayName
              }
              //crel('span', { class: 'username' }, displayName)
            )
          )
        )
      );
    }
  }
});

export default cursorsPlugin;
