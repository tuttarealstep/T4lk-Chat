import { createHighlighter, type HighlighterGeneric } from 'shiki'
import { createJavaScriptRegexEngine } from 'shiki/engine-javascript.mjs'

//https://github.com/antfu/shiki-stream?tab=readme-ov-file#vue-1

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let highlighter: HighlighterGeneric<any, any> | null = null

export async function useHighlighter() {
    if (!highlighter) {
        highlighter = await createHighlighter({
            langs: ['vue', 'js', 'ts', 'tsx', 'css', 'html', 'json', 'yaml', 'markdown', 'bash', 'python', 'java', 'csharp', 'cpp', 'go', 'ruby', 'php', 'swift', 'kotlin', 'rust', 'sql', 'shell', 'dockerfile', 'xml', 'graphql', 'bash'],
            themes: ['github-dark-default', 'github-light-default'],
            engine: createJavaScriptRegexEngine()
        })
    }

    return highlighter
}