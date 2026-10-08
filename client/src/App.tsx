import { useEffect, useRef, useState } from 'react'
import './App.css'
import './audio-controls.css'
import { socket } from './socket'

type Screen =
  | 'home'
  | 'create'
  | 'join'
  | 'rules'
  | 'lobby'
  | 'answer'
  | 'waiting'
  | 'discussion'
  | 'voting'
  | 'voteWaiting'
  | 'voteResult'
  | 'result'

type Player = {
  id: string
  name: string
  isHost: boolean
  isConnected: boolean
}
type TopicType = 'NUMBER' | 'PLAYER'

type Topic =
  | {
      id: string
      text: string
      type: 'NUMBER'
      min: number
      max: number
    }
  | {
      id: string
      text: string
      type: 'PLAYER'
    }

type TopicSource = 'PRESET' | 'CUSTOM' | 'BOTH'
type TopicTypeFilter = 'NUMBER' | 'PLAYER' | 'BOTH'

type CustomTopicView = Topic & {
  isOwn: boolean
}

type RoomResponse = {
  ok: boolean
  message?: string
  roomCode?: string
  players?: Player[]
  discussionSeconds?: number | null
  topicSource?: TopicSource
  topicTypeFilter?: TopicTypeFilter
  showCustomTopics?: boolean
  customTopics?: CustomTopicView[]
  customTopicCount?: number
}

type ActionResponse = {
  ok: boolean
  message?: string
}

type Role = 'CITIZEN' | 'WEREWOLF'
type AnswerMode = 'NUMBER' | 'OVER_MAX' | 'PLAYER'
type ResultStage = 'ANNOUNCE' | 'EXECUTED' | 'ROLE'

type BgmTrackId = 'NONE' | 'SHIMA' | 'BGM1'

type BgmTrack = {
  id: BgmTrackId
  label: string
  path: string | null
  baseVolume: number
}

const BGM_TRACKS: BgmTrack[] = [
  { id: 'NONE', label: 'BGMなし', path: null, baseVolume: 1 },
  {
    id: 'BGM1',
    label: 'BGM1',
    path: '/sounds/bgm/bgm1.mp3',
    baseVolume: 1,
  },
  {
    id: 'SHIMA',
    label: 'しーま',
    path: '/sounds/bgm/shima.mp3',
    baseVolume: 0.9,
  },
]

const PLAYABLE_BGM_TRACKS = BGM_TRACKS.filter(
  (track): track is BgmTrack & { path: string } => track.path !== null,
)

const SHIMA_LYRICS = `[Hook]
しーま　またLINE返さない
しーま　記念日覚えてない
しーま　迎え行っても起きてない
「今行く」って悪びれてない

しーま　触れたら火傷じゃない？
しーま　恋なら自然消滅
しーま　八王子のカシラ
最寄りは山田　夜なら終わらない

[Verse 1A]
朝に弱い　待ち合わせにもいない
迎えに行ってもまだ起きてない
「あと5分」がまた30分
しーまの時計だけ違う時刻

LINE返さない　既読もつかない
ついたと思えば今度は返さない
記念日なんて覚えちゃいない
でもタバコの銘柄は間違えない

[Verse 1B]
ピースライト 　口にくわえ　火をつける
IQOS　lil HYBRID　Bling-Bling　めじるしだらけ
煙だけ残して夜に消える　巻くのは女とタバコだけ

ラップ上等　元カノちかこでもラブ上等
調布駅　終電前　
人であふれたホームでディープキス
狙いすました第三の証言

[Verse 1C]
昨日の約束　今日には知らない
恋なら熱いが冷めるのも早い
自然消滅　得意のフェード
追われてるうちがしーまのペース

酒が入ったら調子が上がる
夜がふかくなるほど声も上がる
グラスがあけばまた次を注ぐ
夜を使い果たして　騒ぐ八王子

[Verse 1D]
one pac, two pac, three pac, four
一本　二本　飲み干す bottle
からになるたび瓶を掲げる
頭の上で逆さにして見せる

南のドルフィンに溺れ
八王子南口　寒い中熱い夜は続いて
雪が積もる中やらかし
LINEはけ消しとけよ言ったのにな

[Verse 1E]
超高速道路乗った whip
山田に戻る頃には midnight
気づけば外には朝の光
昨日の予定なんてもう知らない

朝起きれないのに今夜は all night
明日の集合？　まあなんとかなる
「あと5分」ってまた言うだろ
それでも今日も悪びれない顔

[Hook]
しーま　またLINE返さない
しーま　記念日覚えてない
しーま　迎え行っても起きてない
「今行く」って悪びれてない

しーま　触れたら火傷じゃない？
しーま　恋なら自然消滅
しーま　八王子のカシラ
最寄りは山田　夜なら終わらない

[Verse 2A]
南平高校　卒業
ここはノーチャイム　それが日常
校門入ったその先に待つ
見上げるくらいクソ長い階段

毎朝登って鍛えたはずが
海とフットサルで　両足がつる
「余裕だし」ってまだ強がる
おやじに心配されてやがる

[Verse 2B]
街から国へ　八王子の中
山田がホーム　真夜中 drive
遅刻はするし朝には弱い
でも夜になったら誰よりも長い男

家の近くには磯沼ファーム
窓開けた瞬間　漂うフレーバー
八王子の風に乗ってくる匂い
しーまは今日も気にせず素通り

[Verse 2C]
八王子生まれ
HIP HOP育ち
悪ノリするやつ
だいたい友達

すぐる曰く八王子のカシラ
レペゼン　ユーロード
これがしーまイズム

[Verse 3A]
八王子の南口　甘い甘い、ミルク＆ハニー
帰って寝たなら昼まで起きない
夏になったら行きたいサマラン
しーまが愛するサマーランド

波のプール　ウォータースライダー
そこじゃ誰よりはしゃぐ八王子のかしら
ヤバくなれるのは、しーま　
「濡れたまんまでイッちゃって！！」

[Verse 3B]
Peace Light　煙が揺れてる
窓の外　街灯が流れてる
boom boom　うなるベースが癖になる
低音で震える夜の八王子

山田　八王子　ナンペイ
場所が変わっても変わらないペース
女に追われても返事はない
仲間に呼ばれりゃまた夜に出たい

[Bridge]
ナンペイ
ノーチャイム
クソ長い階段

山田
八王子
八王子のカシラ

Peace Light
IQOS
lil HYBRID

調布に伝説
南のドルフィン

人間発電所
夜だけ稼働
寝坊
遅刻
既読は放置

家の近く
磯沼ファーム
風向き次第で
今日もくさい

しーま
全部まとめて
しーま

[Final Hook]
しーま　またLINE返さない
しーま　記念日覚えてない
しーま　迎え行っても起きてない
「今行く」って今日もまだ来ない

しーま　触れたら火傷じゃない？
しーま　恋なら自然消滅
しーま　八王子のカシラ
最寄りは山田　夜なら終わらない

しーま
しーま
みなみだいらから山田
しーま
しーま
山田から八王子

女は忘れる
記念日忘れる
LINEも忘れる
待ち合わせも忘れる

夜ならドルフィン
朝なら寝てる
夏ならサマラン
それでもカシラ

しーま
今日も変わらない

八王子
山田
しーま`

type Answer =
  | {
      type: 'NUMBER'
      value: number
    }
  | {
      type: 'OVER_MAX'
      value: null
    }
  | {
      type: 'PLAYER'
      value: string
    }
  | {
      type: 'TIMEOUT'
      value: null
    }

type RevealedAnswer = {
  playerId: string
  playerName: string
  answer: Answer
}

type VoteCount = {
  playerId: string
  playerName: string
  votes: number
  voters: string[]
}

type GameResult = {
  executedPlayer: {
    id: string
    name: string
  }
  executedRole: Role
  werewolf: {
    id: string
    name: string
  }
  winner: Role
  voteCounts: VoteCount[]
}

type ReconnectResponse = RoomResponse & {
  phase?: string
  role?: Role
  topic?: string | null
  topicType?: TopicType
  min?: number | null
  max?: number | null
  answerOptions?: string[]
  answerEndsAt?: number | null
  hasAnswered?: boolean
  answerDraft?: Answer | null
  answeredCount?: number
  totalCount?: number
  answers?: RevealedAnswer[]
  discussionEndsAt?: number | null
  skipCount?: number
  skipRequiredCount?: number
  hasSkipped?: boolean
  voteCandidates?: Player[]
  hasVoted?: boolean
  voteDraft?: string | null
  votedCount?: number
  voteTotalCount?: number
  isRevote?: boolean
  voteEndsAt?: number | null
  gameResult?: GameResult
}

function getOrCreatePlayerToken() {
  let token = sessionStorage.getItem('numberWerewolfPlayerToken')

  if (!token) {
    token = crypto.randomUUID()
    sessionStorage.setItem('numberWerewolfPlayerToken', token)
  }

  return token
}

function createFreshPlayerToken() {
  const token = crypto.randomUUID()

  sessionStorage.setItem('numberWerewolfPlayerToken', token)

  return token
}

const SOUND_VOLUME_KEY = 'numberWerewolfSoundVolume'
const LEGACY_SOUND_SETTING_KEY = 'numberWerewolfSoundEnabled'
const DEFAULT_SOUND_VOLUME = 70

function getSoundVolume() {
  const savedVolume = localStorage.getItem(SOUND_VOLUME_KEY)

  if (savedVolume === null) {
    return localStorage.getItem(LEGACY_SOUND_SETTING_KEY) === 'off'
      ? 0
      : DEFAULT_SOUND_VOLUME
  }

  const parsedVolume = Number(savedVolume)

  if (!Number.isFinite(parsedVolume)) {
    return DEFAULT_SOUND_VOLUME
  }

  return Math.min(100, Math.max(0, parsedVolume))
}

const BGM_VOLUME_KEY = 'numberWerewolfBgmVolume'
const BGM_TRACK_KEY = 'numberWerewolfBgmTrack'
const DEFAULT_BGM_VOLUME = 35

function getBgmVolume() {
  const savedValue = localStorage.getItem(BGM_VOLUME_KEY)

  if (savedValue === null) {
    return DEFAULT_BGM_VOLUME
  }

  const savedVolume = Number(savedValue)

  if (!Number.isFinite(savedVolume)) {
    return DEFAULT_BGM_VOLUME
  }

  return Math.min(100, Math.max(0, savedVolume))
}

function getBgmTrack(): BgmTrackId {
  return 'BGM1'
}

function playSound(path: string, baseVolume = 0.6) {
  const masterVolume = getSoundVolume() / 100

  if (masterVolume <= 0) {
    return
  }

  const audio = new Audio(path)
  audio.volume = Math.min(1, Math.max(0, baseVolume * masterVolume))

  void audio.play().catch(() => {
    // ブラウザの自動再生制限などで失敗してもゲームは続行する
  })
}

function ErrorMessage({ message }: { message: string }) {
  if (!message) {
    return null
  }

  return (
    <div className="error-message" role="alert">
      {message}
    </div>
  )
}

function App() {
  // セッション・画面
  const [playerToken, setPlayerToken] = useState(() => getOrCreatePlayerToken())
  const [screen, setScreen] = useState<Screen>('home')
  const [error, setError] = useState('')
  const [soundVolume, setSoundVolume] = useState(() => getSoundVolume())
  const [bgmVolume, setBgmVolume] = useState(() => getBgmVolume())
  const [selectedBgm, setSelectedBgm] = useState<BgmTrackId>(() => getBgmTrack())
  const [playingBgm, setPlayingBgm] = useState<BgmTrackId | null>(null)
  const [showLyrics, setShowLyrics] = useState(false)
  const bgmContextRef = useRef<AudioContext | null>(null)
  const bgmGainRef = useRef<GainNode | null>(null)
  const bgmBuffersRef = useRef<Map<BgmTrackId, AudioBuffer>>(new Map())
  const bgmSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const bgmCurrentTrackRef = useRef<BgmTrackId | null>(null)
  const bgmIsPlayingRef = useRef(false)
  const bgmShouldPlayRef = useRef(false)
  const bgmGenerationRef = useRef(0)

  // プレイヤー・ルーム
  const [username, setUsername] = useState('')
  const [joinRoomCode, setJoinRoomCode] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [roomCodeCopied, setRoomCodeCopied] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])

  // お題・役職・回答
  const [role, setRole] = useState<Role | null>(null)
  const [topic, setTopic] = useState<string | null>(null)
  const [currentTopicType, setCurrentTopicType] = useState<TopicType>('NUMBER')
  const [min, setMin] = useState(0)
  const [max, setMax] = useState(0)
  const [answerOptions, setAnswerOptions] = useState<string[]>([])
  const [answerValue, setAnswerValue] = useState('')
  const [answerMode, setAnswerMode] = useState<AnswerMode>('NUMBER')
  const [answeredCount, setAnsweredCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [answerEndsAt, setAnswerEndsAt] = useState<number | null>(null)
  const [remainingAnswerSeconds, setRemainingAnswerSeconds] = useState(0)
  const [revealedAnswers, setRevealedAnswers] = useState<RevealedAnswer[]>([])

  // ゲーム設定・カスタムお題
  const [discussionSeconds, setDiscussionSeconds] = useState<number | null>(180)
  const [topicSource, setTopicSource] = useState<TopicSource>('PRESET')
  const [topicTypeFilter, setTopicTypeFilter] =
    useState<TopicTypeFilter>('BOTH')
  const [showCustomTopics, setShowCustomTopics] = useState(false)
  const [customTopics, setCustomTopics] = useState<CustomTopicView[]>([])
  const [customTopicCount, setCustomTopicCount] = useState(0)
  const [customTopicType, setCustomTopicType] = useState<TopicType>('NUMBER')
  const [customTopicText, setCustomTopicText] = useState('')
  const [customTopicMin, setCustomTopicMin] = useState('0')
  const [customTopicMax, setCustomTopicMax] = useState('100')

  // 話し合い
  const [discussionEndsAt, setDiscussionEndsAt] = useState<number | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [skipCount, setSkipCount] = useState(0)
  const [skipRequiredCount, setSkipRequiredCount] = useState(0)
  const [hasSkipped, setHasSkipped] = useState(false)
  const [showSkipNotice, setShowSkipNotice] = useState(false)

  // 投票・結果
  const [voteCandidates, setVoteCandidates] = useState<Player[]>([])
  const [selectedVote, setSelectedVote] = useState('')
  const [votedCount, setVotedCount] = useState(0)
  const [voteTotalCount, setVoteTotalCount] = useState(0)
  const [voteEndsAt, setVoteEndsAt] = useState<number | null>(null)
  const [remainingVoteSeconds, setRemainingVoteSeconds] = useState(0)
  const [isRevote, setIsRevote] = useState(false)
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [resultStage, setResultStage] = useState<ResultStage>('ANNOUNCE')

  function getSelectedBgm(trackId = selectedBgm) {
    return BGM_TRACKS.find((track) => track.id === trackId) ?? BGM_TRACKS[0]
  }

  function getOrCreateBgmContext() {
    if (!bgmContextRef.current) {
      const context = new AudioContext()
      const gain = context.createGain()

      gain.connect(context.destination)

      bgmContextRef.current = context
      bgmGainRef.current = gain
    }

    return bgmContextRef.current
  }

  async function loadBgmBuffer(trackId: BgmTrackId) {
    const cachedBuffer = bgmBuffersRef.current.get(trackId)

    if (cachedBuffer) {
      return cachedBuffer
    }

    const track = getSelectedBgm(trackId)

    if (!track.path) {
      return null
    }

    const context = getOrCreateBgmContext()
    const response = await fetch(track.path)

    if (!response.ok) {
      throw new Error(`BGMの読み込みに失敗しました: ${track.path}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await context.decodeAudioData(arrayBuffer)

    bgmBuffersRef.current.set(trackId, audioBuffer)

    return audioBuffer
  }

  function updateBgmAudioVolume(volume = bgmVolume) {
    const gain = bgmGainRef.current

    if (!gain) {
      return
    }

    const currentTrackId = bgmCurrentTrackRef.current ?? selectedBgm
    const track = getSelectedBgm(currentTrackId)
    const nextVolume = Math.min(
      1,
      Math.max(0, track.baseVolume * (volume / 100)),
    )

    gain.gain.setValueAtTime(nextVolume, gain.context.currentTime)
  }

  function stopCurrentBgmSource() {
    const source = bgmSourceRef.current

    if (!source) {
      return
    }

    source.onended = null

    try {
      source.stop()
    } catch {
      // すでに停止済みでもゲームは続行する
    }

    source.disconnect()
    bgmSourceRef.current = null
  }

  function stopBgmAndReset() {
    bgmGenerationRef.current += 1
    bgmShouldPlayRef.current = false
    bgmIsPlayingRef.current = false
    bgmCurrentTrackRef.current = null
    setPlayingBgm(null)
    setShowLyrics(false)
    stopCurrentBgmSource()
  }

  function getNextBgmTrackId(currentTrackId: BgmTrackId) {
    if (PLAYABLE_BGM_TRACKS.length === 0) {
      return null
    }

    const currentIndex = PLAYABLE_BGM_TRACKS.findIndex(
      (track) => track.id === currentTrackId,
    )

    if (currentIndex === -1) {
      return PLAYABLE_BGM_TRACKS[0].id
    }

    const nextIndex = (currentIndex + 1) % PLAYABLE_BGM_TRACKS.length
    return PLAYABLE_BGM_TRACKS[nextIndex].id
  }

  async function playBgmTrack(
    trackId: BgmTrackId,
    generation: number,
  ): Promise<void> {
    if (!bgmShouldPlayRef.current || generation !== bgmGenerationRef.current) {
      return
    }

    const track = getSelectedBgm(trackId)

    if (!track.path) {
      stopBgmAndReset()
      return
    }

    try {
      const context = getOrCreateBgmContext()

      if (context.state !== 'running') {
        await context.resume()
      }

      const audioBuffer = await loadBgmBuffer(trackId)

      if (
        !audioBuffer ||
        !bgmShouldPlayRef.current ||
        generation !== bgmGenerationRef.current
      ) {
        return
      }

      stopCurrentBgmSource()

      const source = context.createBufferSource()
      const gain = bgmGainRef.current

      if (!gain) {
        return
      }

      source.buffer = audioBuffer
      source.connect(gain)

      bgmSourceRef.current = source
      bgmCurrentTrackRef.current = trackId
      bgmIsPlayingRef.current = true
      setPlayingBgm(trackId)
      setShowLyrics((current) => (trackId === 'SHIMA' ? current : false))
      updateBgmAudioVolume(getBgmVolume())

      source.onended = () => {
        if (
          source !== bgmSourceRef.current ||
          !bgmShouldPlayRef.current ||
          generation !== bgmGenerationRef.current
        ) {
          return
        }

        bgmSourceRef.current = null

        const nextTrackId = getNextBgmTrackId(trackId)

        if (!nextTrackId) {
          bgmIsPlayingRef.current = false
          bgmCurrentTrackRef.current = null
          setPlayingBgm(null)
          setShowLyrics(false)
          return
        }

        void playBgmTrack(nextTrackId, generation)
      }

      source.start(0)
    } catch (error) {
      console.warn('BGMの再生に失敗しました:', error)
      bgmIsPlayingRef.current = false
      setPlayingBgm(null)
      setShowLyrics(false)
    }
  }

  function startBgmFromBeginning(trackId = selectedBgm) {
    const track = getSelectedBgm(trackId)

    if (!track.path) {
      stopBgmAndReset()
      return
    }

    stopCurrentBgmSource()

    bgmGenerationRef.current += 1
    const generation = bgmGenerationRef.current

    bgmShouldPlayRef.current = true
    bgmCurrentTrackRef.current = trackId

    void playBgmTrack(trackId, generation)
  }

  // Socket.IOイベント
  useEffect(() => {
    const handleConnect = () => {
      console.log('サーバーに接続しました:', socket.id)
    }

    const handleRoomUpdated = (data: { players: Player[] }) => {
      setPlayers(data.players)
    }

    const handleVoteCandidatesUpdated = (data: { candidates: Player[] }) => {
      setVoteCandidates(data.candidates)
    }

    const handleSettingsUpdated = (data: {
      discussionSeconds: number | null
      topicSource: TopicSource
      topicTypeFilter: TopicTypeFilter
      showCustomTopics: boolean
    }) => {
      setDiscussionSeconds(data.discussionSeconds)
      setTopicSource(data.topicSource)
      setTopicTypeFilter(data.topicTypeFilter)
      setShowCustomTopics(data.showCustomTopics)
    }

    const handleCustomTopicsUpdated = (data: {
      customTopics: CustomTopicView[]
      customTopicCount: number
    }) => {
      setCustomTopics(data.customTopics)
      setCustomTopicCount(data.customTopicCount)
    }

    const handleDraftStateUpdated = (data: {
      answerDraft: Answer | null
      voteDraft: string | null
    }) => {
      if (data.answerDraft?.type === 'OVER_MAX') {
        setAnswerMode('OVER_MAX')
        setAnswerValue('')
      } else if (data.answerDraft?.type === 'NUMBER') {
        setAnswerMode('NUMBER')
        setAnswerValue(String(data.answerDraft.value))
      } else if (data.answerDraft?.type === 'PLAYER') {
        setAnswerMode('PLAYER')
        setAnswerValue(data.answerDraft.value)
      }

      setSelectedVote(data.voteDraft ?? '')
    }

    const handleGameStarted = (data: {
      role: Role
      topic: string | null
      topicType: TopicType
      min: number | null
      max: number | null
      answerOptions: string[]
      answerEndsAt: number | null
    }) => {
      setRole(data.role)
      setTopic(data.topic)
      setCurrentTopicType(data.topicType)
      setMin(data.min ?? 0)
      setMax(data.max ?? 0)
      setAnswerOptions(data.answerOptions)
      setAnswerEndsAt(data.answerEndsAt)
      setAnswerValue('')
      setAnswerMode(data.topicType === 'PLAYER' ? 'PLAYER' : 'NUMBER')
      setAnsweredCount(0)
      setGameResult(null)
      setError('')
      stopBgmAndReset()
      playSound('/sounds/start.mp3', 0.69)
      setScreen('answer')
    }

    const handleAnswerProgress = (data: {
      answeredCount: number
      totalCount: number
    }) => {
      setAnsweredCount(data.answeredCount)
      setTotalCount(data.totalCount)
    }

    const handleAnswerReveal = (data: {
      topic: string
      topicType: TopicType
      min: number | null
      max: number | null
      answerEndsAt?: number | null
      answers: RevealedAnswer[]
      discussionEndsAt: number | null
      skipCount: number
      skipRequiredCount: number
    }) => {
      setTopic(data.topic)
      setCurrentTopicType(data.topicType)
      setMin(data.min ?? 0)
      setMax(data.max ?? 0)
      setAnswerEndsAt(null)
      setRemainingAnswerSeconds(0)
      setRevealedAnswers(data.answers)
      setDiscussionEndsAt(data.discussionEndsAt)
      setSkipCount(data.skipCount)
      setSkipRequiredCount(data.skipRequiredCount)
      setHasSkipped(false)
      playSound('/sounds/reveal.mp3', 0.58)
      setScreen('discussion')
    }

    const handleDiscussionSkipUpdated = (data: {
      skipCount: number
      skipRequiredCount: number
    }) => {
      setSkipCount(data.skipCount)
      setSkipRequiredCount(data.skipRequiredCount)
    }

    const handleVotingStarted = (data: {
      players: Player[]
      voteEndsAt: number | null
      wasSkipped: boolean
    }) => {
      setVoteCandidates(data.players)
      setSelectedVote('')
      setVotedCount(0)
      setVoteTotalCount(data.players.length)
      setVoteEndsAt(data.voteEndsAt)
      setSkipCount(0)
      setSkipRequiredCount(0)
      setHasSkipped(false)
      setShowSkipNotice(data.wasSkipped)
      setIsRevote(false)
      setError('')
      playSound('/sounds/vote.mp3', 0.82)
      setScreen('voting')
    }

    const handleVoteProgress = (data: {
      votedCount: number
      totalCount: number
    }) => {
      setVotedCount(data.votedCount)
      setVoteTotalCount(data.totalCount)
    }

    const handleRevoteStarted = (data: {
      candidates: Player[]
      voteEndsAt: number | null
      totalCount: number
    }) => {
      setVoteCandidates(data.candidates)
      setSelectedVote('')
      setVotedCount(0)
      setVoteTotalCount(data.totalCount)
      setVoteEndsAt(data.voteEndsAt)
      setShowSkipNotice(false)
      setIsRevote(true)
      setError('')
      playSound('/sounds/vote.mp3', 0.82)
      setScreen('voting')
    }

    const handleGameResult = (data: GameResult) => {
      setVoteEndsAt(null)
      setRemainingVoteSeconds(0)
      setGameResult(data)
      setResultStage('ANNOUNCE')
      setScreen('voteResult')
    }

    const handleBackToLobby = (data: {
      players: Player[]
      discussionSeconds: number | null
    }) => {
      setPlayers(data.players)
      setDiscussionSeconds(data.discussionSeconds)
      setRole(null)
      setTopic(null)
      setCurrentTopicType('NUMBER')
      setMin(0)
      setMax(0)
      setAnswerOptions([])
      setAnswerEndsAt(null)
      setRemainingAnswerSeconds(0)
      setAnswerValue('')
      setAnsweredCount(0)
      setTotalCount(0)
      setRevealedAnswers([])
      setDiscussionEndsAt(null)
      setRemainingSeconds(0)
      setVoteCandidates([])
      setSelectedVote('')
      setVotedCount(0)
      setVoteTotalCount(0)
      setVoteEndsAt(null)
      setRemainingVoteSeconds(0)
      setSkipCount(0)
      setSkipRequiredCount(0)
      setHasSkipped(false)
      setIsRevote(false)
      setGameResult(null)
      setResultStage('ANNOUNCE')
      setError('')
      setScreen('lobby')
    }

    const handleKickedFromRoom = () => {
      window.alert('ホストによってルームから退出されました')

      stopBgmAndReset()
      sessionStorage.removeItem('numberWerewolfRoomCode')

      setRoomCode('')
      setPlayers([])
      setRole(null)
      setTopic(null)
      setCustomTopics([])
      setCustomTopicCount(0)
      setError('')
      setScreen('home')
    }

    const handleRoomDisbanded = () => {
      window.alert('ホストが部屋を解散しました')

      stopBgmAndReset()
      sessionStorage.removeItem('numberWerewolfRoomCode')

      setRoomCode('')
      setPlayers([])
      setRole(null)
      setTopic(null)
      setCustomTopics([])
      setCustomTopicCount(0)
      setError('')
      setScreen('home')
    }

    socket.on('kickedFromRoom', handleKickedFromRoom)

    socket.on('connect', handleConnect)

    socket.on('roomUpdated', handleRoomUpdated)

    socket.on('voteCandidatesUpdated', handleVoteCandidatesUpdated)

    socket.on('settingsUpdated', handleSettingsUpdated)

    socket.on('gameStarted', handleGameStarted)

    socket.on('answerProgress', handleAnswerProgress)

    socket.on('answerReveal', handleAnswerReveal)

    socket.on('discussionSkipUpdated', handleDiscussionSkipUpdated)

    socket.on('votingStarted', handleVotingStarted)

    socket.on('voteProgress', handleVoteProgress)

    socket.on('revoteStarted', handleRevoteStarted)

    socket.on('gameResult', handleGameResult)

    socket.on('backToLobby', handleBackToLobby)

    socket.on('roomDisbanded', handleRoomDisbanded)

    socket.on('customTopicsUpdated', handleCustomTopicsUpdated)

    socket.on('draftStateUpdated', handleDraftStateUpdated)

    return () => {
      socket.off('kickedFromRoom', handleKickedFromRoom)

      socket.off('connect', handleConnect)

      socket.off('roomUpdated', handleRoomUpdated)

      socket.off('voteCandidatesUpdated', handleVoteCandidatesUpdated)

      socket.off('settingsUpdated', handleSettingsUpdated)

      socket.off('gameStarted', handleGameStarted)

      socket.off('answerProgress', handleAnswerProgress)

      socket.off('answerReveal', handleAnswerReveal)

      socket.off('discussionSkipUpdated', handleDiscussionSkipUpdated)

      socket.off('votingStarted', handleVotingStarted)

      socket.off('voteProgress', handleVoteProgress)

      socket.off('revoteStarted', handleRevoteStarted)

      socket.off('gameResult', handleGameResult)

      socket.off('backToLobby', handleBackToLobby)

      socket.off('roomDisbanded', handleRoomDisbanded)

      socket.off('customTopicsUpdated', handleCustomTopicsUpdated)

      socket.off('draftStateUpdated', handleDraftStateUpdated)
    }
  }, [])

  // 再接続
  useEffect(() => {
    function reconnectToRoom() {
      const savedRoomCode = sessionStorage.getItem('numberWerewolfRoomCode')

      if (!savedRoomCode) {
        return
      }

      socket.emit(
        'reconnectRoom',
        {
          roomCode: savedRoomCode,
          playerToken,
        },
        (response: ReconnectResponse) => {
          if (!response.ok) {
            console.warn('ルームへの再接続に失敗しました:', response.message)
            return
          }

          setRoomCode(response.roomCode ?? '')
          setPlayers(response.players ?? [])
          setDiscussionSeconds(
            response.discussionSeconds === undefined
              ? 180
              : response.discussionSeconds,
          )

          setTopicSource(response.topicSource ?? 'PRESET')
          setTopicTypeFilter(response.topicTypeFilter ?? 'BOTH')
          setShowCustomTopics(response.showCustomTopics ?? false)
          setCustomTopics(response.customTopics ?? [])
          setCustomTopicCount(response.customTopicCount ?? 0)

          if (response.phase === 'LOBBY') {
            setScreen('lobby')
          }

          if (response.phase === 'ANSWERING') {
            setRole(response.role ?? null)
            setTopic(response.topic ?? null)
            setCurrentTopicType(response.topicType ?? 'NUMBER')
            setMin(response.min ?? 0)
            setMax(response.max ?? 0)
            setAnswerOptions(response.answerOptions ?? [])
            setAnswerEndsAt(response.answerEndsAt ?? null)
            setAnsweredCount(response.answeredCount ?? 0)
            setTotalCount(response.totalCount ?? 0)

            if (!response.hasAnswered) {
              if (response.answerDraft?.type === 'OVER_MAX') {
                setAnswerMode('OVER_MAX')
                setAnswerValue('')
              } else if (response.answerDraft?.type === 'NUMBER') {
                setAnswerMode('NUMBER')
                setAnswerValue(String(response.answerDraft.value))
              } else if (response.answerDraft?.type === 'PLAYER') {
                setAnswerMode('PLAYER')
                setAnswerValue(response.answerDraft.value)
              } else {
                setAnswerMode(
                  response.topicType === 'PLAYER' ? 'PLAYER' : 'NUMBER',
                )
                setAnswerValue('')
              }
            }

            if (response.hasAnswered) {
              setScreen('waiting')
            } else {
              setScreen('answer')
            }
          }

          if (response.phase === 'DISCUSSION') {
            setTopic(response.topic ?? null)
            setCurrentTopicType(response.topicType ?? 'NUMBER')
            setMin(response.min ?? 0)
            setMax(response.max ?? 0)
            setAnswerOptions([])
            setRevealedAnswers(response.answers ?? [])
            setDiscussionEndsAt(response.discussionEndsAt ?? null)
            setSkipCount(response.skipCount ?? 0)
            setSkipRequiredCount(response.skipRequiredCount ?? 0)
            setHasSkipped(response.hasSkipped ?? false)
            setScreen('discussion')
          }

          if (response.phase === 'VOTING' || response.phase === 'REVOTING') {
            setVoteCandidates(response.voteCandidates ?? [])
            setSelectedVote(response.voteDraft ?? '')
            setVotedCount(response.votedCount ?? 0)
            setVoteTotalCount(response.voteTotalCount ?? 0)
            setIsRevote(response.isRevote ?? false)
            setVoteEndsAt(response.voteEndsAt ?? null)
            setError('')

            if (response.hasVoted) {
              setScreen('voteWaiting')
            } else {
              setScreen('voting')
            }
          }

          if (response.phase === 'RESULT') {
            if (response.gameResult) {
              setGameResult(response.gameResult)
              setScreen('result')
            }
          }
        },
      )
    }

    socket.on('connect', reconnectToRoom)

    if (socket.connected) {
      reconnectToRoom()
    }

    return () => {
      socket.off('connect', reconnectToRoom)
    }
  }, [playerToken])

  // 投票結果の演出
  useEffect(() => {
    if (screen !== 'voteResult' || !gameResult) {
      return
    }

    const delay =
      resultStage === 'ANNOUNCE'
        ? 4000
        : resultStage === 'EXECUTED'
          ? 5000
          : 10000

    const timer = window.setTimeout(() => {
      if (resultStage === 'ANNOUNCE') {
        setResultStage('EXECUTED')
        return
      }

      if (resultStage === 'EXECUTED') {
        setResultStage('ROLE')
        return
      }

      setScreen('result')
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [screen, resultStage, gameResult])

  // 投票結果の効果音
  useEffect(() => {
    if (screen !== 'voteResult' || !gameResult) {
      return
    }

    if (resultStage === 'EXECUTED') {
      const timer = window.setTimeout(() => {
        playSound('/sounds/result.mp3', 0.63)
      }, 580)

      return () => {
        window.clearTimeout(timer)
      }
    }

    if (resultStage === 'ROLE') {
      const timer = window.setTimeout(() => {
        const isWerewolf = gameResult.executedRole === 'WEREWOLF'

        const roleSound = isWerewolf
          ? '/sounds/role-werewolf.mp3'
          : '/sounds/role-citizen.mp3'

        const roleVolume = isWerewolf ? 0.63 : 0.68

        playSound(roleSound, roleVolume)
      }, 4800)

      return () => {
        window.clearTimeout(timer)
      }
    }
  }, [screen, resultStage, gameResult])

  // 結果画面に入ったら、選択中のBGMを頭から再生
  useEffect(() => {
    if (screen !== 'result') {
      return
    }

    startBgmFromBeginning()
  }, [screen])

  // BGM音量をリアルタイム反映
  useEffect(() => {
    updateBgmAudioVolume()
  }, [bgmVolume])

  // 画面を閉じたときにBGMを停止
  useEffect(() => {
    return () => {
      stopCurrentBgmSource()
      void bgmContextRef.current?.close()
    }
  }, [])

  // 回答タイマー
  useEffect(() => {
    if (!answerEndsAt) {
      setRemainingAnswerSeconds(0)
      return
    }

    function updateAnswerTimer() {
      const remaining = Math.max(
        0,
        Math.ceil((answerEndsAt! - Date.now()) / 1000),
      )

      setRemainingAnswerSeconds(remaining)
    }

    updateAnswerTimer()

    const timer = window.setInterval(updateAnswerTimer, 250)

    return () => {
      window.clearInterval(timer)
    }
  }, [answerEndsAt])

  // 話し合いタイマー
  useEffect(() => {
    if (!discussionEndsAt) {
      setRemainingSeconds(0)
      return
    }

    function updateTimer() {
      const remaining = Math.max(
        0,
        Math.ceil((discussionEndsAt! - Date.now()) / 1000),
      )

      setRemainingSeconds(remaining)
    }

    updateTimer()

    const timer = window.setInterval(updateTimer, 250)

    return () => {
      window.clearInterval(timer)
    }
  }, [discussionEndsAt])

  // 投票タイマー
  useEffect(() => {
    if (!voteEndsAt) {
      setRemainingVoteSeconds(0)
      return
    }

    function updateVoteTimer() {
      const remaining = Math.max(
        0,
        Math.ceil((voteEndsAt! - Date.now()) / 1000),
      )

      setRemainingVoteSeconds(remaining)
    }

    updateVoteTimer()

    const timer = window.setInterval(updateVoteTimer, 250)

    return () => {
      window.clearInterval(timer)
    }
  }, [voteEndsAt])

  const currentPlayer = players.find((player) => player.id === socket.id)

  const isHost = currentPlayer?.isHost ?? false

  const executedVoteCount =
    gameResult?.voteCounts.find(
      (item) => item.playerId === gameResult.executedPlayer.id,
    )?.votes ?? 0

  // -------------------------
  // ユーザー操作
  // -------------------------

  function handleSoundVolumeChange(value: string) {
    const parsedVolume = Number(value)
    const nextVolume = Number.isFinite(parsedVolume)
      ? Math.min(100, Math.max(0, parsedVolume))
      : DEFAULT_SOUND_VOLUME

    setSoundVolume(nextVolume)
    localStorage.setItem(SOUND_VOLUME_KEY, String(nextVolume))
  }

  function handleBgmVolumeChange(value: string) {
    const parsedVolume = Number(value)
    const nextVolume = Number.isFinite(parsedVolume)
      ? Math.min(100, Math.max(0, parsedVolume))
      : DEFAULT_BGM_VOLUME

    setBgmVolume(nextVolume)
    localStorage.setItem(BGM_VOLUME_KEY, String(nextVolume))

    updateBgmAudioVolume(nextVolume)
  }

  function handleBgmTrackChange(value: string) {
    const nextTrack = value as BgmTrackId

    if (!BGM_TRACKS.some((track) => track.id === nextTrack)) {
      return
    }

    setSelectedBgm(nextTrack)
    localStorage.setItem(BGM_TRACK_KEY, nextTrack)

    const shouldPlayBgm = ['create', 'join', 'lobby', 'result'].includes(screen)

    if (nextTrack === 'NONE') {
      stopBgmAndReset()
    } else if (bgmIsPlayingRef.current || shouldPlayBgm) {
      startBgmFromBeginning(nextTrack)
    }
  }

  function handleEnterCreateScreen() {
    setError('')
    startBgmFromBeginning()
    setScreen('create')
  }

  function handleEnterJoinScreen() {
    setError('')
    startBgmFromBeginning()
    setScreen('join')
  }

  function handleBackToHome() {
    setError('')
    stopBgmAndReset()
    setScreen('home')
  }

  function handleCreateRoom() {
    setError('')

    const newPlayerToken = createFreshPlayerToken()

    setPlayerToken(newPlayerToken)
    sessionStorage.removeItem('numberWerewolfRoomCode')

    socket.emit(
      'createRoom',
      {
        username,
        playerToken: newPlayerToken,
      },
      (response: RoomResponse) => {
        if (!response.ok) {
          setError(response.message ?? 'ルーム作成に失敗しました')
          return
        }

        const createdRoomCode = response.roomCode ?? ''

        setRoomCode(createdRoomCode)

        sessionStorage.setItem('numberWerewolfRoomCode', createdRoomCode)

        setPlayers(response.players ?? [])
        setDiscussionSeconds(
          response.discussionSeconds === undefined
            ? 180
            : response.discussionSeconds,
        )

        setCustomTopics(response.customTopics ?? [])
        setCustomTopicCount(response.customTopicCount ?? 0)
        setTopicSource(response.topicSource ?? 'PRESET')
        setTopicTypeFilter(response.topicTypeFilter ?? 'BOTH')
        setShowCustomTopics(response.showCustomTopics ?? false)
        setScreen('lobby')
      },
    )
  }

  async function handleCopyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode)

      setRoomCodeCopied(true)

      window.setTimeout(() => {
        setRoomCodeCopied(false)
      }, 2000)
    } catch {
      setError('ルームコードをコピーできませんでした')
    }
  }

  function handleJoinRoom() {
    setError('')

    const newPlayerToken = createFreshPlayerToken()

    setPlayerToken(newPlayerToken)
    sessionStorage.removeItem('numberWerewolfRoomCode')

    socket.emit(
      'joinRoom',
      {
        username,
        roomCode: joinRoomCode,
        playerToken: newPlayerToken,
      },
      (response: RoomResponse) => {
        if (!response.ok) {
          setError(response.message ?? 'ルーム参加に失敗しました')
          return
        }

        const joinedRoomCode = response.roomCode ?? ''

        setRoomCode(joinedRoomCode)

        sessionStorage.setItem('numberWerewolfRoomCode', joinedRoomCode)

        setPlayers(response.players ?? [])
        setDiscussionSeconds(
          response.discussionSeconds === undefined
            ? 180
            : response.discussionSeconds,
        )

        setCustomTopics(response.customTopics ?? [])
        setCustomTopicCount(response.customTopicCount ?? 0)
        setTopicSource(response.topicSource ?? 'PRESET')
        setTopicTypeFilter(response.topicTypeFilter ?? 'BOTH')
        setShowCustomTopics(response.showCustomTopics ?? false)
        setScreen('lobby')
      },
    )
  }

  function handleTopicSourceChange(value: string) {
    setError('')

    socket.emit(
      'updateSettings',
      {
        roomCode,
        topicSource: value,
      },
      (response: ActionResponse) => {
        if (!response.ok) {
          setError(response.message ?? '出題設定の変更に失敗しました')
        }
      },
    )
  }

  function handleTopicTypeFilterChange(value: string) {
    setError('')

    socket.emit(
      'updateSettings',
      {
        roomCode,
        topicTypeFilter: value,
      },
      (response: ActionResponse) => {
        if (!response.ok) {
          setError(response.message ?? '出題タイプの変更に失敗しました')
        }
      },
    )
  }

  function handleShowCustomTopicsChange(value: string) {
    setError('')

    socket.emit(
      'updateSettings',
      {
        roomCode,
        showCustomTopics: value === 'show',
      },
      (response: ActionResponse) => {
        if (!response.ok) {
          setError(response.message ?? '公開設定の変更に失敗しました')
        }
      },
    )
  }

  function handleDiscussionTimeChange(value: string) {
    setError('')

    const newValue = value === 'none' ? null : Number(value)

    socket.emit(
      'updateSettings',
      {
        roomCode,
        discussionSeconds: newValue,
      },
      (response: ActionResponse) => {
        if (!response.ok) {
          setError(response.message ?? '設定変更に失敗しました')
        }
      },
    )
  }

  function handleStartGame() {
    setError('')

    socket.emit(
      'startGame',
      {
        roomCode,
      },
      (response: ActionResponse) => {
        if (!response.ok) {
          setError(response.message ?? 'ゲーム開始に失敗しました')
        }
      },
    )
  }

  function handleToggleDiscussionSkip() {
    setError('')

    socket.emit(
      'toggleDiscussionSkip',
      {
        roomCode,
      },
      (response: ActionResponse & { hasSkipped?: boolean }) => {
        if (!response.ok) {
          setError(response.message ?? 'スキップに失敗しました')
          return
        }

        setHasSkipped(response.hasSkipped ?? false)
      },
    )
  }

  function handleEndDiscussion() {
    setError('')

    socket.emit(
      'endDiscussion',
      {
        roomCode,
      },
      (response: ActionResponse) => {
        if (!response.ok) {
          setError(response.message ?? '投票へ進めませんでした')
        }
      },
    )
  }

  function handleNextGame() {
    setError('')

    socket.emit(
      'nextGame',
      {
        roomCode,
      },
      (response: ActionResponse) => {
        if (!response.ok) {
          setError(response.message ?? 'ロビーに戻れませんでした')
        }
      },
    )
  }

  function returnToHome() {
    stopBgmAndReset()
    sessionStorage.removeItem('numberWerewolfRoomCode')

    setRoomCode('')
    setPlayers([])
    setRole(null)
    setTopic(null)
    setCustomTopics([])
    setCustomTopicCount(0)
    setError('')
    setScreen('home')
  }

  function handleKickPlayer(playerId: string, playerName: string) {
    const confirmed = window.confirm(
      `${playerName}をルームからキックしますか？`,
    )

    if (!confirmed) {
      return
    }

    setError('')

    socket.emit(
      'kickPlayer',
      {
        roomCode,
        targetId: playerId,
      },
      (response: ActionResponse) => {
        if (!response.ok) {
          setError(response.message ?? 'キックに失敗しました')
        }
      },
    )
  }

  function handleLeaveRoom() {
    const confirmed = window.confirm('ルームから退出しますか？')

    if (!confirmed) {
      return
    }

    setError('')

    socket.emit(
      'leaveRoom',
      {
        roomCode,
      },
      (response: ActionResponse) => {
        if (!response.ok) {
          setError(response.message ?? '退出に失敗しました')
          return
        }

        returnToHome()
      },
    )
  }

  function handleDisbandRoom() {
    const confirmed = window.confirm(
      '部屋を解散しますか？参加者全員がルームから退出します。',
    )

    if (!confirmed) {
      return
    }

    setError('')

    socket.emit(
      'disbandRoom',
      {
        roomCode,
      },
      (response: ActionResponse) => {
        if (!response.ok) {
          setError(response.message ?? '部屋の解散に失敗しました')
          return
        }

        returnToHome()
      },
    )
  }

  function submitAnswer() {
    setError('')

    if (answerValue.trim() === '' && answerMode !== 'OVER_MAX') {
      setError(
        currentTopicType === 'PLAYER'
          ? 'プレイヤーを選択してください'
          : '回答を入力してください',
      )
      return
    }

    const answerData =
      currentTopicType === 'PLAYER'
        ? {
            roomCode,
            type: 'PLAYER',
            value: answerValue,
          }
        : answerMode === 'OVER_MAX'
          ? {
              roomCode,
              type: 'OVER_MAX',
            }
          : {
              roomCode,
              type: 'NUMBER',
              value: answerValue,
            }

    socket.emit('submitAnswer', answerData, (response: ActionResponse) => {
      if (!response.ok) {
        setError(response.message ?? '回答に失敗しました')
        return
      }

      setScreen('waiting')
    })
  }

  function submitVote() {
    setError('')

    if (!selectedVote) {
      setError('投票先を選んでください')
      return
    }

    socket.emit(
      'submitVote',
      {
        roomCode,
        targetId: selectedVote,
      },
      (response: ActionResponse) => {
        if (!response.ok) {
          setError(response.message ?? '投票に失敗しました')
          return
        }

        setScreen('voteWaiting')
      },
    )
  }

  function handleAddCustomTopic() {
    setError('')

    socket.emit(
      'addCustomTopic',
      {
        roomCode,
        text: customTopicText,
        topicType: customTopicType,
        ...(customTopicType === 'NUMBER'
          ? {
              min: customTopicMin,
              max: customTopicMax,
            }
          : {}),
      },
      (response: ActionResponse) => {
        if (!response.ok) {
          setError(response.message ?? 'お題の追加に失敗しました')
          return
        }

        setCustomTopicText('')
        setCustomTopicMin('0')
        setCustomTopicMax('100')
      },
    )
  }

  function handleDeleteCustomTopic(topicId: string) {
    setError('')

    socket.emit(
      'deleteCustomTopic',
      {
        roomCode,
        topicId,
      },
      (response: ActionResponse) => {
        if (!response.ok) {
          setError(response.message ?? 'お題の削除に失敗しました')
        }
      },
    )
  }

  function handleClearCustomTopics() {
    const confirmed = window.confirm('カスタムお題をすべて削除しますか？')

    if (!confirmed) {
      return
    }

    setError('')

    socket.emit(
      'clearCustomTopics',
      {
        roomCode,
      },
      (response: ActionResponse) => {
        if (!response.ok) {
          setError(response.message ?? 'お題の削除に失敗しました')
        }
      },
    )
  }

  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)

    const secs = seconds % 60

    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(
      2,
      '0',
    )}`
  }

  return (
    <main className="app">
      <div className="audio-control-panel" aria-label="音設定">
        <div className="audio-control-row">
          <span className="audio-control-label">効果音</span>
          <span className="audio-control-icon" aria-hidden="true">
            {soundVolume === 0 ? '🔇' : soundVolume < 50 ? '🔉' : '🔊'}
          </span>
          <input
            className="audio-volume-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            value={soundVolume}
            onChange={(event) => handleSoundVolumeChange(event.target.value)}
            aria-label="効果音の音量"
            aria-valuetext={`${soundVolume}%`}
          />
          <span className="audio-volume-value">{soundVolume}%</span>
        </div>

        <div className="audio-control-row">
          <span className="audio-control-label">BGM</span>
          <span className="audio-control-icon" aria-hidden="true">
            {bgmVolume === 0 || selectedBgm === 'NONE'
              ? '🔇'
              : bgmVolume < 50
                ? '🔉'
                : '🔊'}
          </span>
          <input
            className="audio-volume-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            value={bgmVolume}
            onChange={(event) => handleBgmVolumeChange(event.target.value)}
            aria-label="BGMの音量"
            aria-valuetext={`${bgmVolume}%`}
          />
          <span className="audio-volume-value">{bgmVolume}%</span>
        </div>

        <label className="bgm-select-row">
          <span>BGM選択</span>
          <select
            value={selectedBgm}
            onChange={(event) => handleBgmTrackChange(event.target.value)}
          >
            {BGM_TRACKS.map((track) => (
              <option key={track.id} value={track.id}>
                {track.label}
              </option>
            ))}
          </select>
        </label>

        <div className="bgm-now-playing-row">
          <span>再生中</span>
          <strong>
            {playingBgm
              ? getSelectedBgm(playingBgm).label
              : selectedBgm === 'NONE'
                ? 'BGMなし'
                : '停止中'}
          </strong>
          {playingBgm === 'SHIMA' && (
            <button
              type="button"
              className="lyrics-toggle-button"
              onClick={() => setShowLyrics((current) => !current)}
            >
              {showLyrics ? '歌詞を閉じる' : '歌詞を見る'}
            </button>
          )}
        </div>
      </div>

      {showLyrics && playingBgm === 'SHIMA' && (
        <aside className="lyrics-panel" aria-label="しーまの歌詞">
          <div className="lyrics-panel-header">
            <strong>しーま — 歌詞</strong>
            <button
              type="button"
              className="lyrics-close-button"
              onClick={() => setShowLyrics(false)}
              aria-label="歌詞を閉じる"
            >
              ×
            </button>
          </div>
          <pre className="lyrics-scroll">{SHIMA_LYRICS}</pre>
        </aside>
      )}

      <div
        className={`card ${
          ['lobby', 'discussion', 'voting', 'voteResult', 'result'].includes(
            screen,
          )
            ? 'card-wide'
            : ''
        }`}
      >
        {screen === 'home' && (
          <>
            <h1>Ni狼lamo</h1>

            <p className="subtitle">数字で答えて、人狼を見つけろ。</p>

            <div className="menu">
              <button
                onClick={handleEnterCreateScreen}
              >
                ルームを作る
              </button>

              <button
                className="secondary"
                onClick={handleEnterJoinScreen}
              >
                ルームに参加する
              </button>

              <button
                className="back"
                onClick={() => {
                  setError('')
                  setScreen('rules')
                }}
              >
                遊び方
              </button>
            </div>
          </>
        )}

        {screen === 'rules' && (
          <div className="how-to-play">
            <h2>遊び方</h2>

            <ol className="rules-list">
              <li>
                <strong>役職を確認</strong>
                <p>
                  3人以上でゲーム開始。プレイヤーの中から1人が「人狼」になります。
                </p>
              </li>

              <li>
                <strong>お題に回答</strong>
                <p>
                  お題には「数値回答型」と「プレイヤー選択型」があります。
                  市民にはお題が表示されますが、人狼にはお題が表示されません。
                </p>
              </li>

              <li>
                <strong>回答方法</strong>
                <p>
                  数値回答型では、指定された範囲の数字で回答します。
                  プレイヤー選択型では、参加者の中からお題に当てはまると思う1人を選びます。
                  人狼も市民と同じ方法で、お題を推測しながら回答します。
                </p>
              </li>

              <li>
                <strong>話し合い</strong>
                <p>
                  全員の回答が公開されます。回答のズレや会話を手がかりに、
                  誰がお題を知らない人狼なのかを推理します。
                </p>
              </li>

              <li>
                <strong>投票</strong>
                <p>
                  人狼だと思うプレイヤーに投票します。
                  人狼を処刑できれば市民の勝利、それ以外なら人狼の勝利です。
                  同票の場合は再投票を行います。
                </p>
              </li>

              <li>
                <strong>お題の設定</strong>
                <p>
                  ホストは「数値回答のみ」「プレイヤー選択のみ」「両方」から
                  出題タイプを選べます。プリセットだけでなく、
                  カスタムお題でも回答タイプを設定できます。
                </p>
              </li>
            </ol>

            <button
              className="back"
              onClick={handleBackToHome}
            >
              戻る
            </button>
          </div>
        )}

        {screen === 'create' && (
          <div className="form">
            <h2>ルームを作る</h2>

            <label>
              ユーザー名
              <input
                type="text"
                maxLength={20}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>

            <ErrorMessage message={error} />

            <button onClick={handleCreateRoom}>ルーム作成</button>

            <button
              className="back"
              onClick={handleBackToHome}
            >
              戻る
            </button>
          </div>
        )}

        {screen === 'join' && (
          <div className="form">
            <h2>ルームに参加する</h2>

            <label>
              ルームコード
              <input
                type="text"
                placeholder="ABCD12"
                maxLength={6}
                value={joinRoomCode}
                onChange={(event) =>
                  setJoinRoomCode(event.target.value.toUpperCase())
                }
              />
            </label>

            <label>
              ユーザー名
              <input
                type="text"
                maxLength={20}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>

            <ErrorMessage message={error} />

            <button onClick={handleJoinRoom}>参加する</button>

            <button
              className="back"
              onClick={handleBackToHome}
            >
              戻る
            </button>
          </div>
        )}

        {screen === 'lobby' && (
          <div>
            <h2>ロビー</h2>

            <div className="room-code-label-row">
              <span>ルームコード</span>

              <button
                type="button"
                className="copy-room-code-button"
                onClick={handleCopyRoomCode}
              >
                {roomCodeCopied ? 'コピーしました' : 'コピー'}
              </button>
            </div>

            <div className="room-code">{roomCode}</div>

            <h3>参加プレイヤー（{players.length}人）</h3>

            <div className="player-list">
              {players.map((player) => (
                <div key={player.id} className="player">
                  <div className="player-name-area">
                    <span className="player-name">{player.name}</span>

                    {!player.isConnected && (
                      <span className="disconnected-label">接続切れ</span>
                    )}
                  </div>

                  <div className="player-actions">
                    {player.isHost && <span className="host-label">HOST</span>}

                    {isHost && player.id !== socket.id && (
                      <button
                        type="button"
                        className="kick-player-button"
                        onClick={() => handleKickPlayer(player.id, player.name)}
                      >
                        キック
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <h3>ゲーム設定</h3>

            <div className="game-settings">
              <div className="settings-grid">
                <div className="setting-row">
                  <span>出題するお題</span>

                  {isHost ? (
                    <select
                      value={topicSource}
                      onChange={(event) =>
                        handleTopicSourceChange(event.target.value)
                      }
                    >
                      <option value="PRESET">プリセットのみ</option>
                      <option value="CUSTOM">カスタムのみ</option>
                      <option value="BOTH">プリセット＋カスタム</option>
                    </select>
                  ) : (
                    <strong>
                      {topicSource === 'PRESET'
                        ? 'プリセットのみ'
                        : topicSource === 'CUSTOM'
                          ? 'カスタムのみ'
                          : 'プリセット＋カスタム'}
                    </strong>
                  )}
                </div>

                <div className="setting-row">
                  <span>出題タイプ</span>

                  {isHost ? (
                    <select
                      value={topicTypeFilter}
                      onChange={(event) =>
                        handleTopicTypeFilterChange(event.target.value)
                      }
                    >
                      <option value="NUMBER">数値回答のみ</option>
                      <option value="PLAYER">プレイヤー選択のみ</option>
                      <option value="BOTH">両方</option>
                    </select>
                  ) : (
                    <strong>
                      {topicTypeFilter === 'NUMBER'
                        ? '数値回答のみ'
                        : topicTypeFilter === 'PLAYER'
                          ? 'プレイヤー選択のみ'
                          : '両方'}
                    </strong>
                  )}
                </div>

                <div className="setting-row">
                  <span>話し合い時間</span>

                  {isHost ? (
                    <select
                      value={
                        discussionSeconds === null ? 'none' : discussionSeconds
                      }
                      onChange={(event) =>
                        handleDiscussionTimeChange(event.target.value)
                      }
                    >
                      <option value="60">1分</option>
                      <option value="120">2分</option>
                      <option value="180">3分</option>
                      <option value="300">5分</option>
                      <option value="none">制限時間なし</option>
                    </select>
                  ) : (
                    <strong>
                      {discussionSeconds === null
                        ? '制限時間なし'
                        : `${discussionSeconds / 60}分`}
                    </strong>
                  )}
                </div>

                {topicSource !== 'PRESET' && (
                  <div className="setting-row">
                    <span>他の人のお題</span>

                    {isHost ? (
                      <select
                        value={showCustomTopics ? 'show' : 'hide'}
                        onChange={(event) =>
                          handleShowCustomTopicsChange(event.target.value)
                        }
                      >
                        <option value="hide">非公開</option>
                        <option value="show">公開</option>
                      </select>
                    ) : (
                      <strong>{showCustomTopics ? '公開' : '非公開'}</strong>
                    )}
                  </div>
                )}
              </div>

              {topicSource !== 'PRESET' && (
                <div className="custom-topic-section">
                  <h3>カスタムお題</h3>

                  <div className="custom-topic-form">
                    <label>
                      お題タイプ
                      <select
                        value={customTopicType}
                        onChange={(event) =>
                          setCustomTopicType(event.target.value as TopicType)
                        }
                      >
                        <option value="NUMBER">数値回答</option>
                        <option value="PLAYER">プレイヤー選択</option>
                      </select>
                    </label>

                    <label>
                      お題
                      <input
                        type="text"
                        value={customTopicText}
                        onChange={(event) =>
                          setCustomTopicText(event.target.value)
                        }
                      />
                    </label>

                    {customTopicType === 'NUMBER' && (
                      <div className="custom-topic-range">
                        <label>
                          <span className="range-label">
                            最小値 <span className="range-label-en">MIN</span>
                          </span>

                          <input
                            type="number"
                            value={customTopicMin}
                            onChange={(event) =>
                              setCustomTopicMin(event.target.value)
                            }
                          />
                        </label>

                        <label>
                          <span className="range-label">
                            最大値 <span className="range-label-en">MAX</span>
                          </span>

                          <input
                            type="number"
                            value={customTopicMax}
                            onChange={(event) =>
                              setCustomTopicMax(event.target.value)
                            }
                          />
                        </label>
                      </div>
                    )}

                    <button
                      className="secondary"
                      onClick={handleAddCustomTopic}
                    >
                      お題を追加
                    </button>
                  </div>

                  <p className="custom-topic-count">
                    ルーム全体：{customTopicCount}件
                  </p>

                  {isHost && customTopicCount > 0 && (
                    <button
                      className="clear-custom-topics"
                      onClick={handleClearCustomTopics}
                    >
                      カスタムお題をすべて削除
                    </button>
                  )}

                  {customTopics.length > 0 && (
                    <>
                      <h3>
                        {showCustomTopics
                          ? '登録済みのお題'
                          : 'あなたが登録したお題'}
                      </h3>

                      <div className="custom-topic-list">
                        {customTopics.map((customTopic) => (
                          <div
                            key={customTopic.id}
                            className="custom-topic-item"
                          >
                            <div className="custom-topic-info">
                              <strong>{customTopic.text}</strong>

                              <span>
                                {customTopic.type === 'NUMBER'
                                  ? `数値回答：${customTopic.min} ～ ${customTopic.max}`
                                  : 'プレイヤー選択'}
                                {showCustomTopics &&
                                  customTopic.isOwn &&
                                  ' ・自分のお題'}
                              </span>
                            </div>

                            {(customTopic.isOwn || isHost) && (
                              <button
                                className="custom-topic-delete"
                                onClick={() =>
                                  handleDeleteCustomTopic(customTopic.id)
                                }
                              >
                                削除
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <ErrorMessage message={error} />

            {isHost ? (
              <button className="start-game-button" onClick={handleStartGame}>
                ゲーム開始
              </button>
            ) : (
              <p className="waiting">ホストのゲーム開始を待っています</p>
            )}
            <button className="leave-button" onClick={handleLeaveRoom}>
              退出する
            </button>

            {isHost && (
              <button className="disband-button" onClick={handleDisbandRoom}>
                部屋を解散
              </button>
            )}
          </div>
        )}
        {screen === 'answer' && role && (
          <div
            className={
              role === 'WEREWOLF'
                ? 'role-screen werewolf'
                : 'role-screen citizen'
            }
          >
            <h2>
              {role === 'WEREWOLF' ? 'あなたは人狼です' : 'あなたは市民です'}
            </h2>

            <div
              className={`discussion-timer ${
                remainingAnswerSeconds <= 10 ? 'danger' : ''
              }`}
            >
              {formatTime(remainingAnswerSeconds)}
            </div>

            <div className="topic-box">
              <strong>{role === 'WEREWOLF' ? '？？？' : topic}</strong>
            </div>

            {currentTopicType === 'NUMBER' ? (
              <>
                <p className="range">
                  回答範囲：{min} ～ {max}
                </p>

                <div className="answer-form">
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={answerValue}
                    onChange={(event) => {
                      const value = event.target.value

                      setAnswerValue(value)
                      setAnswerMode('NUMBER')
                      setError('')

                      if (value.trim() === '') {
                        socket.emit('updateAnswerDraft', {
                          roomCode,
                          type: 'CLEAR',
                        })
                      } else {
                        socket.emit('updateAnswerDraft', {
                          roomCode,
                          type: 'NUMBER',
                          value,
                        })
                      }
                    }}
                  />

                  <button
                    type="button"
                    className={`secondary over-max-button ${
                      answerMode === 'OVER_MAX' ? 'active' : ''
                    }`}
                    onClick={() => {
                      if (answerMode === 'OVER_MAX') {
                        setAnswerMode('NUMBER')

                        socket.emit('updateAnswerDraft', {
                          roomCode,
                          type: 'CLEAR',
                        })
                      } else {
                        setAnswerMode('OVER_MAX')
                        setAnswerValue('')

                        socket.emit('updateAnswerDraft', {
                          roomCode,
                          type: 'OVER_MAX',
                        })
                      }

                      setError('')
                    }}
                  >
                    {max}以上
                  </button>

                  <button onClick={submitAnswer}>回答確定</button>
                </div>
              </>
            ) : (
              <>
                <p className="range">回答するプレイヤーを1人選択</p>

                <div className="vote-list player-answer-list">
                  {answerOptions.map((playerName) => (
                    <button
                      key={playerName}
                      type="button"
                      className={`vote-option ${
                        answerValue === playerName ? 'selected' : ''
                      }`}
                      onClick={() => {
                        setAnswerValue(playerName)
                        setAnswerMode('PLAYER')
                        setError('')

                        socket.emit('updateAnswerDraft', {
                          roomCode,
                          type: 'PLAYER',
                          value: playerName,
                        })
                      }}
                    >
                      {playerName}
                    </button>
                  ))}
                </div>

                <div className="answer-form">
                  <button onClick={submitAnswer}>回答確定</button>
                </div>
              </>
            )}

            <ErrorMessage message={error} />
          </div>
        )}

        {screen === 'waiting' && (
          <div className="waiting-screen">
            <h2>回答しました</h2>

            <div
              className={`discussion-timer ${
                remainingAnswerSeconds <= 10 ? 'danger' : ''
              }`}
            >
              {formatTime(remainingAnswerSeconds)}
            </div>

            <p>他のプレイヤーを待っています</p>

            <div className="answer-count">
              回答済み {answeredCount} / {totalCount}人
            </div>
          </div>
        )}

        {screen === 'discussion' && (
          <div>
            <h2>話し合い</h2>

            <div
              className={`discussion-timer ${
                discussionEndsAt !== null && remainingSeconds <= 10
                  ? 'danger'
                  : discussionEndsAt !== null && remainingSeconds <= 30
                    ? 'warning'
                    : ''
              }`}
            >
              {discussionEndsAt === null
                ? '制限時間なし'
                : formatTime(remainingSeconds)}
            </div>

            <div className="topic-box">
              <strong>{topic}</strong>
            </div>

            <div className="revealed-list">
              {revealedAnswers.map((item) => (
                <div key={item.playerId} className="revealed-answer">
                  <span className="vote-target-name">{item.playerName}</span>

                  <strong>
                    {item.answer.type === 'TIMEOUT'
                      ? '未回答'
                      : item.answer.type === 'OVER_MAX'
                        ? `${max}以上`
                        : item.answer.value}
                  </strong>
                </div>
              ))}
            </div>

            <button
              className={`skip-button ${hasSkipped ? 'active' : ''}`}
              onClick={handleToggleDiscussionSkip}
            >
              {hasSkipped ? 'スキップ取消' : 'スキップ'} {skipCount} /{' '}
              {skipRequiredCount}
            </button>

            {discussionEndsAt === null && isHost && (
              <button className="start-button" onClick={handleEndDiscussion}>
                投票へ進む
              </button>
            )}

            <ErrorMessage message={error} />
          </div>
        )}

        {screen === 'voting' && (
          <div>
            <h2>{isRevote ? '再投票' : '投票'}</h2>

            {showSkipNotice && (
              <div className="skip-notice">話し合いがスキップされました</div>
            )}

            <div
              className={`discussion-timer ${
                remainingVoteSeconds <= 10 ? 'danger' : ''
              }`}
            >
              {formatTime(remainingVoteSeconds)}
            </div>

            <p className="subtitle">
              {isRevote
                ? '同票候補から1人選んでください'
                : '人狼だと思うプレイヤーを選んでください'}
            </p>

            <div className="vote-list">
              {voteCandidates.map((player) => {
                const isSelf = player.id === socket.id

                return (
                  <button
                    key={player.id}
                    disabled={isSelf}
                    className={
                      selectedVote === player.id
                        ? 'vote-option selected'
                        : 'vote-option'
                    }
                    onClick={() => {
                      setSelectedVote(player.id)
                      setError('')

                      socket.emit('updateVoteDraft', {
                        roomCode,
                        targetId: player.id,
                      })
                    }}
                  >
                    {player.name}

                    {isSelf && '（自分）'}
                  </button>
                )
              })}
            </div>

            <ErrorMessage message={error} />

            <button className="start-button" onClick={submitVote}>
              投票確定
            </button>
          </div>
        )}

        {screen === 'voteWaiting' && (
          <div className="waiting-screen">
            <h2>投票しました</h2>

            <div
              className={`discussion-timer ${
                remainingVoteSeconds <= 10 ? 'danger' : ''
              }`}
            >
              {formatTime(remainingVoteSeconds)}
            </div>

            <p>他のプレイヤーの投票を待っています</p>

            <div className="answer-count">
              投票済み {votedCount} / {voteTotalCount}人
            </div>
          </div>
        )}

        {screen === 'voteResult' && gameResult && (
          <div className="vote-result-screen">
            {resultStage === 'ANNOUNCE' && (
              <div className="vote-result-stage stage-announce">
                <p className="execution-announcement">処刑されるのは……</p>
              </div>
            )}

            {resultStage === 'EXECUTED' && (
              <div className="vote-result-stage stage-executed">
                <strong className="executed-player-name">
                  {gameResult.executedPlayer.name}
                </strong>

                <span className="executed-votes">{executedVoteCount}票</span>
              </div>
            )}

            {resultStage === 'ROLE' && (
              <div className="vote-result-stage stage-role">
                <p className="role-reveal-line">
                  <span>{gameResult.executedPlayer.name} は</span>

                  <span
                    className={
                      gameResult.executedRole === 'WEREWOLF'
                        ? 'role-reveal-role role-reveal-werewolf'
                        : 'role-reveal-role role-reveal-citizen'
                    }
                  >
                    {gameResult.executedRole === 'WEREWOLF' ? '人狼' : '市民'}
                  </span>

                  <span>でした</span>
                </p>
              </div>
            )}
          </div>
        )}
        {screen === 'result' && gameResult && (
          <div
            className={
              gameResult.winner === 'CITIZEN'
                ? 'result-screen citizen'
                : 'result-screen werewolf'
            }
          >
            <h2>
              {gameResult.winner === 'CITIZEN'
                ? '市民チームの勝利！'
                : '人狼チームの勝利！'}
            </h2>

            <div className="result-box">
              <p>今回の人狼</p>

              <strong className="werewolf-name">
                {gameResult.werewolf.name}
              </strong>
            </div>

            <div className="result-box">
              <p>処刑されたプレイヤー</p>

              <strong>{gameResult.executedPlayer.name}</strong>

              <p>
                {gameResult.executedRole === 'WEREWOLF' ? (
                  <>
                    <span className="role-text werewolf-text">人狼</span>
                    でした
                  </>
                ) : (
                  <>
                    <span className="role-text citizen-text">市民</span>
                    でした
                  </>
                )}
              </p>
            </div>

            <h3>投票結果</h3>

            <div className="revealed-list result-vote-list">
              {gameResult.voteCounts.map((item) => (
                <div key={item.playerId} className="revealed-answer">
                  <span className="vote-target-name">{item.playerName}</span>

                  <strong>{item.votes}票</strong>
                </div>
              ))}
            </div>

            <h3 className="vote-destination-title">投票先一覧</h3>

            <div className="vote-destination-list">
              {players.map((player) => {
                const target = gameResult.voteCounts.find((item) =>
                  item.voters.includes(player.name),
                )

                const votedWerewolf =
                  target?.playerId === gameResult.werewolf.id

                return (
                  <div key={player.id} className="vote-destination-row">
                    <span className="vote-destination-player">
                      {player.name}
                    </span>

                    <span className="vote-destination-arrow">→</span>

                    {target ? (
                      <span
                        className={
                          votedWerewolf
                            ? 'vote-destination-target werewolf-target'
                            : 'vote-destination-target'
                        }
                      >
                        {target.playerName}
                      </span>
                    ) : (
                      <span className="vote-destination-abstain">棄権</span>
                    )}
                  </div>
                )
              })}
            </div>

            <ErrorMessage message={error} />

            {isHost ? (
              <button className="start-button" onClick={handleNextGame}>
                次のゲーム
              </button>
            ) : (
              <p className="waiting">
                ホストが次のゲームを開始するのを待っています
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

export default App
