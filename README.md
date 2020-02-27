# trello-csv

## 概要

[Trello](https://trello.com/)で保存した情報をCSV形式で出力するコマンドラインツールです。

[Node.js](https://nodejs.org/)上で動作します。

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

