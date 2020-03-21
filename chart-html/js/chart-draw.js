const parseCSV = csv => {
  let data = $.csv.toArrays(csv.trim())
  return data
}

const colorList = [
  'rgba(255,0,0,1)',
  'rgba(0,0,255,1)',
  'rgba(0,255,0,1)',
  'rgba(150,50,0,1)',
  'rgba(255,150,0,1)',
  'rgba(150,255,0,1)',
  'rgba(0,50,150,1)',
  'rgba(255,0,150,1)',
  'rgba(150,255,150,1)',
  'rgba(150,50,150,1)',
  'rgba(255,150,150,1)',
  'rgba(150,255,150,1)'
]

const makeDataForChart = (data, title) => {
  let labels = []
  for (let i = 1; i < data.length; i++) {
    labels.push(data[i][0])
  }
  let datasets = []
  for (let j = 3; j < data[0].length; j++) {
    datasets.push({
      label: data[0][j],
      data: [],
      borderColor: colorList[j - 3],
      backgroundColor: 'rgba(0,0,0,0)'
    })
    for (let i = 1; i < data.length; i++) {
      datasets[j - 3].data.push(Number(data[i][j]))
    }
  }
  return {
    type: 'line',
    data: {
      labels,
      datasets
    },
    options: {
      title: {
        display: true,
        text: title
      }
    }
  }
}
