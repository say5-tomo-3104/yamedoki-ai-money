// 進行中のセーブデータと「本棚」（完成した小説）を localStorage に保存する
import { SAVE_VERSION } from './engine.js'

const SAVE_KEY = 'goldenDusk.save'
const SHELF_KEY = 'goldenDusk.shelf'

function read(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 保存できない環境（プライベートモード等）でも遊べるようにする
  }
}

export function loadSave() {
  const s = read(SAVE_KEY)
  return s && s.version === SAVE_VERSION ? s : null
}

export function storeSave(state) {
  write(SAVE_KEY, state)
}

export function loadShelf() {
  const list = read(SHELF_KEY)
  return Array.isArray(list) ? list : []
}

export function addToShelf(entry) {
  const list = loadShelf().filter((x) => x.id !== entry.id)
  list.unshift(entry)
  write(SHELF_KEY, list.slice(0, 30))
  return list
}

export function removeFromShelf(id) {
  const list = loadShelf().filter((x) => x.id !== id)
  write(SHELF_KEY, list)
  return list
}
