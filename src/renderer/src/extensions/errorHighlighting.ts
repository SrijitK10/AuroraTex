import { Extension, RangeSet } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, gutter, GutterMarker } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';

interface ErrorMarker {
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

// State effect to update error markers
export const setErrorMarkers = StateEffect.define<ErrorMarker[]>();

// Gutter marker classes
class ErrorGutterMarker extends GutterMarker {
  constructor(public severity: 'error' | 'warning' | 'info', public message: string) {
    super();
  }

  eq(other: ErrorGutterMarker) {
    return this.severity === other.severity && this.message === other.message;
  }

  toDOM() {
    const element = document.createElement('div');
    element.className = `error-marker error-marker-${this.severity}`;
    element.title = this.message;
    
    // Create the icon based on severity
    const icon = document.createElement('div');
    icon.className = 'error-marker-icon';
    
    if (this.severity === 'error') {
      icon.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
      `;
      icon.style.color = '#dc2626'; // red-600
    } else if (this.severity === 'warning') {
      icon.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
      `;
      icon.style.color = '#d97706'; // yellow-600
    } else {
      icon.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
        </svg>
      `;
      icon.style.color = '#2563eb'; // blue-600
    }
    
    element.appendChild(icon);
    return element;
  }
}

// State field to manage error markers
const errorMarkersField = StateField.define<RangeSet<GutterMarker>>({
  create() {
    return RangeSet.empty;
  },
  update(markers, tr) {
    markers = markers.map(tr.changes);
    
    for (let effect of tr.effects) {
      if (effect.is(setErrorMarkers)) {
        const newMarkers: Array<{ from: number; to: number; value: GutterMarker }> = [];
        
        for (const error of effect.value) {
          const line = Math.max(0, error.line - 1); // Convert to 0-based line numbers
          const pos = tr.state.doc.line(line + 1).from; // Get position of the line
          
          newMarkers.push({
            from: pos,
            to: pos,
            value: new ErrorGutterMarker(error.severity, error.message)
          });
        }
        
        markers = RangeSet.of(newMarkers.sort((a, b) => a.from - b.from));
      }
    }
    
    return markers;
  }
});

// Line decoration for highlighting error lines
const errorLineDecoration = Decoration.line({
  attributes: { class: 'error-line' }
});

const warningLineDecoration = Decoration.line({
  attributes: { class: 'warning-line' }
});

const infoLineDecoration = Decoration.line({
  attributes: { class: 'info-line' }
});

// State field for line decorations
const errorLineDecorations = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    
    for (let effect of tr.effects) {
      if (effect.is(setErrorMarkers)) {
        const newDecorations: Array<{ from: number; to: number; value: Decoration }> = [];
        
        for (const error of effect.value) {
          const line = Math.max(0, error.line - 1);
          try {
            const lineInfo = tr.state.doc.line(line + 1);
            const decoration = error.severity === 'error' 
              ? errorLineDecoration
              : error.severity === 'warning'
              ? warningLineDecoration
              : infoLineDecoration;
            
            newDecorations.push({
              from: lineInfo.from,
              to: lineInfo.from,
              value: decoration
            });
          } catch (e) {
            // Line doesn't exist, skip
            console.warn(`Error marker for line ${error.line} could not be placed: line doesn't exist`);
          }
        }
        
        decorations = Decoration.set(newDecorations.sort((a, b) => a.from - b.from));
      }
    }
    
    return decorations;
  },
  provide: f => EditorView.decorations.from(f)
});

// CSS styles for error markers (to be added to your global styles)
export const errorMarkerStyles = `
.error-line {
  background-color: rgba(239, 68, 68, 0.1);
}

.warning-line {
  background-color: rgba(245, 158, 11, 0.1);
}

.info-line {
  background-color: rgba(59, 130, 246, 0.1);
}

.error-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.error-marker-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
}

.error-marker:hover {
  transform: scale(1.1);
}
`;

// The main extension
export function errorHighlighting(): Extension {
  return [
    errorMarkersField,
    errorLineDecorations,
    gutter({
      class: 'cm-error-gutter',
      markers: v => v.state.field(errorMarkersField),
      initialSpacer: () => new ErrorGutterMarker('info', ''),
    })
  ];
}

// Helper function to update error markers in an editor view
export function updateErrorMarkers(view: EditorView, errors: ErrorMarker[]) {
  view.dispatch({
    effects: setErrorMarkers.of(errors)
  });
}
