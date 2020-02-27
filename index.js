const readLine = require('readline')
const fetch = require('node-fetch')
const moment = require('moment-timezone')

if (process.argv.length !== 5) {
  console.error(
    'usage: node index.js <Trello KEY> <Trello TOKEN> <Trello USERNAME>'
  )
  process.exit()
}

const KEY = process.argv[2]
const TOKEN = process.argv[3]
const USERNAME = process.argv[4]

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
    if (a && a.match(re)) {
      return a
    } else {
      console.log('error: invalid input')
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
  console.log(
    `"${d.cardId}","${d.number}","${d.title}","${d.point}","${d.listName}","${inDate}","${outDate}","${d.time}","${d.labelPink}","${d.labelGreen}","${d.member}"`
  )
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

const writeList = list => {
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

const main = async () => {
  try {
    // Board一覧取得
    let boardList = await getDataFromTrello(BOARDS_URL)
    console.debug('boardList:', JSON.stringify(boardList, true, '  '))
    // Board一覧表示
    let num = 1
    for (const item of boardList) {
      console.log(`${num++}: ${item.name}`)
    }
    // Board選択
    let i = await inputText('select board number: ', `^[1-${num - 1}]$`)
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
    while (true) {
      console.log('----------')
      console.log('0: Show only header')
      console.log('1: All')
      console.log('2: Specify condition by js')
      const type = await inputText('Select output data: ', `^[0-2]$`)
      if (type === '0') {
        console.log('----------')
        console.log(
          'cardId,number,title,point,listName,inDate,outDate,time,labelPink,labelGreen,member'
        )
      } else if (type === '1') {
        console.log('----------')
        writeList(list)
      } else if (type === '2') {
        const condition = await inputText(
          'input condition by js: ',
          `.+`,
          initialCondition
        )
        console.log('----------')
        let newList = []
        let total = 0
        for (let d of list) {
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
            console.error(err)
            break
          }
        }
        writeList(newList)
        initialCondition = condition
      }
    }
  } catch (err) {
    console.error(err)
  }
}

main()
