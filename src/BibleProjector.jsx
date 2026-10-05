import { useLayoutEffect, useRef } from 'react'
import { bibleProjectorBlocks } from './bibleProjectorBlocks'
import './BibleProjector.css'

export default function BibleProjector({ passage, verse, maxFontSize }) {
  const ref = useRef(null)
  const blocks = bibleProjectorBlocks(passage, verse)
  useLayoutEffect(() => {
    const container = ref.current
    const fit = () => {
      // Measure verse AND reference together; use the largest common fitting size.
      const rows = [...container.children]
      let size = maxFontSize
      const apply = () => container.style.setProperty('--bible-font-size', `${size}px`)
      apply()
      while (size > 8 && rows.some(row => row.firstElementChild.scrollHeight > row.clientHeight || row.firstElementChild.scrollWidth > row.clientWidth)) {
        size -= 1
        apply()
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(container)
    return () => observer.disconnect()
  }, [passage, verse, maxFontSize])
  return <div ref={ref} className="bible-projector-blocks" style={{ gridTemplateRows: `repeat(${Math.max(1, blocks.length)}, minmax(0, 1fr))` }}>
    {blocks.map(block => <section className="bible-projector-block" key={block.language} data-language={block.language}>
      <div className="bible-projector-block-content">
        <div className="bible-projector-verse">{block.text}</div>
        <div className="bible-projector-reference">{block.reference}</div>
      </div>
    </section>)}
  </div>
}
