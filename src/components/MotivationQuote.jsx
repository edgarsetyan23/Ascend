import { useState, useEffect } from 'react'

// Short and original — no added commentary, no filler sentences.
const QUOTES = [
  { text: "I fear not the man who has practiced 10,000 kicks once, but I fear the man who has practiced one kick 10,000 times.", author: "Bruce Lee" },
  { text: "Be water, my friend.", author: "Bruce Lee" },
  { text: "Empty your cup so that it may be filled.", author: "Bruce Lee" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
  { text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius" },
  { text: "You have power over your mind, not outside events. Realize this and you will find strength.", author: "Marcus Aurelius" },
  { text: "Never let the future disturb you. You will meet it with the same weapons of reason which today arm you against the present.", author: "Marcus Aurelius" },
  { text: "Victorious warriors win first and then go to war, while defeated warriors go to war first and then seek to win.", author: "Sun Tzu" },
  { text: "In the midst of chaos, there is also opportunity.", author: "Sun Tzu" },
  { text: "Today is victory over yourself of yesterday.", author: "Miyamoto Musashi" },
  { text: "Do nothing that is of no use.", author: "Miyamoto Musashi" },
  { text: "Discipline equals freedom.", author: "Jocko Willink" },
  { text: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
  { text: "Sweat more in training, bleed less in war.", author: "Spartan Proverb" },
  { text: "Mastery is not about perfection. It is about a relationship with practice.", author: "George Leonard" },
  { text: "Hard choices, easy life. Easy choices, hard life.", author: "Jerzy Gregorek" },
  { text: "The man who moves a mountain begins by carrying away small stones.", author: "Confucius" },
  { text: "A ship in harbor is safe — but that is not what ships are for.", author: "John A. Shedd" },
]

export function MotivationQuote() {
  const [idx, setIdx]        = useState(() => Math.floor(Math.random() * QUOTES.length))
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx((i) => (i + 1) % QUOTES.length)
        setVisible(true)
      }, 400)
    }, 14000)
    return () => clearInterval(timer)
  }, [])

  const { text, author } = QUOTES[idx]

  return (
    <div className={`quote-box ${visible ? 'quote-visible' : 'quote-hidden'}`}>
      <div className="quote-accent-line" />
      <p className="quote-text">"{text}"</p>
      <span className="quote-author">— {author}</span>
    </div>
  )
}
