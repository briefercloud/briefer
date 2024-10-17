import { EditorView } from '@codemirror/view'
import { Extension } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

const materialLightTheme = EditorView.theme(
  {
    '&': {
      color: '#000000',
      backgroundColor: '#ffffff',
      fontSize: '12px',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-content': {
      caretColor: '#000000',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#000000',
    },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      { backgroundColor: 'rgb(230, 235, 240)' },
    '.cm-selectionMatch': { backgroundColor: 'rgb(233, 242, 254)' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-gutters': {
      backgroundColor: '#ffffff',
      color: '#237893',
      border: 'none',
      paddingLeft: '8px',
    },
    '.cm-activeLineGutter': {
      color: '#0b216f',
      backgroundColor: '#ffffff',
    },
  },

  { dark: false }
)

const materialLightHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: '#008000' },
  { tag: t.keyword, color: '#0000ff' },
  { tag: t.number, color: '#098658' },
  { tag: t.string, color: '#a31515' },
  { tag: t.bracket, color: '#0000ff' },
])

export const materialLight: Extension = [
  materialLightTheme,
  syntaxHighlighting(materialLightHighlightStyle),
]
