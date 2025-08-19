import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { Extension } from '@codemirror/state';

interface SnippetCompletion {
  label: string;
  apply: string;
  detail: string;
  type: string;
  boost?: number;
}

// Static LaTeX snippets for autocomplete
const staticLatexSnippets: SnippetCompletion[] = [
  // Figures - multiple triggers for \fig
  {
    label: '\\fig',
    detail: 'Insert figure environment',
    type: 'snippet',
    apply: `\\begin{figure}[h]
    \\centering
    \\includegraphics[width=0.8\\textwidth]{image.png}
    \\caption{Your caption here}
    \\label{fig:your-label}
\\end{figure}`,
    boost: 10
  },
  {
    label: '\\figure',
    detail: 'Insert figure environment',
    type: 'snippet',
    apply: `\\begin{figure}[h]
    \\centering
    \\includegraphics[width=0.8\\textwidth]{image.png}
    \\caption{Your caption here}
    \\label{fig:your-label}
\\end{figure}`,
    boost: 9
  },
  
  // Equations
  {
    label: '\\eq',
    detail: 'Insert equation environment',
    type: 'snippet',
    apply: `\\begin{equation}
    \\label{eq:your-label}
    
\\end{equation}`,
    boost: 10
  },
  {
    label: '\\equation',
    detail: 'Insert equation environment',
    type: 'snippet',
    apply: `\\begin{equation}
    \\label{eq:your-label}
    
\\end{equation}`,
    boost: 9
  },
  {
    label: '\\align',
    detail: 'Insert align environment',
    type: 'snippet',
    apply: `\\begin{align}
    \\label{eq:align-label}
    
\\end{align}`,
    boost: 8
  },

  // Tables
  {
    label: '\\tab',
    detail: 'Insert table environment',
    type: 'snippet',
    apply: `\\begin{table}[h]
    \\centering
    \\begin{tabular}{|c|c|c|}
        \\hline
        Header 1 & Header 2 & Header 3 \\\\
        \\hline
        Row 1 & Data & Data \\\\
        Row 2 & Data & Data \\\\
        \\hline
    \\end{tabular}
    \\caption{Your table caption}
    \\label{tab:your-label}
\\end{table}`,
    boost: 10
  },
  {
    label: '\\table',
    detail: 'Insert table environment',
    type: 'snippet',
    apply: `\\begin{table}[h]
    \\centering
    \\begin{tabular}{|c|c|c|}
        \\hline
        Header 1 & Header 2 & Header 3 \\\\
        \\hline
        Row 1 & Data & Data \\\\
        Row 2 & Data & Data \\\\
        \\hline
    \\end{tabular}
    \\caption{Your table caption}
    \\label{tab:your-label}
\\end{table}`,
    boost: 9
  },

  // Lists
  {
    label: '\\itemize',
    detail: 'Insert itemize list',
    type: 'snippet',
    apply: `\\begin{itemize}
    \\item First item
    \\item Second item
    \\item Third item
\\end{itemize}`,
    boost: 8
  },
  {
    label: '\\enumerate',
    detail: 'Insert enumerate list',
    type: 'snippet',
    apply: `\\begin{enumerate}
    \\item First item
    \\item Second item
    \\item Third item
\\end{enumerate}`,
    boost: 8
  },

  // Sections
  {
    label: '\\sec',
    detail: 'Insert section',
    type: 'snippet',
    apply: '\\section{Section Title}',
    boost: 9
  },
  {
    label: '\\subsec',
    detail: 'Insert subsection',
    type: 'snippet',
    apply: '\\subsection{Subsection Title}',
    boost: 8
  },
  {
    label: '\\subsubsec',
    detail: 'Insert subsubsection',
    type: 'snippet',
    apply: '\\subsubsection{Subsubsection Title}',
    boost: 7
  },

  // Math environments
  {
    label: '\\matrix',
    detail: 'Insert matrix',
    type: 'snippet',
    apply: `\\begin{pmatrix}
    a & b \\\\
    c & d
\\end{pmatrix}`,
    boost: 7
  },
  {
    label: '\\cases',
    detail: 'Insert cases environment',
    type: 'snippet',
    apply: `\\begin{cases}
    case1 & \\text{if condition1} \\\\
    case2 & \\text{if condition2}
\\end{cases}`,
    boost: 7
  },

  // References
  {
    label: '\\ref',
    detail: 'Insert reference',
    type: 'snippet',
    apply: '\\ref{label}',
    boost: 6
  },
  {
    label: '\\cite',
    detail: 'Insert citation',
    type: 'snippet',
    apply: '\\cite{citation-key}',
    boost: 6
  },
  {
    label: '\\label',
    detail: 'Insert label',
    type: 'snippet',
    apply: '\\label{label-name}',
    boost: 6
  },

  // Text formatting
  {
    label: '\\textbf',
    detail: 'Bold text',
    type: 'snippet',
    apply: '\\textbf{bold text}',
    boost: 5
  },
  {
    label: '\\textit',
    detail: 'Italic text',
    type: 'snippet',
    apply: '\\textit{italic text}',
    boost: 5
  },
  {
    label: '\\emph',
    detail: 'Emphasized text',
    type: 'snippet',
    apply: '\\emph{emphasized text}',
    boost: 5
  },

  // Math symbols
  {
    label: '\\frac',
    detail: 'Insert fraction',
    type: 'snippet',
    apply: '\\frac{numerator}{denominator}',
    boost: 6
  },
  {
    label: '\\sqrt',
    detail: 'Insert square root',
    type: 'snippet',
    apply: '\\sqrt{expression}',
    boost: 6
  },
  {
    label: '\\sum',
    detail: 'Insert sum',
    type: 'snippet',
    apply: '\\sum_{i=1}^{n}',
    boost: 6
  },
  {
    label: '\\int',
    detail: 'Insert integral',
    type: 'snippet',
    apply: '\\int_{a}^{b}',
    boost: 6
  },

  // Environments
  {
    label: '\\abstract',
    detail: 'Insert abstract environment',
    type: 'snippet',
    apply: `\\begin{abstract}
    Your abstract here
\\end{abstract}`,
    boost: 7
  },
  {
    label: '\\quote',
    detail: 'Insert quote environment',
    type: 'snippet',
    apply: `\\begin{quote}
    Your quote here
\\end{quote}`,
    boost: 6
  },
  {
    label: '\\verbatim',
    detail: 'Insert verbatim environment',
    type: 'snippet',
    apply: `\\begin{verbatim}
    Your code here
\\end{verbatim}`,
    boost: 6
  }
];

// Global variable to store dynamic snippets
let dynamicSnippets: SnippetCompletion[] = [];

// Function to update dynamic snippets from the snippet service
export function updateDynamicSnippets(snippets: any[]) {
  try {
    dynamicSnippets = snippets.map(snippet => ({
      label: snippet.trigger.startsWith('\\') ? snippet.trigger : `\\${snippet.trigger}`,
      apply: snippet.content,
      detail: snippet.description,
      type: 'snippet',
      boost: 5
    }));
  } catch (error) {
    console.error('Error updating dynamic snippets:', error);
    dynamicSnippets = [];
  }
}

// Function to get all available snippets
function getAllSnippets(): SnippetCompletion[] {
  try {
    return [...staticLatexSnippets, ...dynamicSnippets];
  } catch (error) {
    console.error('Error getting snippets:', error);
    return staticLatexSnippets;
  }
}

// Function to get completions
function getLatexCompletions(context: CompletionContext): CompletionResult | null {
  try {
    const word = context.matchBefore(/\\[a-zA-Z]*/);
    
    if (!word) {
      return null;
    }

    const from = word.from;
    const to = word.to;
    const typed = word.text;

    // Filter snippets based on what the user has typed
    const allSnippets = getAllSnippets();
    const options = allSnippets
      .filter((snippet: SnippetCompletion) => snippet.label.toLowerCase().startsWith(typed.toLowerCase()))
      .map((snippet: SnippetCompletion) => ({
        label: snippet.label,
        apply: snippet.apply, // Use the full snippet content directly
        detail: snippet.detail,
        type: snippet.type,
        boost: snippet.boost
      }));

    if (options.length === 0) {
      return null;
    }

    return {
      from,
      to,
      options
    };
  } catch (error) {
    console.error('Error in getLatexCompletions:', error);
    return null;
  }
}

// Create the autocomplete extension
export function latexAutocompletion(): Extension {
  try {
    return autocompletion({
      override: [getLatexCompletions],
      activateOnTyping: true,
      maxRenderedOptions: 10,
      defaultKeymap: true
    });
  } catch (error) {
    console.error('Failed to create LaTeX autocompletion extension:', error);
    // Return a no-op extension if creation fails
    return [];
  }
}

// Export the snippets for use in the snippets palette
export { staticLatexSnippets as latexSnippets };
