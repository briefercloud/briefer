import { EditorView } from '@codemirror/view'
import { Extension } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

function materialLightTheme(disabled: boolean) {
  return EditorView.theme(
    {
      '&': {
        color: '#000000',
        backgroundColor: disabled ? '#f3f3f3' : '#ffffff',
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
        backgroundColor: disabled ? '#f3f3f3' : '#ffffff',
        color: '#237893',
        border: 'none',
        paddingLeft: '8px',
      },
      '.cm-activeLineGutter': {
        color: '#0b216f',
        backgroundColor: disabled ? '#f3f3f3' : '#ffffff',
      },
    },

    { dark: false }
  )
}

const materialLightHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: '#008000' },
  { tag: t.keyword, color: '#0000ff' },
  { tag: t.number, color: '#098658' },
  { tag: t.string, color: '#a31515' },
  { tag: t.bracket, color: '#0000ff' },
])

export function materialLight(disabled: boolean): Extension {
  return [
    materialLightTheme(disabled),
    syntaxHighlighting(materialLightHighlightStyle),
  ]
}
