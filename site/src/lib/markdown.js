/* Markdown -> HTML for post bodies. The content is the repo's own, so it is
   trusted; there is no sanitiser. Headings get ids so they can be linked to. */
import { marked } from "marked"

const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-")

const renderer = {
  heading({ tokens, depth }) {
    const text = this.parser.parseInline(tokens)
    return `<h${depth} id="${slug(text)}">${text}</h${depth}>\n`
  },
  image({ href, title, text }) {
    const cap = title ? `<figcaption>${title}</figcaption>` : ""
    return `<figure><img src="${href}" alt="${text || ""}" loading="lazy" />${cap}</figure>`
  },
  table(token) {
    // marked's own table markup, wrapped so a wide table scrolls inside the column.
    const html = marked.Renderer.prototype.table.call(this, token)
    return `<div class="table-wrap">${html}</div>`
  },
  link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens)
    const ext = /^https?:\/\//.test(href)
    const t = title ? ` title="${title}"` : ""
    return `<a href="${href}"${t}${ext ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`
  },
}

marked.use({ gfm: true, breaks: false, renderer })

export function render(md) {
  return marked.parse(md || "")
}
