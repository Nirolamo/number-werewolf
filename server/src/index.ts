import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'path'

// =========================
// サーバー設定
// =========================

const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'
const PORT = Number(process.env.PORT) || 3001

const MIN_PLAYERS = 3
const ANSWER_TIME_MS = 30 * 1000
const VOTE_TIME_MS = 15 * 1000
const DISCONNECT_GRACE_MS = 15 * 1000

const app = express()
const httpServer = createServer(app)

const io = new Server(
  httpServer,
  IS_PRODUCTION
    ? {}
    : {
        cors: {
          origin: CLIENT_ORIGIN,
          methods: ['GET', 'POST'],
        },
      },
)

if (!IS_PRODUCTION) {
  app.use(
    cors({
      origin: CLIENT_ORIGIN,
    }),
  )
}

// =========================
// 型定義
// =========================

type Player = {
  id: string
  name: string
  isHost: boolean
  isConnected: boolean
}

type Topic = {
  id: string
  text: string
  min: number
  max: number
}

type CustomTopic = Topic & {
  createdBy: string
}

type TopicSource = 'PRESET' | 'CUSTOM' | 'BOTH'

type CustomTopicView = Topic & {
  isOwn: boolean
}

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
      type: 'TIMEOUT'
      value: null
    }

type AnswerDraft =
  | {
      type: 'NUMBER'
      value: number
    }
  | {
      type: 'OVER_MAX'
      value: null
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
  executedRole: 'CITIZEN' | 'WEREWOLF'
  werewolf: {
    id: string
    name: string
  }
  winner: 'CITIZEN' | 'WEREWOLF'
  voteCounts: VoteCount[]
}

type Phase =
  | 'LOBBY'
  | 'ANSWERING'
  | 'DISCUSSION'
  | 'VOTING'
  | 'REVOTING'
  | 'RESULT'

type Room = {
  code: string
  hostId: string
  players: Player[]
  playerTokens: Record<string, string>
  phase: Phase

  werewolfId?: string
  topic?: Topic
  gameResult?: GameResult

  answers: Record<string, Answer>
  answerDrafts: Record<string, AnswerDraft>

  votes: Record<string, string>
  voteDrafts: Record<string, string>

  skipVotes: string[]

  revoteCandidates: string[]

  answerEndsAt?: number
  voteEndsAt?: number
  discussionEndsAt?: number
  discussionSeconds: number | null

  customTopics: CustomTopic[]
  topicSource: TopicSource
  showCustomTopics: boolean
}

// =========================
// ルーム状態
// =========================

const rooms = new Map<string, Room>()
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()

// =========================
// プリセットお題
// =========================

const PRESET_TOPICS: Topic[] = [
  {
    id: 'preset-1',
    text: '理想の睡眠時間は？',
    min: 0,
    max: 15,
  },
  {
    id: 'preset-2',
    text: '旅行に行くなら何日間くらいが理想？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-3',
    text: '自分の料理の腕前を100点満点で評価すると？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-4',
    text: '初デートに使ってもいいと思う金額は？',
    min: 0,
    max: 10000,
  },
  {
    id: 'preset-5',
    text: 'このメンバーで無人島生活したら何日耐えられそう？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-6',
    text: '自分の運の良さを100点満点で評価すると？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-7',
    text: '自分のコミュニケーション能力は何点？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-8',
    text: '自分の方向感覚は何点？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-9',
    text: '自分のファッションセンスは何点？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-10',
    text: '自分の体力は何点くらい？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-11',
    text: '自分は朝に強い方だと思う？何点？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-12',
    text: '今の生活の充実度は何点？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-13',
    text: '今の自分の部屋の綺麗さは何点？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-14',
    text: '自分は嘘をつくのが上手いと思う？何点？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-15',
    text: 'このメンバーへの信頼度は何点？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-16',
    text: 'このメンバーで旅行したら楽しそう度は何点？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-17',
    text: '自分が人狼ゲームで生き残れる自信は何点？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-18',
    text: '自分の記憶力は何点くらい？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-19',
    text: '自分の計画性は何点くらい？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-20',
    text: '自分のメンタルの強さは何点くらい？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-21',
    text: '今まで何か国行ったことがある？',
    min: 0,
    max: 50,
  },
  {
    id: 'preset-22',
    text: '今まで何都道府県行ったことがある？',
    min: 0,
    max: 50,
  },
  {
    id: 'preset-23',
    text: '今まで何回海外旅行したことがある？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-24',
    text: '今まで何回引っ越したことがある？',
    min: 0,
    max: 20,
  },
  {
    id: 'preset-25',
    text: '今まで何個アルバイトを経験したことがある？',
    min: 0,
    max: 20,
  },
  {
    id: 'preset-26',
    text: '今まで何種類のスポーツをやったことがある？',
    min: 0,
    max: 20,
  },
  {
    id: 'preset-27',
    text: '今まで何個習い事をしたことがある？',
    min: 0,
    max: 20,
  },
  {
    id: 'preset-28',
    text: '今まで何種類の楽器を演奏したことがある？',
    min: 0,
    max: 20,
  },
  {
    id: 'preset-29',
    text: '今まで何個の部活・サークルに入ったことがある？',
    min: 0,
    max: 20,
  },
  {
    id: 'preset-30',
    text: '今まで何個資格を取ったことがある？',
    min: 0,
    max: 20,
  },
  {
    id: 'preset-31',
    text: '今まで何回一人旅したことがある？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-32',
    text: '今まで何回キャンプしたことがある？',
    min: 0,
    max: 50,
  },
  {
    id: 'preset-33',
    text: '今まで何回ライブ・コンサートに行ったことがある？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-34',
    text: '今まで何回スポーツ観戦に行ったことがある？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-35',
    text: '今まで何回テーマパークに行ったことがある？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-36',
    text: '今まで何回飛行機に乗ったことがある？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-37',
    text: '今まで何回新幹線に乗ったことがある？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-38',
    text: '今まで何校に通ったことがある？',
    min: 0,
    max: 20,
  },
  {
    id: 'preset-39',
    text: '今まで何回面接を受けたことがある？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-40',
    text: '今まで何回徹夜したことがある？',
    min: 0,
    max: 100,
  },
  {
    id: 'preset-41',
    text: '休日なら何時間くらい寝ていられる？',
    min: 0,
    max: 24,
  },
  {
    id: 'preset-42',
    text: '1日にスマホを何時間くらい使う？',
    min: 0,
    max: 24,
  },
  {
    id: 'preset-43',
    text: 'ゲームをぶっ通しで何時間できる？',
    min: 0,
    max: 24,
  },
  {
    id: 'preset-44',
    text: '映画やドラマを一気見するなら何時間までいける？',
    min: 0,
    max: 24,
  },
  {
    id: 'preset-45',
    text: '何時間までなら長距離移動に耐えられる？',
    min: 0,
    max: 24,
  },
  {
    id: 'preset-46',
    text: '友達の遅刻を何分まで許せる？',
    min: 0,
    max: 120,
  },
  {
    id: 'preset-47',
    text: '飲食店なら何分まで並べる？',
    min: 0,
    max: 120,
  },
  {
    id: 'preset-48',
    text: '電車の遅延は何分までなら気にならない？',
    min: 0,
    max: 120,
  },
  {
    id: 'preset-49',
    text: '待ち合わせには何分前に着きたい？',
    min: 0,
    max: 120,
  },
  {
    id: 'preset-50',
    text: '朝起きてから家を出るまで何分必要？',
    min: 0,
    max: 120,
  },
  {
    id: 'preset-51',
    text: '昼寝するなら何分くらいが理想？',
    min: 0,
    max: 120,
  },
  {
    id: 'preset-52',
    text: 'お風呂には何分くらい入る？',
    min: 0,
    max: 120,
  },
  {
    id: 'preset-53',
    text: '家から最寄り駅まで何分くらい？',
    min: 0,
    max: 120,
  },
  {
    id: 'preset-54',
    text: '通勤・通学は片道何分までなら許容できる？',
    min: 0,
    max: 120,
  },
  {
    id: 'preset-55',
    text: 'カラオケは何時間くらいがちょうどいい？',
    min: 0,
    max: 15,
  },
  {
    id: 'preset-56',
    text: 'コンビニで一度に使う金額はいくらくらい？',
    min: 0,
    max: 5000,
  },
  {
    id: 'preset-57',
    text: 'ランチならいくらまで出せる？',
    min: 0,
    max: 5000,
  },
  {
    id: 'preset-58',
    text: 'ラーメン一杯ならいくらまで出せる？',
    min: 0,
    max: 5000,
  },
  {
    id: 'preset-59',
    text: 'カフェ1回ならいくらまで使える？',
    min: 0,
    max: 5000,
  },
  {
    id: 'preset-60',
    text: '映画館で食べ物・飲み物にいくらまで使う？',
    min: 0,
    max: 5000,
  },
  {
    id: 'preset-61',
    text: '友達への誕生日プレゼントならいくらくらい？',
    min: 0,
    max: 10000,
  },
  {
    id: 'preset-62',
    text: '一回の飲み会ならいくらまで使える？',
    min: 0,
    max: 10000,
  },
  {
    id: 'preset-63',
    text: '初対面の人との食事ならいくらまで出せる？',
    min: 0,
    max: 10000,
  },
  {
    id: 'preset-64',
    text: 'タクシーなら一回いくらまで使える？',
    min: 0,
    max: 10000,
  },
  {
    id: 'preset-65',
    text: '趣味のものを衝動買いするならいくらまで？',
    min: 0,
    max: 10000,
  },
  {
    id: 'preset-66',
    text: '普段使いの靴ならいくらまで出せる？',
    min: 0,
    max: 30000,
  },
  {
    id: 'preset-67',
    text: '普段使いのバッグならいくらまで出せる？',
    min: 0,
    max: 30000,
  },
  {
    id: 'preset-68',
    text: 'イヤホン・ヘッドホンならいくらまで出せる？',
    min: 0,
    max: 30000,
  },
  {
    id: 'preset-69',
    text: '一泊のホテルならいくらまで出せる？',
    min: 0,
    max: 30000,
  },
  {
    id: 'preset-70',
    text: '財布ならいくらまで出せる？',
    min: 0,
    max: 100000,
  },
  {
    id: 'preset-71',
    text: '国内旅行1泊にいくらまで使える？',
    min: 0,
    max: 100000,
  },
  {
    id: 'preset-72',
    text: 'スマホを買うならいくらまで出せる？',
    min: 0,
    max: 100000,
  },
  {
    id: 'preset-73',
    text: '趣味のためなら一度にいくらまで使える？',
    min: 0,
    max: 100000,
  },
  {
    id: 'preset-74',
    text: '記念日の食事ならいくらまで出せる？',
    min: 0,
    max: 100000,
  },
  {
    id: 'preset-75',
    text: '自分へのご褒美ならいくらまで使える？',
    min: 0,
    max: 100000,
  },
  {
    id: 'preset-76',
    text: '一度に食べられる寿司は何皿くらい？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-77',
    text: '焼肉で肉は何皿くらい食べられる？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-78',
    text: '餃子なら一度に何個くらい食べられる？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-79',
    text: '一日にコーヒーを何杯まで飲める？',
    min: 0,
    max: 15,
  },
  {
    id: 'preset-80',
    text: '一日に水やお茶を何杯くらい飲む？',
    min: 0,
    max: 15,
  },
  {
    id: 'preset-81',
    text: '一週間に外食は何回くらいする？',
    min: 0,
    max: 15,
  },
  {
    id: 'preset-82',
    text: '一週間にコンビニへ何回くらい行く？',
    min: 0,
    max: 15,
  },
  {
    id: 'preset-83',
    text: '一週間に何回くらい運動したい？',
    min: 0,
    max: 15,
  },
  {
    id: 'preset-84',
    text: '一か月に映画を何本くらい観る？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-85',
    text: '一か月に本や漫画を何冊くらい読む？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-86',
    text: '一か月に何回くらい飲みに行く？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-87',
    text: '旅行に持っていく靴は何足？',
    min: 0,
    max: 10,
  },
  {
    id: 'preset-88',
    text: '旅行に持っていくバッグは何個？',
    min: 0,
    max: 10,
  },
  {
    id: 'preset-89',
    text: '無人島に持っていけるなら何個持っていきたい？',
    min: 0,
    max: 10,
  },
  {
    id: 'preset-90',
    text: 'スマホに入れておきたい必須アプリは何個くらい？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-91',
    text: '何日くらいならスマホなしで生活できる？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-92',
    text: '何日くらいなら一人旅できる？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-93',
    text: '同じ料理を連続で何日食べられる？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-94',
    text: '何日くらいならSNSを見なくても平気？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-95',
    text: '何日くらいなら家から出なくても平気？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-96',
    text: 'このメンバーだけで旅行するなら何泊したい？',
    min: 0,
    max: 15,
  },
  {
    id: 'preset-97',
    text: 'このメンバーで共同生活するなら何日続けられそう？',
    min: 0,
    max: 30,
  },
  {
    id: 'preset-98',
    text: 'このメンバーで会社を作ったら何年続きそう？',
    min: 0,
    max: 20,
  },
  {
    id: 'preset-99',
    text: 'このメンバーの中で、自分の人狼の上手さを10点満点で評価すると？',
    min: 0,
    max: 10,
  },
  {
    id: 'preset-100',
    text: '今日の自分のテンションは100点満点で何点？',
    min: 0,
    max: 100,
  },
]

// =========================
// 共通ヘルパー
// =========================

function getSkipRequiredCount(room: Room) {
  return Math.floor(room.players.length / 2) + 1
}

function emitRoomUpdated(room: Room) {
  io.to(room.code).emit('roomUpdated', {
    players: room.players,
  })
}

function clearDisconnectTimer(playerId: string) {
  const timer = disconnectTimers.get(playerId)

  if (!timer) {
    return
  }

  clearTimeout(timer)
  disconnectTimers.delete(playerId)
}

function setHost(room: Room, hostId: string) {
  room.hostId = hostId
  room.players = room.players.map((player) => ({
    ...player,
    isHost: player.id === hostId,
  }))
}

function removePlayerData(room: Room, playerId: string) {
  room.players = room.players.filter((player) => player.id !== playerId)
  delete room.playerTokens[playerId]
  room.customTopics = room.customTopics.filter(
    (topic) => topic.createdBy !== playerId,
  )
}

function generateRoomCode() {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

  let code = ''

  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length)

    code += characters[randomIndex]
  }

  return code
}

function createUniqueRoomCode() {
  let code = generateRoomCode()

  while (rooms.has(code)) {
    code = generateRoomCode()
  }

  return code
}

// =========================
// カスタムお題ヘルパー
// =========================

function getCustomTopicsForPlayer(room: Room, playerId: string) {
  const visibleTopics = room.showCustomTopics
    ? room.customTopics
    : room.customTopics.filter((topic) => topic.createdBy === playerId)

  const customTopics: CustomTopicView[] = visibleTopics.map((topic) => ({
    id: topic.id,
    text: topic.text,
    min: topic.min,
    max: topic.max,
    isOwn: topic.createdBy === playerId,
  }))

  return {
    customTopics,
    customTopicCount: room.customTopics.length,
  }
}

function sendCustomTopicsToPlayers(room: Room) {
  for (const player of room.players) {
    io.to(player.id).emit(
      'customTopicsUpdated',
      getCustomTopicsForPlayer(room, player.id),
    )
  }
}

// =========================
// ゲーム進行ヘルパー
// =========================

function startVoteTimer(room: Room) {
  const voteTimeMs = VOTE_TIME_MS
  const phaseAtStart = room.phase

  room.voteEndsAt = Date.now() + voteTimeMs

  setTimeout(() => {
    const currentRoom = rooms.get(room.code)

    if (!currentRoom) {
      return
    }

    if (currentRoom.phase !== phaseAtStart) {
      return
    }

    if (currentRoom.phase !== 'VOTING' && currentRoom.phase !== 'REVOTING') {
      return
    }

    for (const player of currentRoom.players) {
      if (currentRoom.votes[player.id]) {
        continue
      }

      const targetId = currentRoom.voteDrafts[player.id]

      if (!targetId || targetId === player.id) {
        continue
      }

      const targetExists = currentRoom.players.some(
        (targetPlayer) => targetPlayer.id === targetId,
      )

      if (!targetExists) {
        continue
      }

      if (
        currentRoom.phase === 'REVOTING' &&
        !currentRoom.revoteCandidates.includes(targetId)
      ) {
        continue
      }

      currentRoom.votes[player.id] = targetId
    }

    currentRoom.voteDrafts = {}

    resolveVote(currentRoom)
  }, voteTimeMs)
}

function startVoting(room: Room, wasSkipped = false) {
  room.phase = 'VOTING'
  room.votes = {}
  room.voteDrafts = {}

  startVoteTimer(room)

  io.to(room.code).emit('votingStarted', {
    players: room.players,
    voteEndsAt: room.voteEndsAt ?? null,
    wasSkipped,
  })

  console.log(`投票開始: ${room.code}`)
}

function finishAnswering(room: Room) {
  if (room.phase !== 'ANSWERING' || !room.topic) {
    return
  }

  room.phase = 'DISCUSSION'
  room.answerEndsAt = undefined
  room.skipVotes = []

  startDiscussionTimer(room)

  const revealedAnswers = room.players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    answer: room.answers[player.id],
  }))

  io.to(room.code).emit('answerReveal', {
    topic: room.topic.text,
    min: room.topic.min,
    max: room.topic.max,
    answers: revealedAnswers,
    discussionEndsAt: room.discussionEndsAt ?? null,
    skipCount: 0,
    skipRequiredCount: getSkipRequiredCount(room),
  })
}

function startAnswerTimer(room: Room) {
  const answerTimeMs = ANSWER_TIME_MS

  room.answerEndsAt = Date.now() + answerTimeMs

  setTimeout(() => {
    const currentRoom = rooms.get(room.code)

    if (!currentRoom) {
      return
    }

    if (currentRoom.phase !== 'ANSWERING') {
      return
    }

    for (const player of currentRoom.players) {
      if (currentRoom.answers[player.id]) {
        continue
      }

      const draft = currentRoom.answerDrafts[player.id]

      currentRoom.answers[player.id] = draft ?? {
        type: 'TIMEOUT',
        value: null,
      }
    }

    currentRoom.answerDrafts = {}

    finishAnswering(currentRoom)
  }, answerTimeMs)
}

function startDiscussionTimer(room: Room) {
  if (room.discussionSeconds === null) {
    room.discussionEndsAt = undefined
    return
  }

  const discussionTimeMs = room.discussionSeconds * 1000

  room.discussionEndsAt = Date.now() + discussionTimeMs

  setTimeout(() => {
    const currentRoom = rooms.get(room.code)

    if (!currentRoom) {
      return
    }

    if (currentRoom.phase !== 'DISCUSSION') {
      return
    }

    startVoting(currentRoom)
  }, discussionTimeMs)
}

function countVotes(room: Room) {
  const counts: Record<string, number> = {}

  for (const player of room.players) {
    counts[player.id] = 0
  }

  for (const targetId of Object.values(room.votes)) {
    counts[targetId] = (counts[targetId] ?? 0) + 1
  }

  return counts
}

function finishGame(
  room: Room,
  executedPlayerId: string,
  voteCounts: Record<string, number>,
) {
  room.phase = 'RESULT'

  const executedPlayer = room.players.find(
    (player) => player.id === executedPlayerId,
  )

  const werewolf = room.players.find((player) => player.id === room.werewolfId)

  if (!executedPlayer || !werewolf) {
    return
  }

  const executedIsWerewolf = executedPlayer.id === room.werewolfId

  const gameResult: GameResult = {
    executedPlayer: {
      id: executedPlayer.id,
      name: executedPlayer.name,
    },

    executedRole: executedIsWerewolf ? 'WEREWOLF' : 'CITIZEN',

    werewolf: {
      id: werewolf.id,
      name: werewolf.name,
    },

    winner: executedIsWerewolf ? 'CITIZEN' : 'WEREWOLF',

    voteCounts: room.players.map((player) => ({
      playerId: player.id,
      playerName: player.name,
      votes: voteCounts[player.id] ?? 0,
      voters: room.players
        .filter((voter) => room.votes[voter.id] === player.id)
        .map((voter) => voter.name),
    })),
  }

  room.gameResult = gameResult

  io.to(room.code).emit('gameResult', gameResult)

  console.log(`ゲーム終了: ${room.code} / 処刑: ${executedPlayer.name}`)
}

function resolveVote(room: Room) {
  room.voteEndsAt = undefined
  const counts = countVotes(room)

  const candidateIds =
    room.phase === 'REVOTING'
      ? room.revoteCandidates
      : room.players.map((player) => player.id)

  let maxVotes = -1
  let topPlayers: string[] = []

  for (const playerId of candidateIds) {
    const votes = counts[playerId] ?? 0

    if (votes > maxVotes) {
      maxVotes = votes
      topPlayers = [playerId]
    } else if (votes === maxVotes) {
      topPlayers.push(playerId)
    }
  }

  // 最多得票者が1人なら処刑
  if (topPlayers.length === 1) {
    finishGame(room, topPlayers[0], counts)
    return
  }

  // 最初の投票で同票なら再投票
  if (room.phase === 'VOTING') {
    room.phase = 'REVOTING'
    room.revoteCandidates = topPlayers
    room.votes = {}
    room.voteDrafts = {}

    startVoteTimer(room)

    const candidates = room.players.filter((player) =>
      topPlayers.includes(player.id),
    )

    io.to(room.code).emit('revoteStarted', {
      candidates,
      voteEndsAt: room.voteEndsAt ?? null,
      totalCount: room.players.length,
    })

    console.log(
      `再投票: ${room.code} / 候補 ${candidates
        .map((player) => player.name)
        .join(', ')}`,
    )

    return
  }

  // 再投票でも同票ならランダム処刑
  const randomIndex = Math.floor(Math.random() * topPlayers.length)

  const executedPlayerId = topPlayers[randomIndex]

  finishGame(room, executedPlayerId, counts)
}

// =========================
// HTTP
// =========================

app.get('/health', (_req, res) => {
  res.status(200).send('ok')
})

if (IS_PRODUCTION) {
  const clientDistPath = path.resolve(__dirname, '../../client/dist')

  app.use(express.static(clientDistPath))

  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/socket.io')) {
      next()
      return
    }

    res.sendFile(path.join(clientDistPath, 'index.html'))
  })
} else {
  app.get('/', (_req, res) => {
    res.send('数字人狼サーバーは正常に動いています')
  })
}

// =========================
// Socket.IO
// =========================

io.on('connection', (socket) => {
  console.log(`プレイヤー接続: ${socket.id}`)

  // -------------------------
  // ルーム作成
  // -------------------------

  socket.on('createRoom', (data, callback) => {
    const username = data.username?.trim()

    const playerToken = data.playerToken?.trim()

    if (!playerToken) {
      callback({
        ok: false,
        message: 'プレイヤー情報を取得できませんでした',
      })
      return
    }

    if (!username) {
      callback({
        ok: false,
        message: 'ユーザー名を入力してください',
      })
      return
    }

    const roomCode = createUniqueRoomCode()

    const player: Player = {
      id: socket.id,
      name: username,
      isHost: true,
      isConnected: true,
    }

    const room: Room = {
      code: roomCode,
      hostId: socket.id,
      players: [player],

      playerTokens: {
        [socket.id]: playerToken,
      },

      phase: 'LOBBY',

      answers: {},
      answerDrafts: {},

      votes: {},
      voteDrafts: {},

      skipVotes: [],

      revoteCandidates: [],

      // 初期値3分
      discussionSeconds: 180,

      customTopics: [],
      topicSource: 'PRESET',
      showCustomTopics: false,
    }

    rooms.set(roomCode, room)

    socket.join(roomCode)

    callback({
      ok: true,
      roomCode,
      players: room.players,
      discussionSeconds: room.discussionSeconds,
      topicSource: room.topicSource,
      showCustomTopics: room.showCustomTopics,
      ...getCustomTopicsForPlayer(room, socket.id),
    })
    console.log(`ルーム作成: ${roomCode} / ホスト: ${username}`)
  })

  // -------------------------
  // ルーム参加
  // -------------------------

  socket.on('joinRoom', (data, callback) => {
    const username = data.username?.trim()

    const playerToken = data.playerToken?.trim()

    if (!playerToken) {
      callback({
        ok: false,
        message: 'プレイヤー情報を取得できませんでした',
      })
      return
    }

    const roomCode = data.roomCode?.trim().toUpperCase()

    if (!username) {
      callback({
        ok: false,
        message: 'ユーザー名を入力してください',
      })
      return
    }

    if (!roomCode) {
      callback({
        ok: false,
        message: 'ルームコードを入力してください',
      })
      return
    }

    const room = rooms.get(roomCode)

    if (!room) {
      callback({
        ok: false,
        message: 'ルームが見つかりません',
      })
      return
    }

    if (room.phase !== 'LOBBY') {
      callback({
        ok: false,
        message: '現在ゲーム進行中です',
      })
      return
    }

    const sameTokenExists = Object.values(room.playerTokens).some(
      (token) => token === playerToken,
    )

    if (sameTokenExists) {
      callback({
        ok: false,
        message: 'このブラウザはすでにこのルームに参加しています',
      })
      return
    }

    const sameNameExists = room.players.some(
      (player) => player.name.toLowerCase() === username.toLowerCase(),
    )

    if (sameNameExists) {
      callback({
        ok: false,
        message: 'そのユーザー名はすでに使用されています',
      })
      return
    }

    const player: Player = {
      id: socket.id,
      name: username,
      isHost: false,
      isConnected: true,
    }

    room.players.push(player)

    room.playerTokens[socket.id] = playerToken

    socket.join(roomCode)

    callback({
      ok: true,
      roomCode,
      players: room.players,
      discussionSeconds: room.discussionSeconds,
      topicSource: room.topicSource,
      showCustomTopics: room.showCustomTopics,
      ...getCustomTopicsForPlayer(room, socket.id),
    })

    emitRoomUpdated(room)

    console.log(`ルーム参加: ${roomCode} / ${username}`)
  })
  // -------------------------
  // ロビー退出
  // -------------------------

  socket.on('leaveRoom', (data, callback) => {
    const room = rooms.get(data.roomCode)

    if (!room) {
      callback({
        ok: false,
        message: 'ルームが見つかりません',
      })
      return
    }

    if (room.phase !== 'LOBBY') {
      callback({
        ok: false,
        message: 'ゲーム中は退出できません',
      })
      return
    }

    const player = room.players.find((player) => player.id === socket.id)

    if (!player) {
      callback({
        ok: false,
        message: 'このルームのプレイヤーではありません',
      })
      return
    }

    const wasHost = room.hostId === socket.id

    removePlayerData(room, socket.id)

    socket.leave(room.code)

    if (room.players.length === 0) {
      rooms.delete(room.code)

      callback({
        ok: true,
      })

      return
    }

    if (wasHost) {
      const newHost = room.players[0]

      setHost(room, newHost.id)
    }

    emitRoomUpdated(room)

    sendCustomTopicsToPlayers(room)

    callback({
      ok: true,
    })
  })

  // -------------------------
  // プレイヤーをキック
  // -------------------------

  socket.on('kickPlayer', (data, callback) => {
    const room = rooms.get(data.roomCode)

    if (!room) {
      callback({
        ok: false,
        message: 'ルームが見つかりません',
      })
      return
    }

    if (room.phase !== 'LOBBY') {
      callback({
        ok: false,
        message: 'ゲーム中はキックできません',
      })
      return
    }

    if (room.hostId !== socket.id) {
      callback({
        ok: false,
        message: 'キックできるのはホストだけです',
      })
      return
    }

    const targetId = data.targetId

    if (targetId === socket.id) {
      callback({
        ok: false,
        message: '自分自身はキックできません',
      })
      return
    }

    clearDisconnectTimer(targetId)

    const targetPlayer = room.players.find((player) => player.id === targetId)

    if (!targetPlayer) {
      callback({
        ok: false,
        message: 'プレイヤーが見つかりません',
      })
      return
    }

    removePlayerData(room, targetId)

    const targetSocket = io.sockets.sockets.get(targetId)

    if (targetSocket) {
      targetSocket.emit('kickedFromRoom')
      targetSocket.leave(room.code)
    }

    emitRoomUpdated(room)

    sendCustomTopicsToPlayers(room)

    callback({
      ok: true,
    })

    console.log(`プレイヤーをキック: ${room.code} / ${targetPlayer.name}`)
  })

  // -------------------------
  // 部屋解散
  // -------------------------

  socket.on('disbandRoom', (data, callback) => {
    const room = rooms.get(data.roomCode)

    if (!room) {
      callback({
        ok: false,
        message: 'ルームが見つかりません',
      })
      return
    }

    if (room.phase !== 'LOBBY') {
      callback({
        ok: false,
        message: 'ゲーム中は部屋を解散できません',
      })
      return
    }

    if (room.hostId !== socket.id) {
      callback({
        ok: false,
        message: '部屋を解散できるのはホストだけです',
      })
      return
    }

    socket.to(room.code).emit('roomDisbanded')

    io.in(room.code).socketsLeave(room.code)

    rooms.delete(room.code)

    callback({
      ok: true,
    })
  })

  socket.on('reconnectRoom', (data, callback) => {
    const roomCode = data.roomCode?.trim().toUpperCase()
    const playerToken = data.playerToken?.trim()

    if (!roomCode || !playerToken) {
      callback({
        ok: false,
        message: '再接続情報がありません',
      })
      return
    }

    const room = rooms.get(roomCode)

    if (!room) {
      callback({
        ok: false,
        message: 'ルームが見つかりません',
      })
      return
    }

    const tokenEntries = Object.entries(room.playerTokens).filter(
      ([, token]) => token === playerToken,
    )

    if (tokenEntries.length === 0) {
      callback({
        ok: false,
        message: '元のプレイヤーが見つかりません',
      })
      return
    }

    if (tokenEntries.length > 1) {
      callback({
        ok: false,
        message: 'プレイヤー情報が重複しているため再接続できません',
      })
      return
    }

    const oldSocketId = tokenEntries[0][0]

    const player = room.players.find((player) => player.id === oldSocketId)

    if (!player) {
      callback({
        ok: false,
        message: 'プレイヤー情報が見つかりません',
      })
      return
    }

    const newSocketId = socket.id

    clearDisconnectTimer(oldSocketId)

    player.isConnected = true

    // プレイヤーのSocket IDを新しいものに変更
    player.id = newSocketId

    // ホストだった場合
    if (room.hostId === oldSocketId) {
      room.hostId = newSocketId
    }

    // 人狼だった場合
    if (room.werewolfId === oldSocketId) {
      room.werewolfId = newSocketId
    }

    // 回答済みだった場合
    if (oldSocketId !== newSocketId && room.answers[oldSocketId]) {
      room.answers[newSocketId] = room.answers[oldSocketId]

      delete room.answers[oldSocketId]
    }

    // 回答の仮入力も新Socket IDへ移動
    if (oldSocketId !== newSocketId && room.answerDrafts[oldSocketId]) {
      room.answerDrafts[newSocketId] = room.answerDrafts[oldSocketId]

      delete room.answerDrafts[oldSocketId]
    }

    // 投票情報のSocket IDも置き換える
    const newVotes: Record<string, string> = {}

    for (const [voterId, targetId] of Object.entries(room.votes)) {
      const newVoterId = voterId === oldSocketId ? newSocketId : voterId

      const newTargetId = targetId === oldSocketId ? newSocketId : targetId

      newVotes[newVoterId] = newTargetId
    }

    room.votes = newVotes

    // 仮投票の投票者ID・投票先IDも置き換える
    const newVoteDrafts: Record<string, string> = {}

    for (const [voterId, targetId] of Object.entries(room.voteDrafts)) {
      const newVoterId = voterId === oldSocketId ? newSocketId : voterId
      const newTargetId = targetId === oldSocketId ? newSocketId : targetId

      newVoteDrafts[newVoterId] = newTargetId
    }

    room.voteDrafts = newVoteDrafts

    room.revoteCandidates = room.revoteCandidates.map((playerId) =>
      playerId === oldSocketId ? newSocketId : playerId,
    )

    room.skipVotes = room.skipVotes.map((playerId) =>
      playerId === oldSocketId ? newSocketId : playerId,
    )

    // 結果画面のプレイヤーIDも新Socket IDへ更新
    if (room.gameResult && oldSocketId !== newSocketId) {
      if (room.gameResult.executedPlayer.id === oldSocketId) {
        room.gameResult.executedPlayer.id = newSocketId
      }

      if (room.gameResult.werewolf.id === oldSocketId) {
        room.gameResult.werewolf.id = newSocketId
      }

      room.gameResult.voteCounts = room.gameResult.voteCounts.map((item) =>
        item.playerId === oldSocketId
          ? {
              ...item,
              playerId: newSocketId,
            }
          : item,
      )
    }

    // 投稿したカスタムお題の所有者も更新
    for (const topic of room.customTopics) {
      if (topic.createdBy === oldSocketId) {
        topic.createdBy = newSocketId
      }
    }

    // トークンも新Socket IDへ移動
    delete room.playerTokens[oldSocketId]

    room.playerTokens[newSocketId] = playerToken

    socket.join(room.code)

    const isWerewolf = room.werewolfId === newSocketId

    const hasAnswered = room.answers[newSocketId] !== undefined

    callback({
      ok: true,
      roomCode: room.code,
      players: room.players,
      phase: room.phase,

      discussionSeconds: room.discussionSeconds,
      topicSource: room.topicSource,
      showCustomTopics: room.showCustomTopics,

      ...getCustomTopicsForPlayer(room, newSocketId),

      ...(room.phase === 'ANSWERING' && room.topic
        ? {
            role: isWerewolf ? 'WEREWOLF' : 'CITIZEN',

            topic: isWerewolf ? null : room.topic.text,

            min: room.topic.min,
            max: room.topic.max,

            answerEndsAt: room.answerEndsAt ?? null,

            hasAnswered,
            answerDraft: room.answerDrafts[newSocketId] ?? null,

            answeredCount: Object.keys(room.answers).length,

            totalCount: room.players.length,
          }
        : {}),
      ...(room.phase === 'DISCUSSION' && room.topic
        ? {
            topic: room.topic.text,
            min: room.topic.min,
            max: room.topic.max,

            answers: room.players.map((player) => ({
              playerId: player.id,
              playerName: player.name,
              answer: room.answers[player.id],
            })),

            discussionEndsAt: room.discussionEndsAt ?? null,
            skipCount: room.skipVotes.length,
            skipRequiredCount: getSkipRequiredCount(room),
            hasSkipped: room.skipVotes.includes(newSocketId),
          }
        : {}),

      ...(room.phase === 'VOTING' || room.phase === 'REVOTING'
        ? {
            voteCandidates:
              room.phase === 'REVOTING'
                ? room.players.filter((player) =>
                    room.revoteCandidates.includes(player.id),
                  )
                : room.players,

            hasVoted: room.votes[newSocketId] !== undefined,
            voteDraft: room.voteDrafts[newSocketId] ?? null,

            votedCount: Object.keys(room.votes).length,

            voteTotalCount: room.players.length,

            isRevote: room.phase === 'REVOTING',
            voteEndsAt: room.voteEndsAt ?? null,
          }
        : {}),

      ...(room.phase === 'RESULT'
        ? {
            gameResult: room.gameResult,
          }
        : {}),
    })

    emitRoomUpdated(room)

    if (room.phase === 'VOTING') {
      io.to(room.code).emit('voteCandidatesUpdated', {
        candidates: room.players,
      })
    }

    if (room.phase === 'REVOTING') {
      const candidates = room.players.filter((player) =>
        room.revoteCandidates.includes(player.id),
      )

      io.to(room.code).emit('voteCandidatesUpdated', {
        candidates,
      })
    }

    // 他プレイヤーの再接続で投票先IDが変わった場合も、本人にだけ最新の仮選択を返す
    for (const roomPlayer of room.players) {
      io.to(roomPlayer.id).emit('draftStateUpdated', {
        answerDraft: room.answerDrafts[roomPlayer.id] ?? null,
        voteDraft: room.voteDrafts[roomPlayer.id] ?? null,
      })
    }

    console.log(`再接続: ${room.code} / ${player.name}`)
  })
  // -------------------------
  // ホスト設定変更
  // -------------------------

  socket.on('updateSettings', (data, callback) => {
    const room = rooms.get(data.roomCode)

    if (!room) {
      callback({
        ok: false,
        message: 'ルームが見つかりません',
      })
      return
    }

    if (room.hostId !== socket.id) {
      callback({
        ok: false,
        message: '設定を変更できるのはホストだけです',
      })
      return
    }

    if (room.phase !== 'LOBBY') {
      callback({
        ok: false,
        message: 'ゲーム中は設定を変更できません',
      })
      return
    }

    // 話し合い時間
    if (data.discussionSeconds !== undefined) {
      const allowedTimes = [60, 120, 180, 300, null]

      if (!allowedTimes.includes(data.discussionSeconds)) {
        callback({
          ok: false,
          message: '無効な話し合い時間です',
        })
        return
      }

      room.discussionSeconds = data.discussionSeconds
    }

    // 出題元
    if (data.topicSource !== undefined) {
      const allowedSources: TopicSource[] = ['PRESET', 'CUSTOM', 'BOTH']

      if (!allowedSources.includes(data.topicSource)) {
        callback({
          ok: false,
          message: '無効な出題設定です',
        })
        return
      }

      room.topicSource = data.topicSource
    }

    // カスタムお題の公開・非公開
    if (data.showCustomTopics !== undefined) {
      if (typeof data.showCustomTopics !== 'boolean') {
        callback({
          ok: false,
          message: '無効なお題公開設定です',
        })
        return
      }

      room.showCustomTopics = data.showCustomTopics
    }

    io.to(room.code).emit('settingsUpdated', {
      discussionSeconds: room.discussionSeconds,
      topicSource: room.topicSource,
      showCustomTopics: room.showCustomTopics,
    })

    // 公開設定が変わった場合も含め、
    // 各プレイヤーに見えてよいお題だけ再送する
    sendCustomTopicsToPlayers(room)

    callback({
      ok: true,
    })
  })

  // -------------------------
  // 制限なし時にホストが投票へ進む
  // -------------------------

  socket.on('endDiscussion', (data, callback) => {
    const room = rooms.get(data.roomCode)

    if (!room) {
      callback({
        ok: false,
        message: 'ルームが見つかりません',
      })
      return
    }

    if (room.hostId !== socket.id) {
      callback({
        ok: false,
        message: '操作できるのはホストだけです',
      })
      return
    }

    if (room.phase !== 'DISCUSSION') {
      callback({
        ok: false,
        message: '現在は話し合い中ではありません',
      })
      return
    }

    if (room.discussionSeconds !== null) {
      callback({
        ok: false,
        message: '時間制限ありの場合は自動で投票へ進みます',
      })
      return
    }

    startVoting(room)

    callback({
      ok: true,
    })
  })

  // -------------------------
  // 話し合いスキップ
  // -------------------------

  socket.on('toggleDiscussionSkip', (data, callback) => {
    const room = rooms.get(data.roomCode)

    if (!room) {
      callback({
        ok: false,
        message: 'ルームが見つかりません',
      })
      return
    }

    if (room.phase !== 'DISCUSSION') {
      callback({
        ok: false,
        message: '現在は話し合い中ではありません',
      })
      return
    }

    const isMember = room.players.some((player) => player.id === socket.id)

    if (!isMember) {
      callback({
        ok: false,
        message: 'このルームのプレイヤーではありません',
      })
      return
    }

    const alreadySkipped = room.skipVotes.includes(socket.id)

    if (alreadySkipped) {
      room.skipVotes = room.skipVotes.filter(
        (playerId) => playerId !== socket.id,
      )
    } else {
      room.skipVotes.push(socket.id)
    }

    const skipCount = room.skipVotes.length
    const skipRequiredCount = getSkipRequiredCount(room)

    io.to(room.code).emit('discussionSkipUpdated', {
      skipCount,
      skipRequiredCount,
    })

    callback({
      ok: true,
      hasSkipped: !alreadySkipped,
    })

    if (skipCount >= skipRequiredCount) {
      startVoting(room, true)
    }
  })

  socket.on('addCustomTopic', (data, callback) => {
    const room = rooms.get(data.roomCode)

    if (!room) {
      callback({
        ok: false,
        message: 'ルームが見つかりません',
      })
      return
    }

    if (room.phase !== 'LOBBY') {
      callback({
        ok: false,
        message: 'ゲーム中はお題を追加できません',
      })
      return
    }

    if (room.topicSource === 'PRESET') {
      callback({
        ok: false,
        message: '現在の設定ではカスタムお題を追加できません',
      })
      return
    }

    const isMember = room.players.some((player) => player.id === socket.id)

    if (!isMember) {
      callback({
        ok: false,
        message: 'このルームのプレイヤーではありません',
      })
      return
    }

    const text = data.text?.trim()

    const min = Number(data.min)

    const max = Number(data.max)

    if (!text) {
      callback({
        ok: false,
        message: 'お題を入力してください',
      })
      return
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      callback({
        ok: false,
        message: '最小値と最大値を数字で入力してください',
      })
      return
    }

    if (min >= max) {
      callback({
        ok: false,
        message: '最大値は最小値より大きくしてください',
      })
      return
    }

    const topic: CustomTopic = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,

      text,
      min,
      max,
      createdBy: socket.id,
    }

    room.customTopics.push(topic)

    sendCustomTopicsToPlayers(room)

    callback({
      ok: true,
    })
  })

  socket.on('deleteCustomTopic', (data, callback) => {
    const room = rooms.get(data.roomCode)

    if (!room) {
      callback({
        ok: false,
        message: 'ルームが見つかりません',
      })
      return
    }

    if (room.phase !== 'LOBBY') {
      callback({
        ok: false,
        message: 'ゲーム中はお題を削除できません',
      })
      return
    }

    const topic = room.customTopics.find((topic) => topic.id === data.topicId)

    if (!topic) {
      callback({
        ok: false,
        message: 'お題が見つかりません',
      })
      return
    }

    const canDelete = topic.createdBy === socket.id || room.hostId === socket.id

    if (!canDelete) {
      callback({
        ok: false,
        message: 'このお題を削除する権限がありません',
      })
      return
    }

    room.customTopics = room.customTopics.filter(
      (topic) => topic.id !== data.topicId,
    )

    sendCustomTopicsToPlayers(room)

    callback({
      ok: true,
    })
  })

  socket.on('clearCustomTopics', (data, callback) => {
    const room = rooms.get(data.roomCode)

    if (!room) {
      callback({
        ok: false,
        message: 'ルームが見つかりません',
      })
      return
    }

    if (room.hostId !== socket.id) {
      callback({
        ok: false,
        message: 'すべて削除できるのはホストだけです',
      })
      return
    }

    if (room.phase !== 'LOBBY') {
      callback({
        ok: false,
        message: 'ゲーム中はお題を削除できません',
      })
      return
    }

    room.customTopics = []

    sendCustomTopicsToPlayers(room)

    callback({
      ok: true,
    })
  })

  // -------------------------
  // ゲーム開始
  // -------------------------

  socket.on('startGame', (data, callback) => {
    const room = rooms.get(data.roomCode)

    if (!room) {
      callback({
        ok: false,
        message: 'ルームが見つかりません',
      })
      return
    }

    if (room.hostId !== socket.id) {
      callback({
        ok: false,
        message: 'ゲームを開始できるのはホストだけです',
      })
      return
    }

    if (room.phase !== 'LOBBY') {
      callback({
        ok: false,
        message: '現在ゲームを開始できません',
      })
      return
    }

    if (room.players.length < MIN_PLAYERS) {
      callback({
        ok: false,
        message: 'ゲーム開始には3人以上必要です',
      })
      return
    }

    let availableTopics: Topic[] = []

    if (room.topicSource === 'PRESET') {
      availableTopics = PRESET_TOPICS
    }

    if (room.topicSource === 'CUSTOM') {
      availableTopics = room.customTopics
    }

    if (room.topicSource === 'BOTH') {
      availableTopics = [...PRESET_TOPICS, ...room.customTopics]
    }

    if (availableTopics.length === 0) {
      callback({
        ok: false,
        message: 'カスタムお題が1件以上必要です',
      })
      return
    }

    const randomPlayerIndex = Math.floor(Math.random() * room.players.length)

    const werewolf = room.players[randomPlayerIndex]

    const randomTopicIndex = Math.floor(Math.random() * availableTopics.length)

    const selectedTopic = availableTopics[randomTopicIndex]

    room.werewolfId = werewolf.id
    room.topic = selectedTopic

    room.phase = 'ANSWERING'

    room.answers = {}
    room.answerDrafts = {}

    room.votes = {}
    room.voteDrafts = {}

    room.skipVotes = []
    room.revoteCandidates = []
    room.gameResult = undefined
    startAnswerTimer(room)

    for (const player of room.players) {
      const isWerewolf = player.id === room.werewolfId

      io.to(player.id).emit('gameStarted', {
        role: isWerewolf ? 'WEREWOLF' : 'CITIZEN',

        topic: isWerewolf ? null : room.topic.text,

        min: room.topic.min,
        max: room.topic.max,
        answerEndsAt: room.answerEndsAt ?? null,
      })
    }

    console.log(
      `ゲーム開始: ${room.code} / 人狼: ${werewolf.name} / お題: ${room.topic.text}`,
    )

    callback({
      ok: true,
    })
  })

  // -------------------------
  // 回答
  // -------------------------

  socket.on('updateAnswerDraft', (data) => {
    const room = rooms.get(data.roomCode)

    if (!room || !room.topic || room.phase !== 'ANSWERING') {
      return
    }

    const playerExists = room.players.some((player) => player.id === socket.id)

    if (!playerExists || room.answers[socket.id]) {
      return
    }

    if (data.type === 'CLEAR') {
      delete room.answerDrafts[socket.id]
      return
    }

    if (data.type === 'OVER_MAX') {
      room.answerDrafts[socket.id] = {
        type: 'OVER_MAX',
        value: null,
      }
      return
    }

    if (data.type !== 'NUMBER') {
      return
    }

    const rawValue = String(data.value ?? '').trim()
    const value = Number(rawValue)

    if (
      rawValue === '' ||
      !Number.isFinite(value) ||
      value < room.topic.min ||
      value > room.topic.max
    ) {
      delete room.answerDrafts[socket.id]
      return
    }

    room.answerDrafts[socket.id] = {
      type: 'NUMBER',
      value,
    }
  })

  socket.on('submitAnswer', (data, callback) => {
    const room = rooms.get(data.roomCode)

    if (!room || !room.topic) {
      callback({
        ok: false,
        message: 'ゲーム情報が見つかりません',
      })
      return
    }

    if (room.phase !== 'ANSWERING') {
      callback({
        ok: false,
        message: '現在は回答できません',
      })
      return
    }

    const playerExists = room.players.some((player) => player.id === socket.id)

    if (!playerExists) {
      callback({
        ok: false,
        message: 'このルームのプレイヤーではありません',
      })
      return
    }

    if (room.answers[socket.id]) {
      callback({
        ok: false,
        message: '回答はすでに確定しています',
      })
      return
    }

    let answer: Answer

    if (data.type === 'OVER_MAX') {
      answer = {
        type: 'OVER_MAX',
        value: null,
      }
    } else {
      const value = Number(data.value)

      if (!Number.isFinite(value)) {
        callback({
          ok: false,
          message: '数字を入力してください',
        })
        return
      }

      if (value < room.topic.min || value > room.topic.max) {
        callback({
          ok: false,
          message: `回答は${room.topic.min}〜${room.topic.max}の範囲で入力してください`,
        })
        return
      }

      answer = {
        type: 'NUMBER',
        value,
      }
    }

    room.answers[socket.id] = answer
    delete room.answerDrafts[socket.id]

    const answeredCount = Object.keys(room.answers).length

    callback({
      ok: true,
    })

    io.to(room.code).emit('answerProgress', {
      answeredCount,
      totalCount: room.players.length,
    })

    if (answeredCount === room.players.length) {
      finishAnswering(room)
    }
  })

  // -------------------------
  // 投票
  // -------------------------

  socket.on('updateVoteDraft', (data) => {
    const room = rooms.get(data.roomCode)

    if (!room) {
      return
    }

    if (room.phase !== 'VOTING' && room.phase !== 'REVOTING') {
      return
    }

    if (room.votes[socket.id]) {
      return
    }

    const targetId = String(data.targetId ?? '')

    if (!targetId || targetId === socket.id) {
      return
    }

    const targetExists = room.players.some((player) => player.id === targetId)

    if (!targetExists) {
      return
    }

    if (
      room.phase === 'REVOTING' &&
      !room.revoteCandidates.includes(targetId)
    ) {
      return
    }

    room.voteDrafts[socket.id] = targetId
  })

  socket.on('submitVote', (data, callback) => {
    const room = rooms.get(data.roomCode)

    if (!room) {
      callback({
        ok: false,
        message: 'ルームが見つかりません',
      })
      return
    }

    if (room.phase !== 'VOTING' && room.phase !== 'REVOTING') {
      callback({
        ok: false,
        message: '現在は投票できません',
      })
      return
    }

    if (room.votes[socket.id]) {
      callback({
        ok: false,
        message: 'すでに投票済みです',
      })
      return
    }

    const targetId = data.targetId

    if (targetId === socket.id) {
      callback({
        ok: false,
        message: '自分自身には投票できません',
      })
      return
    }

    const targetExists = room.players.some((player) => player.id === targetId)

    if (!targetExists) {
      callback({
        ok: false,
        message: '投票先が見つかりません',
      })
      return
    }

    if (
      room.phase === 'REVOTING' &&
      !room.revoteCandidates.includes(targetId)
    ) {
      callback({
        ok: false,
        message: '再投票候補者に投票してください',
      })
      return
    }

    room.votes[socket.id] = targetId
    delete room.voteDrafts[socket.id]

    const votedCount = Object.keys(room.votes).length

    callback({
      ok: true,
    })

    io.to(room.code).emit('voteProgress', {
      votedCount,
      totalCount: room.players.length,
    })

    if (votedCount === room.players.length) {
      resolveVote(room)
    }
  })

  // -------------------------
  // 次のゲーム
  // -------------------------

  socket.on('nextGame', (data, callback) => {
    const room = rooms.get(data.roomCode)

    if (!room) {
      callback({
        ok: false,
        message: 'ルームが見つかりません',
      })
      return
    }

    if (room.hostId !== socket.id) {
      callback({
        ok: false,
        message: '次のゲームを開始できるのはホストだけです',
      })
      return
    }

    if (room.phase !== 'RESULT') {
      callback({
        ok: false,
        message: 'まだゲームが終了していません',
      })
      return
    }

    const disconnectedPlayerIds = room.players
      .filter((player) => !player.isConnected)
      .map((player) => player.id)

    room.players = room.players.filter((player) => player.isConnected)

    for (const playerId of disconnectedPlayerIds) {
      delete room.playerTokens[playerId]

      room.customTopics = room.customTopics.filter(
        (topic) => topic.createdBy !== playerId,
      )
    }

    if (!room.players.some((player) => player.id === room.hostId)) {
      const newHost = room.players[0]

      if (newHost) {
        room.hostId = newHost.id

        room.players = room.players.map((player) => ({
          ...player,
          isHost: player.id === newHost.id,
        }))
      }
    }

    room.phase = 'LOBBY'

    room.werewolfId = undefined
    room.topic = undefined
    room.gameResult = undefined

    room.answers = {}
    room.answerDrafts = {}

    room.votes = {}
    room.voteDrafts = {}

    room.skipVotes = []

    room.revoteCandidates = []

    room.voteEndsAt = undefined
    room.discussionEndsAt = undefined

    io.to(room.code).emit('backToLobby', {
      players: room.players,

      discussionSeconds: room.discussionSeconds,
    })

    callback({
      ok: true,
    })

    console.log(`ロビーへ戻る: ${room.code}`)
  })

  // -------------------------
  // 切断
  // -------------------------

  socket.on('disconnect', () => {
    console.log(`プレイヤー切断: ${socket.id}`)

    for (const room of rooms.values()) {
      const player = room.players.find(
        (roomPlayer) => roomPlayer.id === socket.id,
      )

      if (!player) {
        continue
      }

      player.isConnected = false

      io.to(room.code).emit('roomUpdated', {
        players: room.players,
      })

      const disconnectedSocketId = socket.id

      const timer = setTimeout(() => {
        disconnectTimers.delete(disconnectedSocketId)

        const currentRoom = rooms.get(room.code)

        if (!currentRoom) {
          return
        }

        const disconnectedPlayer = currentRoom.players.find(
          (roomPlayer) => roomPlayer.id === disconnectedSocketId,
        )

        if (!disconnectedPlayer || disconnectedPlayer.isConnected) {
          return
        }

        // ロビーなら15秒後に完全退出
        if (currentRoom.phase === 'LOBBY') {
          const wasHost = currentRoom.hostId === disconnectedSocketId

          removePlayerData(currentRoom, disconnectedSocketId)

          if (currentRoom.players.length === 0) {
            rooms.delete(currentRoom.code)
            return
          }

          if (wasHost) {
            const newHost =
              currentRoom.players.find(
                (roomPlayer) => roomPlayer.isConnected,
              ) ?? currentRoom.players[0]

            setHost(currentRoom, newHost.id)
          }

          io.to(currentRoom.code).emit('roomUpdated', {
            players: currentRoom.players,
          })

          sendCustomTopicsToPlayers(currentRoom)

          console.log(
            `切断タイムアウトで退出: ${currentRoom.code} / ${disconnectedPlayer.name}`,
          )

          return
        }

        // ゲーム中は削除せず、ホストだけ必要なら移譲
        if (currentRoom.hostId === disconnectedSocketId) {
          const newHost = currentRoom.players.find(
            (roomPlayer) => roomPlayer.isConnected,
          )

          if (newHost) {
            setHost(currentRoom, newHost.id)

            emitRoomUpdated(currentRoom)
          }
        }
      }, DISCONNECT_GRACE_MS)

      disconnectTimers.set(disconnectedSocketId, timer)

      break
    }
  })
})

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`サーバー起動: port ${PORT}`)
})
