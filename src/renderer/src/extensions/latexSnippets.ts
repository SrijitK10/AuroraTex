import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { Extension } from '@codemirror/state';

interface SnippetCompletion {
  label: string;
  apply: string;
  detail: string;
  type: string;
  boost?: number;
}

// Enhanced LaTeX snippets with full code insertion
const enhancedLatexSnippets: SnippetCompletion[] = [
  // Figure snippets
  {
    label: '\\fig',
    detail: 'Insert complete figure environment',
    type: 'snippet',
    apply: `\\begin{figure}[h]
    \\centering
    \\includegraphics[width=0.8\\textwidth]{image.png}
    \\caption{Your caption here}
    \\label{fig:your-label}
\\end{figure}`,
    boost: 15
  },
  {
    label: '\\figure',
    detail: 'Insert complete figure environment',
    type: 'snippet',
    apply: `\\begin{figure}[h]
    \\centering
    \\includegraphics[width=0.8\\textwidth]{image.png}
    \\caption{Your caption here}
    \\label{fig:your-label}
\\end{figure}`,
    boost: 14
  },
  
  // Equation snippets
  {
    label: '\\eq',
    detail: 'Insert equation environment',
    type: 'snippet',
    apply: `\\begin{equation}
    \\label{eq:your-label}
    
\\end{equation}`,
    boost: 15
  },
  {
    label: '\\equation',
    detail: 'Insert equation environment',
    type: 'snippet',
    apply: `\\begin{equation}
    \\label{eq:your-label}
    
\\end{equation}`,
    boost: 14
  },
  
  // Table snippets
  {
    label: '\\tab',
    detail: 'Insert complete table environment',
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
    boost: 15
  },
  {
    label: '\\table',
    detail: 'Insert complete table environment',
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
    boost: 14
  },

  // List snippets
  {
    label: '\\itemize',
    detail: 'Insert itemize list',
    type: 'snippet',
    apply: `\\begin{itemize}
    \\item First item
    \\item Second item
    \\item Third item
\\end{itemize}`,
    boost: 13
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
    boost: 13
  },

  // Section snippets
  {
    label: '\\sec',
    detail: 'Insert section',
    type: 'snippet',
    apply: '\\section{Section Title}',
    boost: 12
  },
  {
    label: '\\subsec',
    detail: 'Insert subsection',
    type: 'snippet',
    apply: '\\subsection{Subsection Title}',
    boost: 11
  },

  // Math snippets
  {
    label: '\\align',
    detail: 'Insert align environment',
    type: 'snippet',
    apply: `\\begin{align}
    \\label{eq:align-label}
    
\\end{align}`,
    boost: 13
  },
  {
    label: '\\matrix',
    detail: 'Insert matrix',
    type: 'snippet',
    apply: `\\begin{pmatrix}
    a & b \\\\
    c & d
\\end{pmatrix}`,
    boost: 10
  },
  {
    label: '\\cases',
    detail: 'Insert cases environment',
    type: 'snippet',
    apply: `\\begin{cases}
    case1 & \\text{if condition1} \\\\
    case2 & \\text{if condition2}
\\end{cases}`,
    boost: 10
  },

  // Environment snippets
  {
    label: '\\abstract',
    detail: 'Insert abstract environment',
    type: 'snippet',
    apply: `\\begin{abstract}
    Your abstract here
\\end{abstract}`,
    boost: 10
  },
  {
    label: '\\verbatim',
    detail: 'Insert verbatim environment',
    type: 'snippet',
    apply: `\\begin{verbatim}
    Your code here
\\end{verbatim}`,
    boost: 9
  },

  // Common quick inserts
  {
    label: '\\frac',
    detail: 'Insert fraction',
    type: 'snippet',
    apply: '\\frac{numerator}{denominator}',
    boost: 8
  },
  {
    label: '\\sqrt',
    detail: 'Insert square root',
    type: 'snippet',
    apply: '\\sqrt{expression}',
    boost: 8
  },
  {
    label: '\\textbf',
    detail: 'Bold text',
    type: 'snippet',
    apply: '\\textbf{bold text}',
    boost: 7
  },
  {
    label: '\\textit',
    detail: 'Italic text',
    type: 'snippet',
    apply: '\\textit{italic text}',
    boost: 7
  },
  {
    label: '\\emph',
    detail: 'Emphasized text',
    type: 'snippet',
    apply: '\\emph{emphasized text}',
    boost: 7
  }
];

// Function to get snippet completions
function getSnippetCompletions(context: CompletionContext): CompletionResult | null {
  try {
    const word = context.matchBefore(/\\[a-zA-Z]*/);
    
    if (!word) {
      return null;
    }

    const from = word.from;
    const to = word.to;
    const typed = word.text;

    // Only show our enhanced snippets if user typed a trigger
    const options = enhancedLatexSnippets
      .filter((snippet: SnippetCompletion) => 
        snippet.label.toLowerCase().startsWith(typed.toLowerCase())
      )
      .map((snippet: SnippetCompletion) => ({
        label: snippet.label,
        apply: snippet.apply,
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
      options,
      // Set validFor to ensure proper replacement
      validFor: /^\\[a-zA-Z]*$/
    };
  } catch (error) {
    console.error('Error in getSnippetCompletions:', error);
    return null;
  }
}

// Create the enhanced snippets autocomplete extension
export function latexSnippetsAutocompletion(): Extension {
  try {
    return autocompletion({
      override: [getSnippetCompletions],
      activateOnTyping: true,
      maxRenderedOptions: 8,
      defaultKeymap: true,
      // Lower priority so it doesn't override basic LaTeX commands
      optionClass: () => 'cm-snippet-completion'
    });
  } catch (error) {
    console.error('Failed to create LaTeX snippets autocompletion extension:', error);
    return [];
  }
}

export { enhancedLatexSnippets as latexSnippets };
