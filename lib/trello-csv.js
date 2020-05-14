const fetch = require("node-fetch");
const moment = require("moment-timezone");

class TrelloCSV {
  /**
        config:{
        "KEY": "<KEY>",
        "TOKEN": "<TOKEN>",
        "USERNAME": "<USERNAME>",
        "FIRSTDATETIME": "2020/03/16 19:00",
        "INTERVAL_HOUR": 24,
        "EXCEPT_LISTS": ["Tasks"],
        "DONE_LISTS": ["Done"]
        }
    */
  constructor(config) {
    this.config = config;
    this.BOARDS_URL = `https://trello.com/1/members/${config.USERNAME}/boards?key=${config.KEY}&token=${config.TOKEN}&fields=name,memberships`;
    this.MEMBERS_URL = `https://trello.com/1/members/$$MEMBER_ID$$/?fields=fullName,username&key=${config.KEY}&token=${config.TOKEN}`;
    this.LISTS_URL = `https://trello.com/1/boards/$$BOARD_ID$$/lists?fields=name,url&key=${config.KEY}&token=${config.TOKEN}`;
    this.CARDS_URL = `https://trello.com/1/lists/$$LIST_ID$$/cards?key=${config.KEY}&token=${config.TOKEN}&fields=name,labels,idMembers,desc`;
    this.ACTIONS_URL = `https://trello.com/1/cards/$$CARD_ID$$/actions?key=${config.KEY}&token=${config.TOKEN}&filter=all`;
  }

  async _getDataFromTrello(url) {
    let response = await fetch(url);
    return await response.json();
  }

  async loadBoards() {
    return this._getDataFromTrello(this.BOARDS_URL);
  }

  async loadMember(memberId) {
    return this._getDataFromTrello(
      this.MEMBERS_URL.replace("$$MEMBER_ID$$", memberId)
    );
  }

  async loadLists(boardId) {
    return this._getDataFromTrello(
      this.LISTS_URL.replace("$$BOARD_ID$$", boardId)
    );
  }

  async loadCards(listId) {
    return this._getDataFromTrello(
      this.CARDS_URL.replace("$$LIST_ID$$", listId)
    );
  }

  async loadActions(cardId) {
    return this._getDataFromTrello(
      this.ACTIONS_URL.replace("$$CARD_ID$$", cardId)
    );
  }

  async parseBoard(board) {
    // User取得
    let memberMap = {};
    const memberships = board.memberships;
    for (const m of memberships) {
      memberMap[m.idMember] = await this.loadMember(m.idMember);
    }
    console.debug("members:", memberMap);
    // List
    let lists = await this.loadLists(board.id);
    // 全カード取得
    let cards = [];
    for (const item of lists) {
      let list = await this.loadCards(item.id);
      cards = cards.concat(list);
    }
    console.debug("cards:", JSON.stringify(cards, true, "  "));
    // カードに対するActionを取得
    let actionMap = {};
    let cardsMap = {};
    for (const c of cards) {
      actionMap[c.id] = await this.loadActions(c.id);
      if (c.idMembers) {
        let members = [];
        for (const m of c.idMembers) {
          members.push(memberMap[m].fullName);
        }
        c["membersText"] = members.join(",");
      }
      let labelsMap = {};
      if (c.labels) {
        for (const l of c.labels) {
          labelsMap[l.color] = l.name;
        }
      }
      c["labelsMap"] = labelsMap;
      cardsMap[c.id] = c;
    }
    console.debug("actionMap:", JSON.stringify(actionMap, true, "  "));
    // Parse
    this.list = this._parseData(actionMap, cardsMap);
    return this.list;
  }

  _parseData(actionMap, cardsMap) {
    let list = [];
    for (const key in actionMap) {
      const actions = actionMap[key];
      let cardId = cardsMap[key].id;
      let labels = cardsMap[key].labelsMap;
      let cardName = cardsMap[key].name;
      let matched = cardName.match("^#([0-9]+)[ |:](.+)");
      let number = matched && matched[1] ? matched[1].trim() : "-";
      let title = matched && matched[2] ? matched[2].trim() : cardName;
      let member = cardsMap[key].membersText ? cardsMap[key].membersText : "-";
      let desc = cardsMap[key].desc;
      let point = 0;
      // parse description
      if (desc && desc.match("(Point|point|POINT) *: *([.0-9]+)")) {
        point = Number(desc.match("(Point|point|POINT) *: *([.0-9]+)")[2]);
      }
      let current;
      // コメントに記載された作業時間やレビュー時間を取得
      for (let i = actions.length - 1; i >= 0; i--) {
        const a = actions[i];
        let listName = a.data.list ? a.data.list.name : "-";
        let date = new Date(a.date);
        let comment = a.data.text;
        let commentMember = a.memberCreator.fullName;
        let reviewTime = 0;
        let resultTime = 0;
        // parse result and review
        if (comment) {
          if (comment.match("(Result|result|RESULT) *: *([.0-9]+)")) {
            resultTime = Number(
              comment.match("(Result|result|RESULT) *: *([.0-9]+)")[2]
            );
          }
          if (comment.match("(Review|review|REVIEW) *: *([.0-9]+)")) {
            reviewTime = Number(
              comment.match("(Review|review|REVIEW) *: *([.0-9]+)")[2]
            );
          }
          list.push({
            cardId,
            number,
            title,
            point: 0, // commentにはpointを付けない
            listName,
            inDate: date,
            outDate: date,
            resultTime,
            reviewTime,
            labelPink: labels["pink"] ? labels["pink"] : "-",
            labelGreen: labels["green"]
              ? labels["green"]
              : labels["lime"]
              ? labels["lime"]
              : "-",
            member: commentMember,
          });
        } else {
          // inDate / outDateを処理する
          if (!current) {
            current = {
              cardId,
              number,
              title,
              point,
              listName,
              inDate: date,
              resultTime: 0,
              reviewTime: 0,
              labelPink: labels["pink"] ? labels["pink"] : "-",
              labelGreen: labels["green"]
                ? labels["green"]
                : labels["lime"]
                ? labels["lime"]
                : "-",
              member,
            };
          }
          if (a.data.listBefore) {
            current["listName"] = a.data.listBefore.name;
            current["outDate"] = new Date(a.date);
            // current['time'] =
            //   (current['outDate'].getTime() - current['inDate'].getTime()) /
            //   1000 /
            //   60 /
            //   60
            list.push(JSON.parse(JSON.stringify(current)));
          }
          if (a.data.listAfter) {
            current = {
              cardId,
              number,
              point,
              title,
              listName: a.data.listAfter.name,
              inDate: new Date(a.date),
              resultTime: 0,
              reviewTime: 0,
              labelPink: labels["pink"] ? labels["pink"] : "-",
              labelGreen: labels["green"]
                ? labels["green"]
                : labels["lime"]
                ? labels["lime"]
                : "-",
              member,
            };
          }
        }
      } // if(commnet)
      if (current) {
        current["outDate"] = new Date();
        current["time"] =
          (current["outDate"].getTime() - current["inDate"].getTime()) /
          1000 /
          60 /
          60;
        list.push(JSON.parse(JSON.stringify(current)));
      }
    } // actionMap loop
    return list;
  }

  searchListByCondition(condition) {
    let newList = [];
    let total = 0;
    for (let d of this.list) {
      const all = true;
      const header = false;
      let {
        cardId,
        number,
        title,
        point,
        listName,
        inDate,
        outDate,
        resultTime,
        reviewTime,
        labelPink,
        labelGreen,
        member,
      } = d;
      inDate = new Date(inDate);
      outDate = new Date(outDate);
      try {
        if (eval(condition)) {
          newList.push(d);
        }
      } catch (err) {
        throw err;
      }
    }
    return newList;
  }

  makeStatistics(list) {
    let total = 0;
    let totalResultTime = 0;
    let totalReviewTime = 0;
    let cardPointMap = {};
    for (let d of list) {
      totalResultTime += d.resultTime;
      totalReviewTime += d.reviewTime;
      total += d.resultTime + d.reviewTime;
      cardPointMap[d.cardId] = d.point;
    }
    let totalPoint = 0;
    for (let k in cardPointMap) {
      totalPoint += cardPointMap[k];
    }
    return { total, totalPoint, totalResultTime, totalReviewTime };
  }

  makeCsv(list) {
    let csv =
      '"cardId","number","title","point","listName","inDate","outDate","resultTime","reviewTime","labelPink","labelGreen","member"\n';
    for (let d of list) {
      let inDate = moment(d.inDate)
        .tz("Asia/Tokyo")
        .format("YYYY/MM/DD HH:mm:ss");
      let outDate = moment(d.outDate)
        .tz("Asia/Tokyo")
        .format("YYYY/MM/DD HH:mm:ss");
      csv += `"${d.cardId}","${d.number}","${d.title}","${d.point}","${d.listName}","${inDate}","${outDate}","${d.resultTime}","${d.reviewTime}","${d.labelPink}","${d.labelGreen}","${d.member}"\n`;
    }
    return csv;
  }

  makeStatisticsUseGroupBy(list, groupby) {
    let total = 0;
    let totalResultTime = 0;
    let totalReviewTime = 0;
    let resultTimeByGroup = {};
    let reviewTimeByGroup = {};
    let totalByGroup = {};
    let relatedCardIds = {};
    let pointsByGroup = {};
    let cardPointMap = {};
    for (let d of list) {
      total += d.resultTime + d.reviewTime;
      totalResultTime += d.resultTime;
      totalReviewTime += d.reviewTime;
      cardPointMap[d.cardId] = d.point;
      resultTimeByGroup[d[groupby]] = resultTimeByGroup[d[groupby]]
        ? resultTimeByGroup[d[groupby]] + d.resultTime
        : d.resultTime;
      reviewTimeByGroup[d[groupby]] = reviewTimeByGroup[d[groupby]]
        ? reviewTimeByGroup[d[groupby]] + d.reviewTime
        : d.reviewTime;
      totalByGroup[d[groupby]] = totalByGroup[d[groupby]]
        ? totalByGroup[d[groupby]] + d.resultTime
        : d.resultTime;
      totalByGroup[d[groupby]] += d.reviewTime;
      if (
        !relatedCardIds[d[groupby]] ||
        !relatedCardIds[d[groupby]][d.cardId]
      ) {
        pointsByGroup[d[groupby]] = pointsByGroup[d[groupby]]
          ? pointsByGroup[d[groupby]] + d.point
          : d.point;
        if (!relatedCardIds[d[groupby]]) {
          relatedCardIds[d[groupby]] = {};
        }
        relatedCardIds[d[groupby]][d.cardId] = d.cardId;
      }
    }
    let totalPoint = 0;
    for (let k in cardPointMap) {
      totalPoint += cardPointMap[k];
    }
    return {
      total,
      totalPoint,
      totalByGroup,
      pointsByGroup,
      resultTimeByGroup,
      reviewTimeByGroup,
    };
  }

  makeCsvUseGroupBy(
    groupby,
    totalByGroup,
    pointsByGroup,
    resultTimeByGroup,
    reviewTimeByGroup
  ) {
    let csv = `"${groupby}","totalPoint","totalTime","totalResult","totalReview"\n`;
    for (let k in totalByGroup) {
      csv += `"${k}","${pointsByGroup[k]}","${totalByGroup[k]}","${resultTimeByGroup[k]}","${reviewTimeByGroup[k]}"\n`;
    }
    return csv;
  }

  makeStatisticsForBurndown(list, groupby, now) {
    const firstDateTime = new Date(this.config.FIRSTDATETIME).getTime();
    const interval = this.config.INTERVAL_HOUR * 60 * 60 * 1000;
    const currentTime = now;
    let allDaysCountList = [];
    let groupValues = {};
    for (
      let time = firstDateTime;
      time < currentTime + interval;
      time += interval
    ) {
      if (time > currentTime) {
        time = currentTime;
      }
      let countedCard = {}; // 計算済みのカードを記録
      let numberOfAllCards = 0;
      let allPoints = 0;
      let numberOfDoneCards = 0;
      let donePoints = 0;
      let numberOfRemainCardsEachGroup = {};
      let remainPointsEachGroup = {};
      for (let i = list.length - 1; i >= 0; i--) {
        let d = list[i];
        let inDate = new Date(d.inDate);
        let outDate = new Date(d.outDate);
        if (
          inDate < time &&
          time < outDate &&
          !this.config.EXCEPT_LISTS.includes(d.listName)
        ) {
          if (!countedCard[d.cardId]) {
            countedCard[d.cardId] = true;
            numberOfAllCards++;
            allPoints += d.point;

            if (this.config.DONE_LISTS.includes(d.listName)) {
              numberOfDoneCards++;
              donePoints += d.points;
            } else {
              numberOfRemainCardsEachGroup[
                "all"
              ] = numberOfRemainCardsEachGroup["all"]
                ? numberOfRemainCardsEachGroup["all"] + 1
                : 1;
              remainPointsEachGroup["all"] = remainPointsEachGroup["all"]
                ? remainPointsEachGroup["all"] + d.point
                : d.point;
              if (groupby != "") {
                groupValues[d[groupby]] = d[groupby];
                numberOfRemainCardsEachGroup[
                  d[groupby]
                ] = numberOfRemainCardsEachGroup[d[groupby]]
                  ? numberOfRemainCardsEachGroup[d[groupby]] + 1
                  : 1;
                remainPointsEachGroup[d[groupby]] = remainPointsEachGroup[
                  d[groupby]
                ]
                  ? remainPointsEachGroup[d[groupby]] + d.point
                  : d.point;
              }
            }
          }
        }
      }
      allDaysCountList.push({
        time,
        numberOfAllCards,
        allPoints,
        numberOfDoneCards,
        donePoints,
        numberOfRemainCardsEachGroup,
        remainPointsEachGroup,
      });
    }
    return { allDaysCountList, groupValues };
  }

  makePointCountCsvForBurndown(allDaysCountList, groupValues) {
    let csv = '"datetime","all points","done points","remaining points"';
    const keys = Object.keys(groupValues);
    for (let k of keys) {
      csv += `,"${k}"`;
    }
    csv += "\n";
    for (let d of allDaysCountList) {
      csv += `"${moment(d.time).format("YYYY-MM-DD HH:mm")}","${
        d.allPoints
      }","${d.donePoints}","${d.remainPointsEachGroup["all"]}"`;
      for (let k of keys) {
        csv += `,"${
          d.remainPointsEachGroup[k] ? d.remainPointsEachGroup[k] : "0"
        }"`;
      }
      csv += "\n";
    }
    return csv;
  }

  makeIssueCountCsvForBurndown(allDaysCountList, groupValues) {
    let csv = '"datetime","all issues","done issues","remaining issues"';
    const keys = Object.keys(groupValues);
    for (let k of keys) {
      csv += `,"${k}"`;
    }
    csv += "\n";
    for (let d of allDaysCountList) {
      csv += `"${moment(d.time).format("YYYY-MM-DD HH:mm")}","${
        d.numberOfAllCards
      }","${d.numberOfDoneCards}","${d.numberOfRemainCardsEachGroup["all"]}"`;
      for (let k of keys) {
        csv += `,"${
          d.numberOfRemainCardsEachGroup[k]
            ? d.numberOfRemainCardsEachGroup[k]
            : "0"
        }"`;
      }
      csv += "\n";
    }
    return csv;
  }
}

module.exports = TrelloCSV;
