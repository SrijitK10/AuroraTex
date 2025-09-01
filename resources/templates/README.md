# Bundled Templates

This directory contains sample LaTeX templates that are included with Offline Overleaf.

## Available Templates

### 1. Simple Article (`simple-article.json`)
- **Purpose**: Clean, minimal article template
- **Best for**: Academic papers, reports, journal articles
- **Features**: 
  - Standard article structure
  - Bibliography support
  - Figure and table examples
  - Professional formatting

### 2. Thesis/Report (`thesis-report.json`)
- **Purpose**: Comprehensive template for longer documents
- **Best for**: Thesis, dissertation, technical reports
- **Features**:
  - Chapter-based organization
  - Title page, abstract, table of contents
  - Multiple bibliography entries
  - Professional academic formatting

### 3. Presentation (Beamer) (`presentation-beamer.json`)
- **Purpose**: Modern presentation template
- **Best for**: Academic presentations, conference talks
- **Features**:
  - Beamer class with Madrid theme
  - Slide animations and blocks
  - Two-column layouts
  - Professional slide design

## Template Structure

Each template is defined as a JSON file with:
- `id`: Unique identifier
- `name`: Display name
- `description`: Brief description
- `category`: Template category
- `tags`: Search tags
- `mainFile`: Main LaTeX file
- `files`: Dictionary of file contents

## Usage

Templates are automatically loaded by the application and available in the "New Project" dialog. Users can:
1. Browse templates by category
2. Search using tags
3. Preview template descriptions
4. Create new projects from templates

## Adding Custom Templates

To add custom templates to the application:
1. Create a new JSON file following the structure above
2. Place it in this directory
3. Restart the application
4. The template will appear in the "New Project" dialog

## License

These templates are provided under the MIT license and can be freely used and modified.
