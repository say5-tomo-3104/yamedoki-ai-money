import { useEffect, useMemo, useState } from 'react'
import { createGame, startGame, choose, proceed, currentStep, getProfile } from './engine/engine.js'
import { buildNovel } from './engine/novel.js'
import { loadSave, storeSave, loadShelf, addToShelf, removeFromShelf } from './engine/storage.js'
import Header from './components/Header.jsx'
import {
  TitleScreen, GachaScreen, ChapterScreen, EventScreen, ReunionScreen, EndingScreen,
} from './components/Screens.jsx'
import { NovelReader, Bookshelf } from './components/NovelReader.jsx'
import './game.css'

export default function App() {
  const [game, setGame] = useState(null)
  const [view, setView] = useState('title') // title | play | novel | shelf | shelfBook
  const [shelf, setShelf] = useState(() => loadShelf())
  const [openBook, setOpenBook] = useState(null)
  const [hasSave, setHasSave] = useState(() => !!loadSave())

  useEffect(() => {
    if (game) storeSave(game)
  }, [game])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [game?.stepIndex, game?.pending, view])

  const novel = useMemo(() => (game?.finished ? buildNovel(game) : null), [game])
  const novelId = game ? `${game.profile.regionId}-${game.rng}` : null
  const saved = shelf.some((b) => b.id === novelId)

  const update = (fn) => setGame((g) => fn(g))

  const newGame = () => {
    setGame(createGame(Date.now()))
    setView('play')
  }

  const continueGame = () => {
    setGame(loadSave())
    setView('play')
  }

  const toTitle = () => {
    setHasSave(!!loadSave())
    setView('title')
  }

  const saveNovel = () => {
    const { region } = getProfile(game)
    const entry = {
      id: novelId, title: novel.title, text: novel.text, acts: novel.acts, length: novel.length,
      summary: `${region.name}・${game.pensionAge}歳受給`, savedAt: Date.now(),
    }
    setShelf(addToShelf(entry))
  }

  if (view === 'title' || (view === 'play' && !game)) {
    return (
      <div className="game">
        <TitleScreen
          hasSave={hasSave}
          shelfCount={shelf.length}
          onNew={newGame}
          onContinue={continueGame}
          onShelf={() => setView('shelf')}
        />
      </div>
    )
  }

  if (view === 'shelf') {
    return (
      <div className="game">
        <Bookshelf
          shelf={shelf}
          onOpen={(b) => { setOpenBook(b); setView('shelfBook') }}
          onRemove={(id) => setShelf(removeFromShelf(id))}
          onClose={toTitle}
        />
      </div>
    )
  }

  if (view === 'shelfBook' && openBook) {
    return (
      <div className="game">
        <NovelReader novel={openBook} onClose={() => setView('shelf')} />
      </div>
    )
  }

  if (view === 'novel' && novel) {
    return (
      <div className="game">
        <NovelReader novel={novel} onClose={() => setView('play')} onSave={saveNovel} saved={saved} />
      </div>
    )
  }

  const step = currentStep(game)
  let screen
  if (step.type === 'gacha') {
    screen = <GachaScreen state={game} onStart={() => update(startGame)} />
  } else if (step.type === 'chapter') {
    screen = <ChapterScreen step={step} onNext={() => update(proceed)} />
  } else if (step.type === 'event') {
    screen = (
      <EventScreen
        key={step.id}
        state={game}
        step={step}
        onChoose={(id) => update((g) => choose(g, id))}
        onNext={() => update(proceed)}
      />
    )
  } else if (step.type === 'reunion') {
    screen = <ReunionScreen state={game} step={step} onNext={() => update(proceed)} />
  } else {
    screen = <EndingScreen state={game} onRead={() => setView('novel')} onRestart={toTitle} />
  }

  return (
    <div className="game">
      {step.type !== 'gacha' && <Header state={game} />}
      {screen}
    </div>
  )
}
