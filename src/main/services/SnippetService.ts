import { join } from 'path';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { SnippetDTO } from '../types';

export class SnippetService {
  private snippetsDir: string;
  private snippetsFile: string;

  constructor() {
    this.snippetsDir = join(homedir(), '.myoverleaf');
    this.snippetsFile = join(this.snippetsDir, 'snippets.json');
  }

  async initialize(): Promise<void> {
    // Ensure directory exists
    if (!existsSync(this.snippetsDir)) {
      await mkdir(this.snippetsDir, { recursive: true });
    }

    // Create default snippets if file doesn't exist
    if (!existsSync(this.snippetsFile)) {
      await this.createDefaultSnippets();
    }
  }

  async list(): Promise<SnippetDTO[]> {
    try {
      if (!existsSync(this.snippetsFile)) {
        return [];
      }

      const content = await readFile(this.snippetsFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to load snippets:', error);
      return [];
    }
  }

  async search(query: string): Promise<SnippetDTO[]> {
    const snippets = await this.list();
    const lowercaseQuery = query.toLowerCase();

    return snippets.filter(snippet =>
      snippet.name.toLowerCase().includes(lowercaseQuery) ||
      snippet.description.toLowerCase().includes(lowercaseQuery) ||
      snippet.trigger.toLowerCase().includes(lowercaseQuery) ||
      snippet.category.toLowerCase().includes(lowercaseQuery)
    );
  }

  async getByCategory(category: string): Promise<SnippetDTO[]> {
    const snippets = await this.list();
    return snippets.filter(snippet => snippet.category === category);
  }

  private async createDefaultSnippets(): Promise<void> {
    const defaultSnippets: Omit<SnippetDTO, 'id'>[] = [
      // Document structure
      {
        name: 'Figure Environment',
        description: 'Basic figure with caption and label',
        category: 'Figures',
        trigger: 'figure',
        content: `\\begin{figure}[h]
    \\centering
    \\includegraphics[width=0.8\\textwidth]{filename}
    \\caption{Caption text}
    \\label{fig:label}
\\end{figure}`,
        cursorPosition: 67 // Position after {filename}
      },
      {
        name: 'Table Environment',
        description: 'Basic table with caption and label',
        category: 'Tables',
        trigger: 'table',
        content: `\\begin{table}[h]
    \\centering
    \\begin{tabular}{|c|c|}
        \\hline
        Column 1 & Column 2 \\\\
        \\hline
        Data 1 & Data 2 \\\\
        \\hline
    \\end{tabular}
    \\caption{Caption text}
    \\label{tab:label}
\\end{table}`,
        cursorPosition: 85 // Position after Column 1
      },
      {
        name: 'Itemize List',
        description: 'Bulleted list',
        category: 'Lists',
        trigger: 'itemize',
        content: `\\begin{itemize}
    \\item First item
    \\item Second item
    \\item Third item
\\end{itemize}`,
        cursorPosition: 28 // Position after "First "
      },
      {
        name: 'Enumerate List',
        description: 'Numbered list',
        category: 'Lists',
        trigger: 'enumerate',
        content: `\\begin{enumerate}
    \\item First item
    \\item Second item
    \\item Third item
\\end{enumerate}`,
        cursorPosition: 30 // Position after "First "
      },
      // Math environments
      {
        name: 'Equation',
        description: 'Numbered equation',
        category: 'Math',
        trigger: 'equation',
        content: `\\begin{equation}
    \\label{eq:label}
    equation
\\end{equation}`,
        cursorPosition: 36 // Position at "equation"
      },
      {
        name: 'Align',
        description: 'Aligned equations',
        category: 'Math',
        trigger: 'align',
        content: `\\begin{align}
    equation_1 &= result_1 \\label{eq:label1} \\\\
    equation_2 &= result_2 \\label{eq:label2}
\\end{align}`,
        cursorPosition: 20 // Position at "equation_1"
      },
      {
        name: 'Matrix',
        description: 'Matrix environment',
        category: 'Math',
        trigger: 'matrix',
        content: `\\begin{pmatrix}
    a & b \\\\
    c & d
\\end{pmatrix}`,
        cursorPosition: 20 // Position at "a"
      },
      // Sections
      {
        name: 'Section',
        description: 'New section',
        category: 'Structure',
        trigger: 'section',
        content: '\\section{Section Title}',
        cursorPosition: 9 // Position after {
      },
      {
        name: 'Subsection',
        description: 'New subsection',
        category: 'Structure',
        trigger: 'subsection',
        content: '\\subsection{Subsection Title}',
        cursorPosition: 12 // Position after {
      },
      {
        name: 'Subsubsection',
        description: 'New subsubsection',
        category: 'Structure',
        trigger: 'subsubsection',
        content: '\\subsubsection{Subsubsection Title}',
        cursorPosition: 15 // Position after {
      },
      // Code and verbatim
      {
        name: 'Code Block',
        description: 'Verbatim code block',
        category: 'Code',
        trigger: 'code',
        content: `\\begin{verbatim}
code here
\\end{verbatim}`,
        cursorPosition: 17 // Position at "code here"
      },
      {
        name: 'Inline Code',
        description: 'Inline verbatim text',
        category: 'Code',
        trigger: 'verb',
        content: '\\verb|code|',
        cursorPosition: 6 // Position after first |
      },
      // References
      {
        name: 'Citation',
        description: 'Citation reference',
        category: 'References',
        trigger: 'cite',
        content: '\\cite{key}',
        cursorPosition: 6 // Position after {
      },
      {
        name: 'Reference',
        description: 'Cross-reference',
        category: 'References',
        trigger: 'ref',
        content: '\\ref{label}',
        cursorPosition: 5 // Position after {
      },
      // Common symbols
      {
        name: 'Alpha',
        description: 'Greek letter alpha',
        category: 'Symbols',
        trigger: 'alpha',
        content: '\\alpha'
      },
      {
        name: 'Beta',
        description: 'Greek letter beta',
        category: 'Symbols',
        trigger: 'beta',
        content: '\\beta'
      },
      {
        name: 'Sum',
        description: 'Summation symbol',
        category: 'Symbols',
        trigger: 'sum',
        content: '\\sum_{i=1}^{n}',
        cursorPosition: 7 // Position after i=
      },
      {
        name: 'Integral',
        description: 'Integral symbol',
        category: 'Symbols',
        trigger: 'int',
        content: '\\int_{a}^{b}',
        cursorPosition: 6 // Position after {
      }
    ];

    const snippetsWithIds = defaultSnippets.map(snippet => ({
      ...snippet,
      id: uuidv4()
    }));

    await writeFile(this.snippetsFile, JSON.stringify(snippetsWithIds, null, 2));
  }
}
