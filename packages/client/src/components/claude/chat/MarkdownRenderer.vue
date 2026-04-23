<template>
  <div class="markdown-body" v-html="renderedHtml"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

const props = defineProps<{ content: string }>()

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`
      } catch { /* fallback */ }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
  },
})

const renderedHtml = computed(() => md.render(props.content))
</script>

<style lang="scss">
.markdown-body {
  h1, h2, h3, h4 { margin: 16px 0 8px; font-weight: 600; }
  h1 { font-size: 1.5em; }
  h2 { font-size: 1.3em; }
  h3 { font-size: 1.15em; }

  p { margin: 8px 0; }

  code {
    background: var(--bg-secondary);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  pre {
    margin: 12px 0;
    border-radius: 8px;
    overflow-x: auto;

    code {
      background: transparent;
      padding: 0;
      font-size: 13px;
    }
  }

  ul, ol { padding-left: 20px; margin: 8px 0; }
  li { margin: 4px 0; }

  blockquote {
    border-left: 3px solid var(--primary-color);
    padding-left: 12px;
    margin: 8px 0;
    color: var(--text-secondary);
  }

  a {
    color: var(--primary-color);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }

  table {
    border-collapse: collapse;
    margin: 12px 0;
    width: 100%;

    th, td {
      border: 1px solid var(--border-color);
      padding: 6px 12px;
      text-align: left;
    }

    th { background: var(--bg-secondary); font-weight: 600; }
  }
}
</style>
