import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const css=await readFile(new URL('../src/notebook.css',import.meta.url),'utf8')
const feedback=await readFile(new URL('../src/review-feedback.css',import.meta.url),'utf8')
const luminance=hex=>hex.match(/[a-f0-9]{2}/gi).map(channel=>parseInt(channel,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)
const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(values[0]+.05)/(values[1]+.05)}
for(const [theme,selector] of [['light',':root {'],['dark',":root[data-theme='dark'] {"]]) {
  test(`${theme} save controls: strong text contrast and visible tonal boundaries`,()=>{
    const colors=Object.fromEntries([...feedback.split(selector)[1].split('}')[0].matchAll(/--([\w-]+): (#[a-f0-9]{6})/gi)].map(match=>[match[1],match[2]]))
    assert.ok(contrast(colors['save-ink'],colors['save-bg'])>=7)
    assert.ok(contrast(colors['save-ink'],colors['save-hover'])>=7)
    assert.ok(contrast(colors['save-next-ink'],colors['save-next-bg'])>=7)
    assert.ok(contrast(colors['save-next-border'],colors['save-next-bg'])>=3)
    assert.notEqual(colors['save-bg'],colors['save-next-bg'])
  })
  test(`${theme} palette: body, secondary text, selected actions and primary buttons meet WCAG AA`,()=>{
    const block=css.split(selector)[1].split('}')[0]
    const colors=Object.fromEntries([...block.matchAll(/--([\w-]+): (#[a-f0-9]{6})/gi)].map(match=>[match[1],match[2]]))
    for(const [foreground,background] of [['ink','surface'],['muted','paper'],['muted','surface'],['muted','surface-soft'],['accent','accent-soft'],['paper','accent']]) assert.ok(contrast(colors[foreground],colors[background])>=4.5,`${foreground}/${background}: ${contrast(colors[foreground],colors[background]).toFixed(2)}`)
  })
}
