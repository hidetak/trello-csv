# trello-csv

## 概要

[Trello](https://trello.com/)で保存した情報をCSV形式で出力するコマンドラインツールです。

カードがどのくらいの時間、リストに存在していたがを集計するために利用することを想定しています。例えば、作業中はDoingという名前のリストにCardを移動し、終了したり、別の作業を開始するときはDoingリストの外に出すというルールでTrelloを運用することで、各カードに要した時間を計測できます。

[Node.js](https://nodejs.org/)上で動作します。

## CSVで出力するデータ

本ツールでは以下のデータをTrelloから抜き出し、リストの出し入れば発生する毎を一つの行として出力します。

|名前|型|説明|
| --- | --- | --- |
|cardId|string|Cardを一意に識別するためのIDです。|
|number|string|Cardのタイトルが`#123 名前`のような形式であった場合、123が入ります。対応する文字列を検出できなかった場合は`-`が入ります。|
|title|string|CardのTitleが入ります。上記numberが抽出された場合は、number以外の部分が入ります。|
|point|string|Cardの説明に`Point: 3`のような文字列があった場合、3の部分を抜き出します。Agileのストーリーポイントにより見積もりを行う場合、見積もり結果を集計することを想定します。|
|listName|string|リストの名前です。|
|inDate|Date|リストにCardが入った時刻です。|
|outDate|Date|リストからCardが出た時刻です。|
|time|string|リストに入ってから出るまでにかかった時間です。単位はhoursです。|
|labelPink|string|Cardに付与したPinkラベルに記載した文字列です。|
|labelGreen|string|Cardに付与したGreenまたはLimeのラベルに記載した文字列です。|
|member|string|Cardのメンバーを出力します。複数メンバーがいる場合はカンマ区切りで表示します。|

上記に加え、集計結果の抽出した全行のtimeの合計と全カードのpointの合計も出力します。

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

インストールが完了したら`package.json`にTrelloのKEY、TOKEN、USERNAMEを設定します。

KEYとTOKENはTrello APIの[紹介ページ](https://developers.trello.com/docs/api-introduction)を参照し、生成してください。USERNAMEはTrelloに設定したユーザ名です。

package.jsonをテキストエディタで開くと以下のような記載を見つけることができます。

```
    "start": "node index.js <KEY> <TOKEN> <USERNAME>"
```
`<KEY>`、`<TOKEN>`、`<USERNAME>`の箇所を取得した値に置き換えてください。

例:
```
    "start": "node index.js 7325fc93ecb5612c0a10273ecfe84153 256a94c3943ec573b6791103526fa0ef723e0b8f132ef20780ebf733ae78d869 trellouser"
```

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

しばらく待つと次に以下が表示されます。

```
0: Show only header
1: All
2: Specify condition by js
Select output data: 
```

出力したいデータの種類を左側の番号で選択します。

０を入力すると、CSVのヘッダのみを標準出力に出力します。
1を入力すると、全データをCSV形式で標準出力に出力します。
2を入力すると、JavaScriptの条件文により出力するデータを選択できるようになります。

```
0: Show only header
1: All
2: Specify condition by js
Select output data: 2
input condition by js: listName === "Doing"
```

条件文の例を示します。

* Doingという名前のリストに滞在した時間のみ集計したい場合
    `listName === "Doing"`
* さらにメンバーの名前がtrellouserのみ集計したい場合
    `listName === "Doing && member === "trellouser"`
* さらに特定の日付の範囲のCSVのみ抽出したい場合
    `listName === "Doing && member === "trellouser" && inDate > new Date("2020/2/22") && outDate < new Date("2020/2/29")`
