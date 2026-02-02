import React from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

/**
 * Lightweight markdown renderer for chat messages.
 * Handles: **bold**, *italic*, `code`, ```code blocks```, headers, lists, links
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  if (!content) return null

  // Process markdown to HTML
  const processMarkdown = (text: string): string => {
    let html = text

    // Escape HTML entities first (security)
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // Code blocks (```...```) - must be processed before inline code
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre class="md-code-block"><code>${code.trim()}</code></pre>`
    })

    // Inline code (`...`)
    html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')

    // Bold (**...** or __...__)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>')

    // Italic (*...* or _..._) - careful not to match ** or __
    html = html.replace(/(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    html = html.replace(/(?<!_)_(?!_)([^_]+)(?<!_)_(?!_)/g, '<em>$1</em>')

    // Headers (# ... ## ... ### ...)
    html = html.replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
    html = html.replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    html = html.replace(/^# (.+)$/gm, '<h2 class="md-h2">$1</h2>')

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr class="md-hr" />')

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>')

    // Unordered lists (- item or * item)
    html = html.replace(/^[\-\*] (.+)$/gm, '<li class="md-li">$1</li>')
    // Wrap consecutive li items in ul
    html = html.replace(/(<li class="md-li">.*<\/li>\n?)+/g, (match) => {
      return `<ul class="md-ul">${match}</ul>`
    })

    // Ordered lists (1. item)
    html = html.replace(/^\d+\. (.+)$/gm, '<li class="md-li-ordered">$1</li>')
    // Wrap consecutive ordered li items in ol
    html = html.replace(/(<li class="md-li-ordered">.*<\/li>\n?)+/g, (match) => {
      return `<ol class="md-ol">${match}</ol>`
    })

    // Paragraphs - convert double newlines to paragraph breaks
    html = html.replace(/\n\n+/g, '</p><p class="md-p">')

    // Single newlines to <br> (but not inside code blocks or lists)
    html = html.replace(/(?<!<\/pre>|<\/li>|<\/ul>|<\/ol>|<\/h\d>)\n(?!<)/g, '<br />')

    // Wrap in paragraph if not already wrapped
    if (!html.startsWith('<')) {
      html = `<p class="md-p">${html}</p>`
    }

    return html
  }

  const htmlContent = processMarkdown(content)

  return (
    <div
      className={`markdown-content ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  )
}

export default MarkdownRenderer
