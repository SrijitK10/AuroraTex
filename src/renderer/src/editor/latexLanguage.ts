/**
 * LaTeX language support for CodeMirror 6
 * Using lezer-tex parser with enhanced autocompletion and snippets
 */

import { LanguageSupport, LRLanguage, indentNodeProp, foldNodeProp, foldInside, delimitedIndent, StreamLanguage } from '@codemirror/language';
import { styleTags, tags as t } from '@lezer/highlight';
import { parser } from 'lezer-tex';
import { snippetCompletion, completeFromList, autocompletion } from '@codemirror/autocomplete';

// LaTeX mode implementation using StreamLanguage (fallback approach)
const latexMode = {
  name: 'latex',
  startState: () => ({
    inMath: false,
    mathType: null as 'inline' | 'display' | null,
    depth: 0
  }),
  
  token: (stream: any, state: any) => {
    // Skip whitespace
    if (stream.eatSpace()) return null;
    
    const ch = stream.peek();
    
    // Comments
    if (ch === '%') {
      stream.skipToEnd();
      return 'comment';
    }
    
    // Math mode detection
    if (ch === '$') {
      if (stream.match('$$')) {
        state.inMath = !state.inMath;
        state.mathType = state.inMath ? 'display' : null;
        return 'string-2';
      } else if (stream.eat('$')) {
        state.inMath = !state.inMath;
        state.mathType = state.inMath ? 'inline' : null;
        return 'string-2';
      }
    }
    
    // Math environments
    if (stream.match(/\\begin\{(equation|align|gather|multline|displaymath)\*?\}/)) {
      state.inMath = true;
      state.mathType = 'display';
      return 'keyword';
    }
    
    if (stream.match(/\\end\{(equation|align|gather|multline|displaymath)\*?\}/)) {
      state.inMath = false;
      state.mathType = null;
      return 'keyword';
    }
    
    // Commands
    if (ch === '\\') {
      stream.next();
      
      // Special commands
      if (stream.match(/documentclass|usepackage|begin|end/)) {
        return 'def';
      }
      
      // Section commands
      if (stream.match(/chapter|section|subsection|subsubsection|paragraph|subparagraph/)) {
        return 'header';
      }
      
      // Math commands
      if (state.inMath && stream.match(/[a-zA-Z]+/)) {
        return 'operator';
      }
      
      // Regular commands
      if (stream.match(/[a-zA-Z]+/)) {
        return 'keyword';
      }
      
      // Single character commands
      stream.next();
      return 'keyword';
    }
    
    // Braces and brackets
    if (ch === '{' || ch === '}') {
      stream.next();
      if (ch === '{') state.depth++;
      else state.depth--;
      return 'bracket';
    }
    
    if (ch === '[' || ch === ']') {
      stream.next();
      return 'bracket';
    }
    
    // Math content
    if (state.inMath) {
      if (stream.match(/[0-9]+(\.[0-9]*)?/)) {
        return 'number';
      }
      if (stream.match(/[a-zA-Z]+/)) {
        return 'variable';
      }
    }
    
    // Default
    stream.next();
    return null;
  },
  
  languageData: {
    commentTokens: { line: '%' },
    indentOnInput: /^\s*\\end\{/,
    wordChars: 'a-zA-Z\\',
  }
};

// Create LaTeX language using StreamLanguage (reliable approach)
export const latexLanguage = StreamLanguage.define(latexMode);



// LaTeX commands for autocompletion
const latexCommands = [
  // Document structure
  'documentclass', 'usepackage', 'begin', 'end',
  'title', 'author', 'date', 'maketitle',
  'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph',
  'chapter', 'part', 'appendix',
  
  // Text formatting
  'textbf', 'textit', 'textsc', 'texttt', 'textsf', 'textsl',
  'emph', 'underline', 'textcolor', 'colorbox',
  'tiny', 'scriptsize', 'footnotesize', 'small', 'normalsize',
  'large', 'Large', 'LARGE', 'huge', 'Huge',
  
  // Math
  'frac', 'sqrt', 'sum', 'int', 'prod', 'lim', 'sin', 'cos', 'tan',
  'log', 'ln', 'exp', 'min', 'max', 'inf', 'sup',
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta', 'lambda',
  'mu', 'nu', 'pi', 'rho', 'sigma', 'tau', 'phi', 'chi', 'psi', 'omega',
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Pi', 'Sigma',
  'Phi', 'Psi', 'Omega',
  
  // Environments
  'equation', 'align', 'gather', 'multline', 'split',
  'enumerate', 'itemize', 'description',
  'figure', 'table', 'tabular', 'array',
  'theorem', 'lemma', 'proof', 'definition', 'corollary',
  'abstract', 'quote', 'quotation', 'verse', 'verbatim',
  
  // References and citations
  'label', 'ref', 'eqref', 'pageref', 'cite', 'citep', 'citet',
  'bibliography', 'bibliographystyle',
  
  // Graphics and floats
  'includegraphics', 'caption', 'centering',
  
  // Lists and tables
  'item', 'hline', 'cline', 'multicolumn', 'multirow',
  
  // Spacing and positioning
  'hspace', 'vspace', 'newline', 'linebreak', 'pagebreak',
  'newpage', 'clearpage', 'cleardoublepage'
].map(cmd => ({ label: '\\' + cmd, type: 'keyword' }));

// LaTeX environments for autocompletion
const latexEnvironments = [
  'document', 'abstract', 'quote', 'quotation', 'verse',
  'equation', 'equation*', 'align', 'align*', 'gather', 'gather*',
  'multline', 'multline*', 'split', 'cases',
  'enumerate', 'itemize', 'description',
  'figure', 'table', 'center', 'flushleft', 'flushright',
  'tabular', 'array', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix',
  'theorem', 'lemma', 'proof', 'definition', 'corollary',
  'verbatim', 'lstlisting', 'minipage'
].map(env => ({ label: env, type: 'class' }));

// LaTeX packages for autocompletion
const latexPackages = [
  'amsmath', 'amsfonts', 'amssymb', 'graphicx', 'geometry',
  'hyperref', 'babel', 'inputenc', 'fontenc', 'xcolor',
  'tikz', 'pgfplots', 'listings', 'fancyhdr', 'setspace',
  'natbib', 'biblatex', 'booktabs', 'multirow', 'longtable',
  'algorithm', 'algorithmic', 'subfig', 'subcaption',
  'mathtools', 'physics', 'siunitx', 'url', 'cleveref'
].map(pkg => ({ label: pkg, type: 'namespace' }));

// LaTeX snippets
const latexSnippets = [
  snippetCompletion('\\begin{#{env}}\n\t#{}\n\\end{#{env}}', { label: 'begin', detail: 'Environment' }),
  snippetCompletion('\\section{#{title}}', { label: 'section', detail: 'Section' }),
  snippetCompletion('\\subsection{#{title}}', { label: 'subsection', detail: 'Subsection' }),
  snippetCompletion('\\subsubsection{#{title}}', { label: 'subsubsection', detail: 'Subsubsection' }),
  snippetCompletion('\\frac{#{numerator}}{#{denominator}}', { label: 'frac', detail: 'Fraction' }),
  snippetCompletion('\\sqrt{#{content}}', { label: 'sqrt', detail: 'Square root' }),
  snippetCompletion('\\textbf{#{text}}', { label: 'textbf', detail: 'Bold text' }),
  snippetCompletion('\\textit{#{text}}', { label: 'textit', detail: 'Italic text' }),
  snippetCompletion('\\emph{#{text}}', { label: 'emph', detail: 'Emphasized text' }),
  snippetCompletion('\\label{#{label}}', { label: 'label', detail: 'Label' }),
  snippetCompletion('\\ref{#{label}}', { label: 'ref', detail: 'Reference' }),
  snippetCompletion('\\cite{#{key}}', { label: 'cite', detail: 'Citation' }),
  snippetCompletion('\\includegraphics[width=#{width}]{#{file}}', { label: 'includegraphics', detail: 'Include graphics' }),
  snippetCompletion('\\begin{figure}[#{position}]\n\t\\centering\n\t\\includegraphics[width=#{width}]{#{file}}\n\t\\caption{#{caption}}\n\t\\label{#{label}}\n\\end{figure}', { label: 'figure', detail: 'Figure environment' }),
  snippetCompletion('\\begin{table}[#{position}]\n\t\\centering\n\t\\begin{tabular}{#{columns}}\n\t\t#{content}\n\t\\end{tabular}\n\t\\caption{#{caption}}\n\t\\label{#{label}}\n\\end{table}', { label: 'table', detail: 'Table environment' }),
  snippetCompletion('\\begin{equation}\n\t#{equation}\n\\end{equation}', { label: 'equation', detail: 'Equation environment' }),
  snippetCompletion('\\begin{align}\n\t#{equations}\n\\end{align}', { label: 'align', detail: 'Align environment' }),
  snippetCompletion('\\begin{itemize}\n\t\\item #{item1}\n\t\\item #{item2}\n\\end{itemize}', { label: 'itemize', detail: 'Itemize environment' }),
  snippetCompletion('\\begin{enumerate}\n\t\\item #{item1}\n\t\\item #{item2}\n\\end{enumerate}', { label: 'enumerate', detail: 'Enumerate environment' }),
];

// LaTeX autocompletion
const latexCompletions = completeFromList([
  ...latexCommands,
  ...latexEnvironments,
  ...latexPackages,
  ...latexSnippets
]);

// Export the language support
export function latex() {
  return new LanguageSupport(latexLanguage, [
    autocompletion({ override: [latexCompletions] })
  ]);
}

// File extension mapping
export const latexExtensions = ['tex', 'latex', 'sty', 'cls', 'bib'];

// Check if file is LaTeX
export function isLatexFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return latexExtensions.includes(ext || '');
}
