# trello-csv

## 概要

[Trello](https://trello.com/)で保存した情報をCSV形式で出力するコマンドラインツールです。

各カードについて以下を記録できます。

* 見積り時間: カードの作業を実施するのに要する時間の見積り。カードのDescriptionに`Point: n`(nは時間(hour)を表す実数)を入力する。
* 実績時間: カードの作業に要した実績時間。カードのコメントとして`Result: n`(nは時間(hour)実装)を入力する。一つのカードに実績時間を記述した複数のカードがあっても良い。
* レビュー時間: カードの作業に対するレビュー時間。カードのコメントとして`Review: n`(nは時間(hour)実装)を入力する。一つのカードにレビュー時間を記述した複数のカードがあっても良い。

[Node.js](https://nodejs.org/)上で動作します。

## CSVで出力するデータ

本ツールでは以下のデータをTrelloから抜き出し、リストの出し入れば発生する毎を一つの行として出力します。

|名前|型|説明|
| --- | --- | --- |
|cardId|string|Cardを一意に識別するためのIDです。|
|number|string|Cardのタイトルが`#123 名前`のような形式であった場合、123が入ります。対応する文字列を検出できなかった場合は`-`が入ります。|
|title|string|CardのTitleが入ります。上記numberが抽出された場合は、number以外の部分が入ります。|
|point|string|Cardの説明に記載した見積り(Point)が入ります。|
|listName|string|リストの名前です。|
|inDate|Date|リストにCardが入った時刻です。|
|outDate|Date|リストからCardが出た時刻です。|
|resultTime|String|Cardのコメント記載された実績時間(Result)です。|
|reviewTime|string|Cardのコメント記載されたレビュー時間(Review)です。|
|labelPink|string|Cardに付与したPinkラベルに記載した文字列です。|
|labelGreen|string|Cardに付与したGreenまたはLimeのラベルに記載した文字列です。|
|member|string|Cardのメンバーを出力します。複数メンバーがいる場合はカンマ区切りで表示します。|

上記に加え、集計結果の抽出した全行の実績時間とレビュー時間の合計と全カードのPointの合計も出力します。

## 使い方

本ツールを利用するPCにNode.js(v10以上)をインストールします(説明は省略します)。

次に、このリポジトリのソースコードをgit cloneまたはZIPにより自分のPCにダウンロードします。

* git cloneの場合

    Terminalで適当なフォルダを作成し、以下のコマンドを実行します。
    `> git clone https://github.com/hidetak/trello-csv.git`

* ZIPの場合

    Webブラウザで[リポジトリ](https://github.com/hidetak/trello-csv)にアクセスし、`Clone or download`ボタンをクリックし、ZIPをダウンロードします。
    ダウンロードしたZIPファイルを適当なフォルダに展開します。

Terminalを起動し、ソースコードを配置したフォルダ(ここでは`trello-csvフォルダ`とします)に移動して、必要なnpmモジュールをインストールします。

```
> cd <trello-csvフォルダ>
> npm i
```

インストールが完了したら`config.json`に以下の情報を登録します。

|キー|値の説明|
| --- | --- |
|KEY|TrelloのAPIを呼び出す際に利用するキー *1 |
|TOKEN|TrelloのAPIを呼び出す際に利用するトークン *1 |
|USERNAME|Trelloに設定したユーザ名 |
|FIRSTDATETIME|残りIssue数やPoint数をカウントする際にカウントを始める最初の日時 *2 |
|INTERVAL_HOUR|残りIssue数やPoint数をカウントする際にカウントする間隔 *2 |
|EXCEPT_LISTS|BurndownChartの表示時に除外するカードを配置するリストの名前 |
|DONE_LISTS|BurndownChart表示時に完了となったカードを配置するリストの名前 |

*1: KEYとTOKENはTrello APIの[紹介ページ](https://developers.trello.com/docs/api-introduction)を参照し、生成してください。

例
```
{
  "KEY": "7325fc93ecb5612c0a10273ecfe84153",
  "TOKEN": "256a94c3943ec573b6791103526fa0ef723e0b8f132ef20780ebf733ae78d869",
  "USERNAME": "trellouser",
  "FIRSTDATETIME": "2020/03/16 19:00",
  "INTERVAL_HOUR": 24
}
```

*2: `FIRSTDATETIME`と`INTERVAL_HOUR`を上記のように設定し、残りカード数やPoint数をカウントする機能(後述)を呼び出すと2020/03/16 19:00時点の残りカード数やPoint数、2020/03/17 19:00時点の残りカード数やPoint数、・・・のように24時間毎に現在時刻未満までの状況を出力します(バーンダウンチャートを描く際に利用することを想定しています)。

これで準備が整いました。
実行はTerminalから以下のコマンドにより行います。

```
> npm start
```

実行すると、最初にBoardのリストが表示されますので、CSVを作成したいボードの左側に表示された番号を入力します。

```
1: Trelloへようこそ！
2: hoge1
3: hoge2
select board number: 2
```
Trelloからのデータのダウンロードが開始します。
しばらく待つと次に以下が表示されます。

```
1: set "group by"
2: input filter and show data
3: remaining number of issues and points
current group by: 
select: 
```

実施したいことを左側の番号で選択します。

1を入力すると、group byを設定できます。  
group byは集計する際にまとめる変数であり、例えば`member`と入力するとメンバーの種類毎に集計を行います。  
group byの指定の際に何も表示せずにリターンすると、group byが未設定となります。
```
select: 1
specify variable name, empty string means no group by
  variable names: cardId,number,title,point,listName,inDate,outDate,resultTime,reviewTime,labelPink,labelGreen,member
group by: member
```

2を入力すると、JavaScriptの条件文を入力できます。  
条件文を入力すると、各行をその条件文で評価し、trueとなった行のみを出力・集計の対象とします。

```
select: 2
specify filter by javascript condition, the following variables are available, "true" means showing all data
  variable names: cardId,number,title,point,listName,inDate,outDate,resultTime,reviewTime,labelPink,labelGreen,member
input condition: inDate > new Date("2020/2/22") && listName === "Doing"
```

条件文の例を示します。

* Doingという名前のリストに滞在した時間のみ集計したい場合  
    `listName === "Doing"`
* さらにメンバーの名前がtrellouserのみ集計したい場合  
    `listName === "Doing && member === "trellouser"`
* さらに特定の日付の範囲のCSVのみ抽出したい場合  
    `listName === "Doing && member === "trellouser" && inDate > new Date("2020/2/22") && outDate < new Date("2020/2/29")`

３を選択すると2の場合と同様に条件の入力を求められます。条件を入れるとその条件に合うカードの残りカード数やPoint数などをCSV形式で出力します。さらにブラウザを立ち上げ、Burndown chartを表示します。

CSVの表示例を以下に示します。

```
select: 3
specify filter by javascript condition, the following variables are available, "true" means showing all data
input condition: member === "trello user"
----------
"datetime","all issues","done issues","remaining issues"
"2020-03-16 19:00","71","7","64"
"2020-03-17 19:00","82","10","72"
"2020-03-18 19:00","90","16","74"
"2020-03-19 00:30","90","16","74"

----------
"datetime","all points","done points","remaining points"
"2020-03-16 19:00","498","52","446"
"2020-03-17 19:00","606","91","515"
"2020-03-18 19:00","630","98","532"
"2020-03-19 00:30","630","98","532"
```

この機能はリストの名前やリストの運用に依存した機能になっており汎用的ではありません。
出力するデータについて以下に説明します。

|データ名|値の説明|
| --- | --- |
|datetime|いつの時点のカード数やPoint数の集計であるかを示します(最初の日時と間隔はconfig.jsonで指定します)。|
|all issues|config.jsonのEXCEPT_LISTSに設定したリストを除く全リストのカード数です。|
|all points|config.jsonのEXCEPT_LISTSに設定したリストを除く全リストのカードに記載されたPoint数の合計です。|
|done issues|config.jsonのDONE_LISTSで定義したリストのカード数です。|
|done points|config.jsonのDONE_LISTSで定義したリストのカードに記載されたPoint数の合計です。|
|remaining issues|まだconfig.jsonのDONE_LISTSで定義したリスト以外のカードの数です。|
|remaining points|まだconfig.jsonのDONE_LISTSで定義したリスト以外のカードに記載されたPoint数の合計です。|

もし、group byを設定していた場合は上記の後に、group byで指定した変数の値毎に残りのIssue数やPoint数を出力します。
