import { useState } from 'react'

function topSkill(config) {
  return Object.entries(config.skills).sort((a, b) => b[1] - a[1])[0][0]
}

export default function ResultPanel({ winner, loser, onRematch, videoIdea }) {
  const skill = topSkill(winner)
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  return (
    <div className="winner-reveal" role="dialog" aria-modal="true" aria-label={`${winner.name} wins`} style={{ '--winner-color': winner.color }}>
      <div className="winner-reveal-rays" />
      <div className="winner-confetti" aria-hidden="true">
        {Array.from({ length: 28 }, (_, index) => (
          <i
            key={index}
            style={{
              '--left': `${(index * 37) % 100}%`,
              '--delay': `${(index % 8) * -0.42}s`,
              '--duration': `${2.8 + (index % 6) * 0.35}s`,
              '--drift': `${((index % 5) - 2) * 8}vw`,
              '--piece-color': `hsl(${index * 43} 90% 65%)`,
            }}
          />
        ))}
      </div>
      <section className="result-panel">
        <button className="winner-close" aria-label="Close winner announcement" onClick={() => setVisible(false)}>×</button>
        <span className="winner-kicker">Battle complete</span>
        <div className="winner-flag">{winner.flag ?? '🌍'}</div>
        <h2>{winner.name}</h2>
        <strong className="winner-declaration">Wins!</strong>
        <p className="result-copy">{winner.name} outlasted {loser.name} with a deadly {skill} advantage.</p>
        <div className="winner-actions">
          <button className="primary-button compact" onClick={onRematch}>Run Rematch</button>
          <button className="secondary-button" onClick={() => setVisible(false)}>Watch Celebration</button>
        </div>
        {videoIdea && <p className="commander-video-idea"><span>Video Idea</span>{videoIdea}</p>}

        <div className="creator-grid">
          <div>
            <span>YouTube title</span>
            <p>I made {winner.name} and {loser.name} fight using max {skill}...</p>
          </div>
          <div>
            <span>TikTok caption</span>
            <p>{winner.flag} vs {loser.flag}: nobody expected that ending. #CountryClash</p>
          </div>
        </div>
      </section>
    </div>
  )
}
