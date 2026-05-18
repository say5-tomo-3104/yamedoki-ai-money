import { useState, useEffect } from 'react'
import './App.css'

function normalizeSubscription(sub) {
  return {
    id: sub.id || Date.now(),
    name: sub.name || '',
    category: sub.category || 'その他',
    monthlyPrice: typeof sub.monthlyPrice === 'number'
      ? sub.monthlyPrice
      : parseFloat(sub.monthlyPrice) || 0,
    paymentDay: sub.paymentDay || '',
    frequency: sub.frequency || 'daily',
    memo: sub.memo || ''
  }
}

// localStorage から初期データを取得する関数
function getInitialSubscriptions() {
  try {
    const saved = localStorage.getItem('subscriptions')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeSubscription)
      }
    }
  } catch (error) {
    console.error('localStorage read error:', error)
  }
  return []
}

const frequencyLabel = (value) => {
  return {
    daily: '毎日使う',
    weekly: '週に数回使う',
    monthly: '月に数回使う',
    rarely: 'ほぼ使わない'
  }[value] || value
}

const frequencyScore = {
  daily: 0,
  weekly: 20,
  monthly: 30,
  rarely: 40
}

// 日本の主要サブスクのプリセット（料金は2026年5月時点・税込/月額）
const servicePresets = {
  // 動画配信
  'Netflix':            { category: '動画配信', price: 1590 },
  'Amazon Prime':       { category: '動画配信', price: 600 },
  'Disney+':            { category: '動画配信', price: 1140 },
  'U-NEXT':             { category: '動画配信', price: 2189 },
  'Hulu':               { category: '動画配信', price: 1026 },
  'DMM TV':             { category: '動画配信', price: 550 },
  // 音楽
  'Spotify':            { category: '音楽',     price: 1080 },
  'Apple Music':        { category: '音楽',     price: 1080 },
  'YouTube Premium':    { category: '音楽',     price: 1280 },
  // AI
  'ChatGPT':            { category: 'AI',       price: 3000 },  // 目安
  'Claude':             { category: 'AI',       price: 3000 },  // 目安
  'Gemini':             { category: 'AI',       price: 2900 },
  // クラウド
  'iCloud+':            { category: 'クラウド', price: 130 },
  'Google One':         { category: 'クラウド', price: 250 },
  'Dropbox':            { category: 'クラウド', price: 1500 },  // 目安
  // 仕事・ツール
  'Canva':              { category: '仕事・ツール', price: 1180 },
  'Adobe':              { category: '仕事・ツール', price: 3280 }, // 目安
  'Notion':             { category: '仕事・ツール', price: 1650 }, // 目安
  // 電子書籍
  'Kindle Unlimited':   { category: '電子書籍', price: 980 },
  'Audible':            { category: '電子書籍', price: 1500 },
  // ゲーム
  'Nintendo Switch Online': { category: 'ゲーム', price: 306 },  // 目安
  'PlayStation Plus':   { category: 'ゲーム',   price: 850 },    // 目安
}
const serviceIconMap = {
  Netflix: '🎬',
  'U-NEXT': '📺',
  Spotify: '🎵',
  'Apple Music': '🎧',
  ChatGPT: '🤖',
  Claude: '✨',
  Gemini: '🔮',
  Canva: '🎨',
  Dropbox: '☁️',
  'Google One': '☁️',
  ジム: '💪',
  'Kindle Unlimited': '📚',
  'YouTube Premium': '▶️'
}

const categoryClassMap = {
  '動画配信': 'category-red',
  '音楽': 'category-green',
  'AI': 'category-purple',
  '学習': 'category-blue',
  '健康・ジム': 'category-orange',
  '美容': 'category-pink',
  'クラウド': 'category-blue',
  'ゲーム': 'category-orange',
  '電子書籍': 'category-blue',
  'ニュース': 'category-red',
  '仕事・ツール': 'category-purple',
  '通信': 'category-blue',
  '保険': 'category-orange',
  'その他': 'category-default'
}

const getServiceIcon = (name) => {
  if (!name) return '⭐'
  const normalized = name.trim().toLowerCase()
  const match = Object.entries(serviceIconMap).find(([key]) => {
    const lowerKey = key.toLowerCase()
    return normalized === lowerKey || normalized.includes(lowerKey)
  })
  return match ? match[1] : '⭐'
}

const getCategoryClass = (category) => categoryClassMap[category] || 'category-default'

const calculateCancelScore = (sub) => {
  const monthlyScore = Math.min(40, Math.round((sub.monthlyPrice / 3000) * 40))
  return Math.min(
    100,
    monthlyScore + frequencyScore[sub.frequency]
  )
}

const getRecommendation = (score) => {
  if (score >= 60) return { label: '🔥 見直し優先', variant: 'high' }
  if (score >= 40) return { label: '🌤 少し見直し', variant: 'medium' }
  return { label: '🌱 継続でOK', variant: 'low' }
}

function App() {
  const [subscriptions, setSubscriptions] = useState(getInitialSubscriptions())
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    monthlyPrice: '',
    paymentDay: '',
    frequency: 'daily',
    memo: ''
  })
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [darkMode, setDarkMode] = useState(false)

  const toggleDarkMode = () => setDarkMode(prev => !prev)

  // subscriptions が変更されたら localStorage に保存
  useEffect(() => {
    try {
      localStorage.setItem('subscriptions', JSON.stringify(subscriptions))
    } catch (error) {
      console.error('localStorage write error:', error)
    }
  }, [subscriptions])

  // フォーム入力処理
  const handleInputChange = (e) => {
    const { name, value } = e.target

        if (name === 'name') {
      const preset = servicePresets[value]
      setFormData(prev => ({
        ...prev,
        name: value,
        category: preset && (!prev.category || prev.category === 'その他')
          ? preset.category
          : prev.category,
        monthlyPrice: preset && !prev.monthlyPrice
          ? String(preset.price)
          : prev.monthlyPrice
      }))
      return
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // サブスク登録
  const handleAddSubscription = (e) => {
    e.preventDefault()
    if (!formData.name || !formData.category || !formData.monthlyPrice) {
      alert('必須項目（名前、カテゴリ、月額）を入力してください')
      return
    }
    
    const newSub = {
      id: Date.now(),
      ...formData,
      monthlyPrice: parseFloat(formData.monthlyPrice)
    }
    
    setSubscriptions([...subscriptions, newSub])
    setFormData({
      name: '',
      category: '',
      monthlyPrice: '',
      paymentDay: '',
      frequency: 'daily',
      memo: ''
    })
  }

  // サブスク削除
  const handleDeleteSubscription = (id) => {
    setSubscriptions(subscriptions.filter(sub => sub.id !== id))
  }

  // サンプルデータを追加
  const handleAddSampleData = () => {
    const sampleData = [
      { name: 'Netflix', category: '動画配信', monthlyPrice: 1490, frequency: 'daily', paymentDay: '15', memo: 'シリーズ視聴' },
      { name: 'Spotify', category: '音楽', monthlyPrice: 1080, frequency: 'daily', paymentDay: '20', memo: 'プレイリスト' },
      { name: 'ChatGPT', category: 'AI', monthlyPrice: 2000, frequency: 'weekly', paymentDay: '10', memo: '仕事で使用' },
      { name: 'iCloud', category: 'クラウド', monthlyPrice: 130, frequency: 'monthly', paymentDay: '1', memo: '写真バックアップ' },
      { name: 'Amazon Prime', category: '動画配信', monthlyPrice: 600, frequency: 'weekly', paymentDay: '5', memo: '動画と配送' },
      { name: 'ジム', category: '健康・ジム', monthlyPrice: 9800, frequency: 'weekly', paymentDay: '25', memo: 'フィットネス' },
      { name: 'Canva', category: '仕事・ツール', monthlyPrice: 1100, frequency: 'weekly', paymentDay: '12', memo: 'デザイン作成' },
      { name: 'YouTube Premium', category: '音楽', monthlyPrice: 1280, frequency: 'daily', paymentDay: '18', memo: '広告なし視聴' },
      { name: 'Kindle Unlimited', category: '電子書籍', monthlyPrice: 980, frequency: 'monthly', paymentDay: '8', memo: '本読み放題' },
      { name: 'Google One', category: 'クラウド', monthlyPrice: 250, frequency: 'monthly', paymentDay: '22', memo: 'クラウド容量' }
    ]
    const newSubs = sampleData.map((sub, idx) => ({
      id: Date.now() + idx,
      ...sub
    }))
    setSubscriptions(newSubs)
    setChatMessages([])
  }

  // 全データ削除
  const handleClearAllData = () => {
    if (window.confirm('本当に全データを削除しますか？')) {
      try {
        localStorage.removeItem('subscriptions')
        setSubscriptions([])
        setChatMessages([])
      } catch (error) {
        console.error('Clear data error:', error)
      }
    }
  }

  // 統計計算
  const calculateStats = () => {
    const total = subscriptions.reduce((sum, sub) => sum + sub.monthlyPrice, 0)
    const yearly = total * 12

    const byCategory = {}
    subscriptions.forEach(sub => {
      byCategory[sub.category] = (byCategory[sub.category] || 0) + sub.monthlyPrice
    })

    const candidates = subscriptions
      .map(sub => ({
        ...sub,
        cancelScore: calculateCancelScore(sub),
        yearlySavings: Math.round(sub.monthlyPrice * 12)
      }))
      .sort((a, b) => b.cancelScore - a.cancelScore)

    const candidateCount = candidates.filter(sub => sub.cancelScore >= 60).length

    return { total, yearly, byCategory, candidates, candidateCount }
  }

  const parsePaymentDay = (value) => {
    const day = parseInt(value, 10)
    return Number.isFinite(day) && day >= 1 && day <= 31 ? day : null
  }

  const getDaysUntilNextPayment = (paymentDay) => {
    const day = parsePaymentDay(paymentDay)
    if (!day) return null

    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const clampDay = (year, month, value) => {
      const lastDay = new Date(year, month + 1, 0).getDate()
      return Math.min(value, lastDay)
    }

    const candidateDate = new Date(now.getFullYear(), now.getMonth(), clampDay(now.getFullYear(), now.getMonth(), day))
    candidateDate.setHours(0, 0, 0, 0)
    const nextDate = candidateDate < now
      ? new Date(now.getFullYear(), now.getMonth() + 1, clampDay(now.getFullYear(), now.getMonth() + 1, day))
      : candidateDate
    nextDate.setHours(0, 0, 0, 0)

    const deltaMs = nextDate.getTime() - now.getTime()
    const diffDays = Math.ceil(deltaMs / (1000 * 60 * 60 * 24))
    return diffDays >= 0 ? diffDays : null
  }

  const categoryColors = ['#60a5fa', '#34d399', '#f97316', '#a78bfa', '#f59e0b', '#ec4899']

  const getCategoryChartSections = (byCategory) => {
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
    const total = sorted.reduce((sum, [, value]) => sum + value, 0)
    let start = 0
    return sorted.map(([cat, price], index) => {
      const percentage = total ? (price / total) * 100 : 0
      const end = start + percentage
      const color = categoryColors[index % categoryColors.length]
      const segment = `${color} ${start}% ${end}%`
      start = end
      return { cat, price, percentage: Math.round(percentage), color, segment }
    })
  }

  const getUpcomingPayments = () => {
    return subscriptions
      .map((sub) => ({ sub, days: getDaysUntilNextPayment(sub.paymentDay) }))
      .filter((item) => item.days !== null && item.days <= 7)
      .sort((a, b) => a.days - b.days)
  }

  const getSavingsSimulation = () => {
    const candidates = calculateStats().candidates
      .filter((sub) => sub.cancelScore >= 60)
    return candidates.reduce((sum, item) => sum + item.yearlySavings, 0)
  }

  // AIアドバイス生成
  const generateAdvice = (userMessage) => {
    const stats = calculateStats()
    const totalMonthly = stats.total
    const normalized = userMessage.trim().toLowerCase()

    if (normalized.includes('解約候補') || normalized.includes('解約') || normalized.includes('見直し')) {
      if (stats.candidates.length > 0) {
        const top = stats.candidates[0]
        return `月額${top.monthlyPrice.toLocaleString()}円の「${top.name}」は年間${top.yearlySavings.toLocaleString()}円の支出です。使用頻度は${frequencyLabel(top.frequency)}のため、見直しおすすめは${getRecommendation(top.cancelScore).label}です。`
      }
      return '現在、見直し候補に該当するサブスクは見当たりません。'
    }

    if (normalized.includes('固定費')) {
      return `固定費として大きな割合を占めているサービスから見直すと効果的です。カテゴリ別支出を確認してみてください。`
    }

    if (normalized.includes('年間支出') || normalized.includes('年間') || normalized.includes('年額') || normalized.includes('年')) {
      return `年間の支出合計は${stats.yearly.toLocaleString()}円です。今月の支出は${totalMonthly.toLocaleString()}円です。`
    }

    if (normalized.includes('カテゴリ') || normalized.includes('カテゴリー')) {
      const categories = Object.entries(stats.byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat, price]) => `${cat} ${price.toLocaleString()}円`)
        .join('、')
      return `カテゴリ別の上位支出は ${categories} です。特に金額の大きいカテゴリから見直すと効果的です。`
    }

    if (normalized.includes('節約') || normalized.includes('高い')) {
      const candidate = stats.candidates[0]
      if (candidate && candidate.cancelScore >= 60) {
        return `節約効果が高いのは「${candidate.name}」です。年間${candidate.yearlySavings.toLocaleString()}円の節約が見込めます。`
      }
      return `月額合計は${totalMonthly.toLocaleString()}円です。使用頻度の低いサービスから見直してみましょう。`
    }

    if (normalized.includes('支払') || normalized.includes('支払い')) {
      const soonItems = subscriptions
        .map((sub) => ({ sub, days: getDaysUntilNextPayment(sub.paymentDay) }))
        .filter(item => item.days !== null && item.days <= 7)
        .sort((a, b) => a.days - b.days)
      if (soonItems.length > 0) {
        const item = soonItems[0]
        return `「${item.sub.name}」はあと${item.days}日で支払いです。まもなく支払いが来るものを確認しましょう。`
      }
      return '直近7日以内の支払い予定はありません。'
    }

    return `現在${subscriptions.length}件のサブスクが登録されています。月額合計は${totalMonthly.toLocaleString()}円です。見直し候補を確認すると気軽に節約できます。`
  }

  // チャット送信
  const handleSendChat = () => {
    if (!chatInput.trim()) return
    
    const userMsg = { type: 'user', text: chatInput }
    const aiResponse = generateAdvice(chatInput)
    const aiMsg = { type: 'ai', text: aiResponse }
    
    setChatMessages([...chatMessages, userMsg, aiMsg])
    setChatInput('')
  }

  const stats = calculateStats()
  const upcomingPayments = getUpcomingPayments()
  const savingsSimulation = getSavingsSimulation()
  const chartSections = getCategoryChartSections(stats.byCategory)
  const categoryChartBackground = chartSections.length
    ? { background: `conic-gradient(${chartSections.map((section) => section.segment).join(', ')})` }
    : {}

  const initialAIComment = subscriptions.length > 0
    ? stats.candidates.length > 0
    ? `「${stats.candidates[0].name}」は年間${stats.candidates[0].yearlySavings.toLocaleString()}円の支出です。使用頻度が${frequencyLabel(stats.candidates[0].frequency)}のため、見直しおすすめは${getRecommendation(stats.candidates[0].cancelScore).label}です。`
      : `現在登録されているサブスクは${subscriptions.length}件です。見直し候補を分析中です。`
    : ''

  return (
    <div className={`app-container ${darkMode ? 'dark-mode' : ''}`}>
      {/* ダッシュボード */}
      <div className="dashboard">
       <header className="app-header">
  <div className="app-header__brand">
    <h1 className="app-header__title">💸 やめどきAI Money</h1>
    <p className="app-header__tagline">毎月の"なんとなく払い"を、いっしょに見直しましょう。</p>
  </div>
  <button onClick={toggleDarkMode} className="app-header__mode" aria-label="表示モード切り替え">
    {darkMode ? '☀️' : '🌙'}
  </button>
</header> 

        {upcomingPayments.length > 0 && (
          <div className="upcoming-payments">
            {upcomingPayments.map((item) => (
              <div key={item.sub.id} className="upcoming-item">
                <strong>{item.days}日後</strong>に「{item.sub.name}」の支払いがあります。
              </div>
            ))}
          </div>
        )}

        {/* フォーム */}
        <div className="form-section">
          <h2>サブスクを追加する</h2>
          <form onSubmit={handleAddSubscription}>
            <div className="form-group">
              <label className="form-label">サブスク名</label>
              <input
                type="text"
                list="serviceSuggestions"
                name="name"
                placeholder="Netflix、ChatGPT、ジムなど"
                value={formData.name}
                onChange={handleInputChange}
              />
              <datalist id="serviceSuggestions">
                {Object.keys(servicePresets).map((service) => (
                  <option key={service} value={service} />
                ))}
              </datalist> 
            </div>

            <div className="form-group">
              <label className="form-label">カテゴリ</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
              >
                <option value="">カテゴリ選択</option>
                <option value="動画配信">動画配信</option>
                <option value="音楽">音楽</option>
                <option value="AI">AI</option>
                <option value="学習">学習</option>
                <option value="健康・ジム">健康・ジム</option>
                <option value="美容">美容</option>
                <option value="クラウド">クラウド</option>
                <option value="ゲーム">ゲーム</option>
                <option value="電子書籍">電子書籍</option>
                <option value="ニュース">ニュース</option>
                <option value="仕事・ツール">仕事・ツール</option>
                <option value="通信">通信</option>
                <option value="保険">保険</option>
                <option value="その他">その他</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">月額料金</label>
              <input
                type="number"
                name="monthlyPrice"
                placeholder="例：980"
                value={formData.monthlyPrice}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">支払日（任意）</label>
              <div className="form-help">支払日を入れると、支払い予定の確認に使えます</div>
              <input
                type="number"
                name="paymentDay"
                placeholder="例：15"
                max="31"
                value={formData.paymentDay}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">使用頻度</label>
              <div className="form-help">実際にどれくらい利用しているか</div>
              <select
                name="frequency"
                value={formData.frequency}
                onChange={handleInputChange}
              >
                <option value="daily">毎日使う</option>
                <option value="weekly">週に数回使う</option>
                <option value="monthly">月に数回使う</option>
                <option value="rarely">ほぼ使わない</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">メモ（任意）</label>
              <input
                type="text"
                name="memo"
                placeholder="たとえば使いどころや解約候補理由など"
                value={formData.memo}
                onChange={handleInputChange}
              />
            </div>

            <button type="submit" className="btn-primary">追加する</button>
          </form>
        </div>

        {/* 集計カード */}
        <div className="summary-cards">
          <div className="stat-box">
            <div className="stat-label">今月合計</div>
            <div className="stat-value">¥{stats.total.toLocaleString()}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">年間合計</div>
            <div className="stat-value">¥{stats.yearly.toLocaleString()}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">登録数</div>
            <div className="stat-value">{subscriptions.length}件</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">見直し候補数</div>
            <div className="stat-value">{stats.candidateCount}件</div>
          </div>
          <div className="stat-box stat-savings">
            <div className="stat-label">1年で軽くできそうな金額</div>
            <div className="stat-value">¥{savingsSimulation.toLocaleString()}</div>
          </div>
        </div>

        {/* カテゴリ別 */}
        {Object.keys(stats.byCategory).length > 0 && (
          <div className="category-section">
            <h3>カテゴリ別支出</h3>
            <div className="category-chart-block">
              <div className="category-pie" style={categoryChartBackground} />
              <div className="category-legend">
                {chartSections.map((section) => (
                  <div key={section.cat} className="category-legend-item">
                    <span className="legend-color" style={{ background: section.color }} />
                    <span>{section.cat}</span>
                    <span>¥{section.price.toLocaleString()}</span>
                    <span>{section.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 見直しおすすめ順 */}
        {stats.candidates.length > 0 && (
          <div className="candidates-section">
            <h3>見直しおすすめ順</h3>
            <div className="candidates-list">
              {stats.candidates.map((sub, idx) => (
                <div key={sub.id} className="candidate-item">
                  <div className="candidate-rank">{idx + 1}</div>
                  <div className="candidate-content">
                    <div className="name-row">
                      <div className="name">{sub.name}</div>
                      <div className={`candidate-score-badge ${getRecommendation(sub.cancelScore).variant}`}>
                        {getRecommendation(sub.cancelScore).label}
                      </div>
                    </div>
                    <div className="candidate-meta">
                      <span>{frequencyLabel(sub.frequency)}</span>
                    </div>
                    <div className="candidate-savings">
                      年間節約候補 <strong>¥{sub.yearlySavings.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 登録一覧 */}
        <div className="subscriptions-section">
          <h3>💡 登録中のサブスク ({subscriptions.length})</h3>
          <div className="subscription-grid">
            {subscriptions.map(sub => {
              const soonDays = getDaysUntilNextPayment(sub.paymentDay)
              const categoryClass = getCategoryClass(sub.category)
              const cancelScore = calculateCancelScore(sub)
              return (
                <div key={sub.id} className={`subscription-card ${categoryClass}`}>
                  <div className="subscription-card-header">
                    <div className="service-title-row">
                      <span className={`service-icon ${categoryClass}`}>{getServiceIcon(sub.name)}</span>
                      <div>
                        <div className="sub-title">{sub.name}</div>
                        <div className="sub-details">
                          {sub.paymentDay && <span className="day">{sub.paymentDay}日支払い</span>}
                          {soonDays !== null && soonDays <= 7 && (
                            <span className="payment-soon-pill">まもなく支払い</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="subscription-card-meta">
                      <span className={`tag category ${categoryClass}`}>{sub.category}</span>
                      <span className={`tag recommendation ${getRecommendation(cancelScore).variant}`}>
                        {getRecommendation(cancelScore).label}
                      </span>
                    </div>
                  </div>
                  <div className="subscription-card-body">
                    <div className="card-row">
                      <div className="card-item card-item-highlight">
                        <div className="card-label">月額</div>
                        <div className="card-value monthly">¥{sub.monthlyPrice.toLocaleString()}</div>
                      </div>
                      <div className="card-item">
                        <div className="card-label">年額</div>
                        <div className="card-value yearly">¥{(sub.monthlyPrice * 12).toLocaleString()}</div>
                      </div>
                      <div className="card-item">
                        <div className="card-label">使用頻度</div>
                        <div className="card-value frequency">{frequencyLabel(sub.frequency)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="subscription-card-footer">
                    <div className="memo-cell">{sub.memo || 'メモなし'}</div>
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteSubscription(sub.id)}
                    >
                      削除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      <div className="settings-footer">
  <button className="btn-sample" onClick={handleAddSampleData}>
    サンプルを入れる
  </button>
  <button className="btn-clear-all" onClick={handleClearAllData}>
    データをリセット
  </button>
</div> 
      </div>

      {/* AIチャット */}
      <div className="chat-section">
        <div className="chat-header">
          <h2>🤖 AI相談室</h2>
          <p className="chat-subtitle">固定費のこと、気軽に聞いてください ✨ 見直しのヒントを一緒に考えます。</p>
        </div>
        
        <div className="chat-messages">
          {chatMessages.length === 0 ? (
            subscriptions.length > 0 ? (
              <div className="chat-message ai">
                <div className="message-avatar">🤖</div>
                <div className="message-text">{initialAIComment}</div>
              </div>
            ) : (
              <div className="chat-welcome">
                <p>サブスク管理について質問してください</p>
                <ul>
                  <li>「見直し候補は？」</li>
                  <li>「節約できるところは？」</li>
                  <li>「年間支出は？」</li>
                  <li>「カテゴリ別の支出」</li>
                </ul>
              </div>
            )
          ) : (
            chatMessages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.type}`}>
                <div className="message-avatar">
                  {msg.type === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-text">{msg.text}</div>
              </div>
            ))
          )}
        </div>
        
        <div className="chat-input-area">
          <input
            type="text"
            placeholder="質問を入力..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
          />
          <button onClick={handleSendChat} className="btn-send">
            送信
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
