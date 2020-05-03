const readLine = require('readline')
const clc = require('cli-color')
const fs = require('fs')
const open = require('open')
const TrelloCSV = require('./lib/trello-csv')

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

const NOW = Date.now()

// Debugの出力を抑止
console.debug = () => {}

const readUserInput = (question, initialInput) => {
  const rl = readLine.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve, reject) => {
    rl.question(question, (answer) => {
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

const writeList = (trelloCsv, list) => {
  let csv = trelloCsv.makeCsv(list)
  console.log(csv)
  const {
    total,
    totalPoint,
    totalResultTime,
    totalReviewTime,
  } = trelloCsv.makeStatistics(list)
  console.log(`total: ${total} hrs`)
  console.log(`total point: ${totalPoint}`)
  console.log('-----')
  console.log(`total result time: ${totalResultTime} hrs`)
  console.log(`total review time ${totalReviewTime} hrs`)
}

const writeListGroup = (trelloCsv, list, groupby) => {
  let {
    total,
    totalPoint,
    totalByGroup,
    pointsByGroup,
    resultTimeByGroup,
    reviewTimeByGroup,
  } = trelloCsv.makeStatisticsUseGroupBy(list, groupby)
  let csv = trelloCsv.makeCsvUseGroupBy(
    groupby,
    totalByGroup,
    pointsByGroup,
    resultTimeByGroup,
    reviewTimeByGroup
  )
  console.log(csv)
  console.log(`total: ${total} hrs`)
  console.log(`total point: ${totalPoint}`)
}

const writePointCountList = (trelloCsv, allDaysCountList, groupValues) => {
  let csv = trelloCsv.makePointCountCsvForBurndown(
    allDaysCountList,
    groupValues
  )
  console.log(csv)
  fs.writeFileSync(
    'chart-html/data/pointsCountData.csv.js',
    'const pointsCountDataCSV = `' + csv + '`'
  )
}

const writeIssueCountList = (trelloCsv, allDaysCountList, groupValues) => {
  let csv = trelloCsv.makeIssueCountCsvForBurndown(
    allDaysCountList,
    groupValues
  )
  console.log(csv)
  fs.writeFileSync(
    'chart-html/data/issuesCountData.csv.js',
    'const issuesCountDataCSV = `' + csv + '`'
  )
}

const main = async () => {
  try {
    const trelloCsv = new TrelloCSV(config)
    // Board一覧取得
    let boardList = await trelloCsv.loadBoards()
    console.debug('boardList:', JSON.stringify(boardList, true, '  '))
    // Board一覧表示
    let num = 1
    let re = ''
    for (const item of boardList) {
      re += num === 1 ? '' : '|'
      re += `^${num}$`
      console.log(inf(`${num++}: ${item.name}`))
    }
    // Board選択
    let i = await inputText('select board by number: ', re)
    const selectedBoard = boardList[Number(i - 1)]
    // Trelloからボードに関するデータを取得しパース
    let list = await trelloCsv.parseBoard(selectedBoard)
    // 出力内容選択
    let initialFilterCondition = ''
    let initialCountCondition = ''
    let groupby = ''
    let showingList = [
      'cardId',
      'number',
      'title',
      'point',
      'listName',
      'inDate',
      'outDate',
      'resultTime',
      'reviewTime',
      'labelPink',
      'labelGreen',
      'member',
    ]
    while (true) {
      console.log(inf('----------'))
      console.log(inf('1: set "group by"'))
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
            resultTime = 'resultTime',
            reviewTime = 'reviewTime',
            labelPink = 'labelPink',
            labelGreen = 'labelGreen',
            member = 'member',
            totalResultTime = 'totalResultTime',
            totalReviewTime = 'totalReviewTime',
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
          initialFilterCondition
        )
        console.log(inf('----------'))
        let newList
        try {
          newList = trelloCsv.searchListByCondition(condition)
        } catch (err) {
          console.error(er(err))
        }
        if (groupby !== '') {
          writeListGroup(trelloCsv, newList, groupby)
        } else {
          writeList(trelloCsv, newList, showingList)
        }
        initialFilterCondition = condition
      } else if (type === '3') {
        console.log(
          inf(
            'specify filter by javascript condition, the following variables are available, "true" means showing all data'
          )
        )
        // console.log(inf(`  variable names: ${showingList.toString()}`))
        const condition = await inputText(
          'input condition: ',
          `.+`,
          initialCountCondition
        )
        console.log(inf('----------'))
        try {
          let newList = trelloCsv.searchListByCondition(condition)
          let {
            allDaysCountList,
            groupValues,
          } = trelloCsv.makeStatisticsForBurndown(newList, groupby, NOW)
          writeIssueCountList(trelloCsv, allDaysCountList, groupValues)
          console.log(inf('----------'))
          writePointCountList(trelloCsv, allDaysCountList, groupValues)
        } catch (err) {
          console.error(er(err))
        }
        initialCountCondition = condition
        await open('chart-html/index.html')
      }
    }
  } catch (err) {
    console.error(er(err))
  }
}

main()
