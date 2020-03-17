const readLine = require('readline')
const fetch = require('node-fetch')
const moment = require('moment-timezone')
const Iconv = require('iconv').Iconv
const clc = require('cli-color')

// OSの取得
const isWindows = process.platform === 'win32'
const isMac = process.platform === 'darwin'
const isLinux = process.platform === 'linux'

// 文字コード変換の準備
const iconv = new Iconv('UTF-8', 'SHIFT_JIS//IGNORE')

// color設定
const inf = clc.xterm(83)
const st = clc.xterm(50)
const er = clc.xterm(204)

let config
try {
  config = require('./config.json')
} catch (err) {
  console.error(er('cannot find config.json file'))
  process.exit()
}

const KEY = config.KEY
const TOKEN = config.TOKEN
const USERNAME = config.USERNAME

const FIRSTDATETIME = config.FIRSTDATETIME
const INTERVAL_HOUR = config.INTERVAL_HOUR

const BOARDS_URL = `https://trello.com/1/members/${USERNAME}/boards?key=${KEY}&token=${TOKEN}&fields=name,memberships`
const MEMBERS_URL = `https://trello.com/1/members/$$MEMBER_ID$$/?fields=fullName,username&key=${KEY}&token=${TOKEN}`
const LISTS_URL = `https://trello.com/1/boards/$$BOARD_ID$$/lists?fields=name,url&key=${KEY}&token=${TOKEN}`
const CARDS_URL = `https://trello.com/1/lists/$$LIST_ID$$/cards?key=${KEY}&token=${TOKEN}&fields=name,labels,idMembers,desc`
const ACTIONS_URL = `https://trello.com/1/cards/$$CARD_ID$$/actions?key=${KEY}&token=${TOKEN}&filter=all`

// Debugの出力を抑止
console.debug = () => {}

const readUserInput = (question, initialInput) => {
  const rl = readLine.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve, reject) => {
    rl.question(question, answer => {
      resolve(answer)
      rl.close()
    })
    if (initialInput) {
      rl.write(initialInput)
    }
  })
}

const inputText = async (questionText, re, initialInput) => {
  while (true) {
    let a = await readUserInput(questionText, initialInput)
    if (a.match(re)) {
      return a
    } else {
      console.log(er('error: invalid input'))
    }
  }
}

const getDataFromTrello = async url => {
  let response = await fetch(url)
  return await response.json()
}

const writeLine = d => {
  let inDate = moment(d.inDate)
    .tz('Asia/Tokyo')
    .format('YYYY/MM/DD HH:mm:ss')
  let outDate = moment(d.outDate)
    .tz('Asia/Tokyo')
    .format('YYYY/MM/DD HH:mm:ss')
  let line = `"${d.cardId}","${d.number}","${d.title}","${d.point}","${d.listName}","${inDate}","${outDate}","${d.time}","${d.labelPink}","${d.labelGreen}","${d.member}"`
  if (isWindows) {
    line = iconv.convert(line).toString()
  }
  console.log(line)
}

const parseData = (actionMap, cardsMap) => {
  let list = []
  for (const key in actionMap) {
    const actions = actionMap[key]
    let cardId = cardsMap[key].id
    let labels = cardsMap[key].labelsMap
    let cardName = cardsMap[key].name
    let matched = cardName.match('^#([0-9]+)[ |:](.+)')
    let number = matched && matched[1] ? matched[1].trim() : '-'
    let title = matched && matched[2] ? matched[2].trim() : cardName
    let member = cardsMap[key].membersText ? cardsMap[key].membersText : '-'
    let desc = cardsMap[key].desc
    let point = 0
    if (desc && desc.match('(Point|point|POINT) *: *([0-9]+)')) {
      point = Number(desc.match('(Point|point|POINT) *: *([0-9]+)')[2])
    }
    let current
    for (let i = actions.length - 1; i >= 0; i--) {
      const a = actions[i]
      let listName = a.data.list ? a.data.list.name : '-'
      let date = new Date(a.date)
      if (!current) {
        current = {
          cardId,
          number,
          title,
          point,
          listName,
          inDate: date,
          labelPink: labels['pink'] ? labels['pink'] : '-',
          labelGreen: labels['green']
            ? labels['green']
            : labels['lime']
            ? labels['lime']
            : '-',
          member
        }
      }
      if (a.data.listBefore) {
        current['listName'] = a.data.listBefore.name
        current['outDate'] = new Date(a.date)
        current['time'] =
          (current['outDate'].getTime() - current['inDate'].getTime()) /
          1000 /
          60 /
          60
        list.push(JSON.parse(JSON.stringify(current)))
      }
      if (a.data.listAfter) {
        current = {
          cardId,
          number,
          point,
          title,
          listName: a.data.listAfter.name,
          inDate: new Date(a.date),
          labelPink: labels['pink'] ? labels['pink'] : '-',
          labelGreen: labels['green']
            ? labels['green']
            : labels['lime']
            ? labels['lime']
            : '-',
          member
        }
      }
    }
    if (current) {
      current['outDate'] = new Date()
      current['time'] =
        (current['outDate'].getTime() - current['inDate'].getTime()) /
        1000 /
        60 /
        60
      list.push(JSON.parse(JSON.stringify(current)))
    }
  }
  return list
}

const writeList = (list, showiingData) => {
  console.log(
    'cardId,number,title,point,listName,inDate,outDate,time,labelPink,labelGreen,member'
  )
  let total = 0
  let cardPointMap = {}
  for (let d of list) {
    writeLine(d)
    total += new Date(d.outDate).getTime() - new Date(d.inDate).getTime()
    cardPointMap[d.cardId] = d.point
  }
  let totalPoint = 0
  for (let k in cardPointMap) {
    totalPoint += cardPointMap[k]
  }
  console.log(`total: ${total / 1000 / 60 / 60} hrs`)
  console.log(`total point: ${totalPoint}`)
}

const writeListGroup = (list, groupby) => {
  console.log(`${groupby},totalPoint,totalTime`)
  let total = 0
  let timesByGroup = {}
  let relatedCardIds = {}
  let pointsByGroup = {}
  let cardPointMap = {}
  for (let d of list) {
    total += new Date(d.outDate).getTime() - new Date(d.inDate).getTime()
    cardPointMap[d.cardId] = d.point
    timesByGroup[d[groupby]] = timesByGroup[d[groupby]]
      ? timesByGroup[d[groupby]] + d.time
      : d.time
    if (!relatedCardIds[d[groupby]] || !relatedCardIds[d[groupby]][d.cardId]) {
      pointsByGroup[d[groupby]] = pointsByGroup[d[groupby]]
        ? pointsByGroup[d[groupby]] + d.point
        : d.point
      if (!relatedCardIds[d[groupby]]) {
        relatedCardIds[d[groupby]] = {}
      }
      relatedCardIds[d[groupby]][d.cardId] = d.cardId
    }
  }
  let totalPoint = 0
  for (let k in cardPointMap) {
    totalPoint += cardPointMap[k]
  }
  for (let k in timesByGroup) {
    console.log(`"${k}","${pointsByGroup[k]}","${timesByGroup[k]}"`)
  }
  console.log(`total: ${total / 1000 / 60 / 60} hrs`)
  console.log(`total point: ${totalPoint}`)
}

const main = async () => {
  try {
    // Board一覧取得
    let boardList = await getDataFromTrello(BOARDS_URL)
    console.debug('boardList:', JSON.stringify(boardList, true, '  '))
    // Board一覧表示
    let num = 1
    for (const item of boardList) {
      console.log(inf(`${num++}: ${item.name}`))
    }
    // Board選択
    let i = await inputText('select board by number: ', `^[1-${num - 1}]$`)
    const selectedBoard = boardList[Number(i - 1)]
    // User取得
    let memberMap = {}
    const memberships = selectedBoard.memberships
    for (const m of memberships) {
      memberMap[m.idMember] = await getDataFromTrello(
        MEMBERS_URL.replace('$$MEMBER_ID$$', m.idMember)
      )
    }
    console.debug('members:', memberMap)
    // List
    let lists = await getDataFromTrello(
      LISTS_URL.replace('$$BOARD_ID$$', selectedBoard.id)
    )
    // 全カード取得
    let cards = []
    for (const item of lists) {
      let list = await getDataFromTrello(
        CARDS_URL.replace('$$LIST_ID$$', item.id)
      )
      cards = cards.concat(list)
    }
    console.debug('cards:', JSON.stringify(cards, true, '  '))
    // カードに対するActionを取得
    let actionMap = {}
    let cardsMap = {}
    for (const c of cards) {
      actionMap[c.id] = await getDataFromTrello(
        ACTIONS_URL.replace('$$CARD_ID$$', c.id)
      )
      if (c.idMembers) {
        let members = []
        for (const m of c.idMembers) {
          members.push(memberMap[m].fullName)
        }
        c['membersText'] = members.join(',')
      }
      labelsMap = {}
      if (c.labels) {
        for (const l of c.labels) {
          labelsMap[l.color] = l.name
        }
      }
      c['labelsMap'] = labelsMap
      cardsMap[c.id] = c
    }
    console.debug('actionMap:', JSON.stringify(actionMap, true, '  '))
    // Parse
    let list = parseData(actionMap, cardsMap)
    // 出力内容選択
    let initialCondition = ''
    let groupby = ''
    let showingList = [
      'cardId',
      'number',
      'title',
      'point',
      'listName',
      'inDate',
      'outDate',
      'time',
      'labelPink',
      'labelGreen',
      'member'
    ]
    while (true) {
      console.log(inf('----------'))
      console.log(inf('1: set "group by" for "2"'))
      console.log(inf('2: input filter and show data'))
      console.log(inf('3: remaining number of issues and points'))
      console.log(st(`current group by: ${groupby}`))
      const type = await inputText('select: ', `^[1-3]$`)
      if (type === '1') {
        console.log(
          inf('specify variable name, empty string means no group by')
        )
        console.log(inf(`  variable names: ${showingList.toString()}`))
        groupbyText = await inputText('group by: ', `.*`, groupby)
        try {
          const cardId = 'cardId',
            number = 'number',
            title = 'title',
            point = 'point',
            listName = 'listName',
            inDate = 'inDate',
            outDate = 'outDate',
            time = 'time',
            labelPink = 'labelPink',
            labelGreen = 'labelGreen',
            member = 'member',
            totalTime = 'totalTime'
          if (groupbyText === '') {
            groupbyText = '""'
          }
          groupby = eval(groupbyText)
        } catch (err) {
          console.error(er(err))
        }
      } else if (type === '2') {
        console.log(
          inf(
            'specify filter by javascript condition, the following variables are available, "true" means showing all data'
          )
        )
        console.log(inf(`  variable names: ${showingList.toString()}`))
        const condition = await inputText(
          'input condition: ',
          `.+`,
          initialCondition
        )
        console.log(inf('----------'))
        let newList = []
        let total = 0
        for (let d of list) {
          const all = true
          const header = false
          let {
            cardId,
            number,
            title,
            point,
            listName,
            inDate,
            outDate,
            time,
            labelPink,
            labelGreen,
            member
          } = d
          inDate = new Date(inDate)
          outDate = new Date(outDate)
          try {
            if (eval(condition)) {
              newList.push(d)
            }
          } catch (err) {
            console.error(er(err))
            break
          }
        }
        if (groupby !== '') {
          writeListGroup(newList, groupby)
        } else {
          writeList(newList, showingList)
        }
        initialCondition = condition
      } else if (type === '3') {
        const firstDateTime = new Date(FIRSTDATETIME).getTime()
        const interval = INTERVAL_HOUR * 60 * 60 * 1000
        const currentTime = Date.now()
        console.log(
          '"datetime","all issues","all points","done issues","done points","remaining issues","remaining points"'
        )
        for (let time = firstDateTime; time < currentTime; time += interval) {
          let numberOfAllCards = 0
          let allPoints = 0
          let numberOfDoneCards = 0
          let donePoints = 0
          for (let d of list) {
            let inDate = new Date(d.inDate)
            let outDate = new Date(d.outDate)
            if (
              inDate.getTime() < time &&
              time < outDate &&
              d.listName !== 'Tasks'
            ) {
              numberOfAllCards++
              allPoints += d.point
              if (d.listName === 'Done') {
                numberOfDoneCards++
                donePoints += d.point
              }
            }
          }
          console.log(
            `"${moment(time).format(
              'YYYY-MM-DD HH:mm'
            )}","${numberOfAllCards}","${allPoints}","${numberOfDoneCards}","${donePoints}","${numberOfAllCards -
              numberOfDoneCards}","${allPoints - donePoints}"`
          )
        }
      }
    }
  } catch (err) {
    console.error(er(err))
  }
}

main()
