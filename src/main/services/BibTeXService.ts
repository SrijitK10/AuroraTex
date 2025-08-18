import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { BibEntryDTO } from '../types';

export class BibTeXService {
  private writeTimeouts = new Map<string, NodeJS.Timeout>();

  async parseBibFile(projectRoot: string, fileName: string): Promise<BibEntryDTO[]> {
    const filePath = join(projectRoot, fileName);
    
    if (!existsSync(filePath)) {
      return [];
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      return this.parseBibContent(content);
    } catch (error) {
      console.error('Failed to parse BibTeX file:', error);
      return [];
    }
  }

  async writeBibFile(projectRoot: string, fileName: string, entries: BibEntryDTO[]): Promise<{ ok: boolean }> {
    const filePath = join(projectRoot, fileName);
    const fileKey = `${projectRoot}:${fileName}`;
    
    // Clear any existing timeout for this file
    if (this.writeTimeouts.has(fileKey)) {
      clearTimeout(this.writeTimeouts.get(fileKey)!);
    }
    
    // Set a new timeout to batch writes
    return new Promise((resolve) => {
      const timeout = setTimeout(async () => {
        try {
          const content = this.generateBibContent(entries);
          await writeFile(filePath, content);
          this.writeTimeouts.delete(fileKey);
          resolve({ ok: true });
        } catch (error) {
          console.error('Failed to write BibTeX file:', error);
          this.writeTimeouts.delete(fileKey);
          resolve({ ok: false });
        }
      }, 200); // 200ms delay to batch rapid writes
      
      this.writeTimeouts.set(fileKey, timeout);
    });
  }

  private parseBibContent(content: string): BibEntryDTO[] {
    const entries: BibEntryDTO[] = [];
    const lines = content.split('\n');
    let currentEntry: Partial<BibEntryDTO> | null = null;
    let braceLevel = 0;
    let inEntry = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('%')) {
        continue;
      }

      // Check for entry start
      const entryMatch = line.match(/^@(\w+)\s*\{\s*([^,\s}]+)\s*,?\s*$/);
      if (entryMatch) {
        if (currentEntry) {
          // Save previous entry if exists
          if (currentEntry.id && currentEntry.type && currentEntry.key) {
            entries.push(currentEntry as BibEntryDTO);
          }
        }

        currentEntry = {
          id: uuidv4(),
          type: entryMatch[1].toLowerCase(),
          key: entryMatch[2],
          fields: {}
        };
        inEntry = true;
        braceLevel = 1;
        continue;
      }

      if (!inEntry || !currentEntry) {
        continue;
      }

      // Count braces to track entry boundaries
      for (const char of line) {
        if (char === '{') braceLevel++;
        else if (char === '}') braceLevel--;
      }

      // Check if entry is complete
      if (braceLevel === 0) {
        if (currentEntry.id && currentEntry.type && currentEntry.key) {
          entries.push(currentEntry as BibEntryDTO);
        }
        currentEntry = null;
        inEntry = false;
        continue;
      }

      // Parse field
      const fieldMatch = line.match(/^\s*(\w+)\s*=\s*\{([^}]*)\}\s*,?\s*$/) ||
                        line.match(/^\s*(\w+)\s*=\s*"([^"]*)"\s*,?\s*$/) ||
                        line.match(/^\s*(\w+)\s*=\s*([^,}]+)\s*,?\s*$/);
      
      if (fieldMatch && currentEntry.fields) {
        const fieldName = fieldMatch[1].toLowerCase();
        let fieldValue = fieldMatch[2].trim();
        
        // Handle multi-line values
        if (fieldValue.endsWith('{') || fieldValue.endsWith('"')) {
          let j = i + 1;
          while (j < lines.length) {
            const nextLine = lines[j].trim();
            fieldValue += ' ' + nextLine;
            i = j;
            j++;
            
            if (nextLine.includes('}') || nextLine.includes('"')) {
              break;
            }
          }
          
          // Clean up the field value
          fieldValue = fieldValue.replace(/[{}"]$/g, '').replace(/^[{"]/, '').trim();
        }
        
        currentEntry.fields[fieldName] = fieldValue;
      }
    }

    // Handle last entry if the file doesn't end with closing brace
    if (currentEntry && currentEntry.id && currentEntry.type && currentEntry.key) {
      entries.push(currentEntry as BibEntryDTO);
    }

    return entries;
  }

  private generateBibContent(entries: BibEntryDTO[]): string {
    const lines: string[] = [];

    for (const entry of entries) {
      lines.push(`@${entry.type}{${entry.key},`);
      
      const fieldNames = Object.keys(entry.fields);
      for (let i = 0; i < fieldNames.length; i++) {
        const fieldName = fieldNames[i];
        const fieldValue = entry.fields[fieldName];
        const isLast = i === fieldNames.length - 1;
        
        // Format field value
        let formattedValue = fieldValue;
        if (this.shouldQuoteField(fieldName, fieldValue)) {
          formattedValue = `{${fieldValue}}`;
        }
        
        const comma = isLast ? '' : ',';
        lines.push(`    ${fieldName} = ${formattedValue}${comma}`);
      }
      
      lines.push('}');
      lines.push(''); // Empty line between entries
    }

    return lines.join('\n');
  }

  private shouldQuoteField(fieldName: string, fieldValue: string): boolean {
    // Fields that typically need braces
    const bracedFields = ['title', 'booktitle', 'journal', 'author', 'editor', 'publisher', 'address', 'note', 'abstract'];
    
    // Check if it's a field that should be braced
    if (bracedFields.includes(fieldName.toLowerCase())) {
      return true;
    }
    
    // Check if value contains special characters that need protection
    if (/[A-Z]/.test(fieldValue) || /[{}\\]/.test(fieldValue)) {
      return true;
    }
    
    // Numeric fields don't need braces
    if (/^\d+$/.test(fieldValue)) {
      return false;
    }
    
    return true;
  }

  createNewEntry(type: string): BibEntryDTO {
    const entryTypes: Record<string, string[]> = {
      article: ['title', 'author', 'journal', 'year', 'volume', 'number', 'pages'],
      book: ['title', 'author', 'publisher', 'year', 'address'],
      inproceedings: ['title', 'author', 'booktitle', 'year', 'pages'],
      inbook: ['title', 'author', 'chapter', 'pages', 'publisher', 'year'],
      incollection: ['title', 'author', 'booktitle', 'publisher', 'year', 'pages'],
      manual: ['title', 'organization', 'year'],
      mastersthesis: ['title', 'author', 'school', 'year'],
      phdthesis: ['title', 'author', 'school', 'year'],
      proceedings: ['title', 'year', 'publisher'],
      techreport: ['title', 'author', 'institution', 'year'],
      unpublished: ['title', 'author', 'note']
    };

    const fields: Record<string, string> = {};
    const requiredFields = entryTypes[type.toLowerCase()] || ['title', 'author', 'year'];
    
    for (const field of requiredFields) {
      fields[field] = '';
    }

    return {
      id: uuidv4(),
      type: type.toLowerCase(),
      key: `newentry${Date.now()}`,
      fields
    };
  }

  getEntryTypes(): Array<{ type: string; description: string; fields: string[] }> {
    return [
      { type: 'article', description: 'Journal article', fields: ['title', 'author', 'journal', 'year', 'volume', 'number', 'pages'] },
      { type: 'book', description: 'Book', fields: ['title', 'author', 'publisher', 'year', 'address'] },
      { type: 'inproceedings', description: 'Conference paper', fields: ['title', 'author', 'booktitle', 'year', 'pages'] },
      { type: 'inbook', description: 'Part of a book', fields: ['title', 'author', 'chapter', 'pages', 'publisher', 'year'] },
      { type: 'incollection', description: 'Article in a collection', fields: ['title', 'author', 'booktitle', 'publisher', 'year', 'pages'] },
      { type: 'manual', description: 'Technical manual', fields: ['title', 'organization', 'year'] },
      { type: 'mastersthesis', description: 'Master\'s thesis', fields: ['title', 'author', 'school', 'year'] },
      { type: 'phdthesis', description: 'PhD thesis', fields: ['title', 'author', 'school', 'year'] },
      { type: 'proceedings', description: 'Conference proceedings', fields: ['title', 'year', 'publisher'] },
      { type: 'techreport', description: 'Technical report', fields: ['title', 'author', 'institution', 'year'] },
      { type: 'unpublished', description: 'Unpublished work', fields: ['title', 'author', 'note'] }
    ];
  }
}
